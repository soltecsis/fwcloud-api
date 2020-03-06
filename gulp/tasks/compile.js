var gulp = require("gulp");
var compiler = require("gulp-typescript");


module.exports = async (fileList = null) => {
    var tsProject = compiler.createProject("tsconfig.json");
    return tsProject.src()
        .pipe(tsProject())
        .js.pipe(gulp.dest("dist"));
};