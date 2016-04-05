(function () {
	'use strict';

	var gulp = require('gulp');
	var sass = require('gulp-sass');
	var jshint = require('gulp-jshint');
	var jscs = require('gulp-jscs');
	var shell = require('gulp-shell');

	gulp.task('lint', function () {
		return gulp.src([
			'./build_scripts/**/*.js',
			'./config/**/*.js',
			'./models/**/*.js',
			'./routes/**/*.js',
			'./scrapers/**/*.js',
			'./*.js',
		])
		.pipe(jshint())
		.pipe(jshint.reporter('default'))
		.pipe(jscs())
		.pipe(jscs.reporter())
		.pipe(jscs.reporter('fail'));

		// .pipe(stylish.combineWithHintResults())
		// .pipe(jshint.reporter('jshint-stylish'));
	});

	gulp.task('scss', function () {
		gulp.src('./public/scss/**/*.scss')
		.pipe(sass().on('error', sass.logError))
		.pipe(gulp.dest('./public/css'));
	});

	gulp.task('scss:watch', function () {
		gulp.watch('./public/scss/**/*.scss', ['scss']);
	});

	gulp.task('scrape', shell.task([
		'node scrapers/pcWarning.js',
		'node scrapers/countryWarning.js',
	]));

	gulp.task('default', ['lint', 'scss', 'scss:watch']);
	gulp.task('deploy', ['lint', 'scss', 'scrape']);
})();
