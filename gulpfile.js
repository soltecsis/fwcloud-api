'use strict';

const Fs = require('fs');
const Path = require('path');
const killProcess = require('tree-kill');
const { spawn } = require('child_process');
const gulp = require('gulp');

const smart_compilation = require('./gulp/tasks/smart_compilation');

const projectPath = __dirname;
const buildPath = Path.join(projectPath, 'dist');

let applicationInstanceReference = null;

function stopApplication(pid) {
    if (pid === null) { return; }
    console.log('Sending SIGTERM to the application');
    killProcess(pid);
};

function startApplication() {
    try {
        const stat = Fs.statSync(Path.join(buildPath, 'src/bin/fwcloud.js'))
        if (stat.isFile()) {
            applicationInstanceReference = spawn('node ' + Path.join(buildPath, 'src/bin/fwcloud.js'), [], {
                stdio: 'inherit',
                shell: true,
            });
            console.log('Starting application [DONE]');
        }
    } catch(e) {}
}

function start() {
    startApplication();
};

function stop() {
    if (applicationInstanceReference && applicationInstanceReference.hasOwnProperty('pid')) {
        stopApplication(applicationInstanceReference.pid);
    }
}

function restart() {
    stop();
    start();
}

function reload() {
    const watcher = gulp.watch('dist/**/*', {delay: 1000, ignoreInitial: true, events: "all"});

    watcher.on('all', async (event, filePath) => {
        restart();
    });

    restart();
}

exports.reload = reload;
exports.smartCompilation = smart_compilation;