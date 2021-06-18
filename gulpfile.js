const { src, dest, parallel, series } = require('gulp');
const cleanCSS = require('gulp-clean-css');
const sourcemaps = require('gulp-sourcemaps');
const eslint = require('gulp-eslint');
const minify = require('gulp-minify');
const gulpIf = require('gulp-if');
const browserify = require('browserify');
const tap = require('gulp-tap');
const buffer = require('gulp-buffer');

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

function minJS () {
  return src('resources/public/*.min.js')
    .pipe(dest('target/classes/public'));
}

// NOTE ([  ]): pattern for all non-minified .js files
const SOURCE_FILES = [
  'resources/public/**/*.js',
  '!resources/public/**/*.min.js',
  '!resources/public/**/*-min.js'
];

function lint() {
  return src(SOURCE_FILES)
    .pipe(eslint())
    .pipe(eslint.failAfterError());
}

function srcJS () {
  return src([...SOURCE_FILES, '!resources/public/include/**/*.js'], { read: false })
    .pipe(tap(file => {
      file.contents = browserify(file.path, { debug: isDevEnvironment })
        .bundle();
    }))
    .pipe(buffer())
    .pipe(gulpIf(isDevEnvironment, sourcemaps.init({ loadMaps: true })))
    .pipe(minify({
      ext: {
        src: '.src.js',
        min: '.js'
      }
    }))
    .pipe(gulpIf(isDevEnvironment, sourcemaps.write()))
    .pipe(dest('target/classes/public'));
}

exports.html = html;
exports.css = css;
exports.minJS = minJS;
exports.srcJS = srcJS;
exports.lint = lint;
exports.default = parallel(html, css, minJS, series(lint, srcJS));
