const fs = require('fs');;
const path = require('path');
const EventEmitter = require('events');
const compilationTask = require('./compile');
const log = require('fancy-log');

let compiled_list = [];
let source_list = [];

class MyEmitter extends EventEmitter {
    constructor() {
        super();
        this.compiled_list = false;
        this.source_list = false;
    }

    detectUncompiledFiles() {
        const returns = [];
        if (this.compiled_list && this.source_list) {
            for (let i = 0; i < source_list.length; i++) {
                const file = source_list[i].file;
                const timestamp = source_list[i].timestamp;

                const results = compiled_list.filter(item => {
                    return item.file === file;
                })

                if (results.length === 0 || (results.length > 0 && results[0].timestamp <= timestamp)) {
                    returns.push(source_list[i]);
                }
            }
        }

        return returns;
    }

    async compileUncompiledFiles(uncompiled = []) {
        if (uncompiled.length <= 0) {
            return;
        }
        log(uncompiled.length + ' compiled files outdated. Needs compilation...');
        await compilationTask(uncompiled);
    }

    async compileAll() {
        log('Compiling all files...');
        await compilationTask();
    }
}

const myEmitter = new MyEmitter();

myEmitter.on('compiled_list', async () => {
    myEmitter.compiled_list = true;
    const uncompiled = myEmitter.detectUncompiledFiles();
    myEmitter.compileUncompiledFiles(uncompiled);
});

myEmitter.on('source_list', async () => {
    myEmitter.source_list = true;
    const uncompiled = myEmitter.detectUncompiledFiles();
    myEmitter.compileUncompiledFiles(uncompiled);
});

myEmitter.on('full_compilation', async () => {
    myEmitter.compileAll();
});

var findSources = function (dir, regexp, done) {
    var results = [];
    
    fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        var pending = list.length;
        if (!pending) return done(null, results);
        list.forEach(function (file) {
            file = path.resolve(dir, file);
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    findSources(file, regexp, function (err, res) {
                        results = results.concat(res);
                        if (!--pending) done(null, results);
                    });
                } else {
                    if (stat && regexp.test(file)) {
                        results.push({ file: file.replace(regexp, ''), timestamp: stat.mtimeMs });
                    }
                    if (!--pending) done(null, results);
                }
            });
        });
    });
};

async function main() {
    const sourcePath = path.join(process.cwd(), 'src');
    const buildPath = path.join(process.cwd(), 'dist');

    findSources(path.join(process.cwd(), 'src'), new RegExp(`\\.ts$|\\.js$`, 'm'), (err, done) => {
        if (err) { throw err; }
        source_list = done.map((item) => {
            item.file = item.file.replace(path.join(process.cwd(), 'src/'), '');
            item.file = item.file.replace(path.join(process.cwd(), 'dist', 'tests/'), '');
            return item;
        });
        myEmitter.emit('source_list');
    });


    if (!fs.existsSync(buildPath)) {
        myEmitter.emit('full_compilation');
        return;
    }

    findSources(path.join(process.cwd(), 'dist'), new RegExp('\\.js$', 'm'), (err, done) => {
        if (err) { throw err; }
        compiled_list = done.map((item) => {
            item.file = item.file.replace(path.join(process.cwd(), 'dist', 'src/'), '');
            item.file = item.file.replace(path.join(process.cwd(), 'dist', 'tests/'), '');
            return item;
        });
        myEmitter.emit('compiled_list');
    });
}

module.exports = async () => {
    await main();
};