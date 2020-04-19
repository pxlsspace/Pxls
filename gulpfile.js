const { src, dest, parallel } = require('gulp');
const cleanCSS = require('gulp-clean-css');
const sourcemaps = require('gulp-sourcemaps');
// const eslint = require('gulp-eslint');
const minify = require('gulp-minify');
const gulpIf = require('gulp-if');
const merge = require('merge-stream');

const isDevEnvironment = process.env.NODE_ENV === 'dev';

if (isDevEnvironment) {
  console.info('❗ Development environment detected.');
}

function html () {
  return src('resources/public/*.html')
    .pipe(dest('target/classes/public'));
}

function css () {
  return src('resources/public/*.css')
    .pipe(gulpIf(isDevEnvironment, sourcemaps.init()))
    .pipe(cleanCSS())
    .pipe(gulpIf(isDevEnvironment, sourcemaps.write()))
    .pipe(dest('target/classes/public'));
}

function js () {
  const min = src('resources/public/*.min.js')
    .pipe(dest('target/classes/public'));

  const source = src(['resources/public/*.js', '!resources/public/*.min.js'])
    // .pipe(eslint())
    // .pipe(eslint.failAfterError())
    .pipe(gulpIf(isDevEnvironment, sourcemaps.init()))
    .pipe(minify({
      ext: {
        src: '.src.js',
        min: '.js'
      }
    }))
    .pipe(gulpIf(isDevEnvironment, sourcemaps.write()))
    .pipe(dest('target/classes/public'));

  return merge(min, source);
}

exports.html = html;
exports.css = css;
exports.js = js;
exports.default = parallel(html, css, js);
