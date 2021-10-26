const { src, dest, parallel, series } = require('gulp');
const cleanCSS = require('gulp-clean-css');
const sourcemaps = require('gulp-sourcemaps');
const eslint = require('gulp-eslint');
const minify = require('gulp-minify');
const gulpIf = require('gulp-if');
const browserify = require('browserify');
const tap = require('gulp-tap');
const buffer = require('gulp-buffer');
const through = require('through2');
const esprima = require('esprima');
const PO = require('pofile');
const rename = require('gulp-rename');

const { findTranslationCalls, contract } = require('./localization-util');

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

function translate(pofile) {
  return through.obj(function(file, enc, callback) {
    if (file.isBuffer()) {
      PO.load(pofile, (error, pofile) => {
        if (error) {
          callback(error);
        } else {
          let contents = file.contents.toString();
          const script = esprima.parseScript(contents, { range: true });
          const translationCalls = script.body
            .map(findTranslationCalls)
            .flat()
            .sort((a, b) => a.range.start - b.range.start);

          let offset = 0;

          for (const call of translationCalls) {
            const [argument] = call.arguments;

            const [start, end] = call.range;
            const length = end - start;

            const original = contract(contents.substring(...argument.range.map(p => p + offset)), 1);
            const quote = contents[argument.range[0] + offset];

            const item = pofile.items.find(i => i.msgid === original);

            const replaceContent = (item && item.msgstr[0]) || original;
            const replace = quote + replaceContent.replace(new RegExp(`([^\\\\])([${quote}])`, 'g'), '$1\\$2') + quote;
            contents = contents.substring(0, offset + start) + replace + contents.substring(offset + end);
            offset += replace.length - length;
          }

          file.contents = Buffer.from(contents);

          callback(null, file);
        }
      });
    } else {
      callback(new Error('Expected buffer'));
    }
  });
}

function srcJS () {
  return src(['po/*.po'])
    .pipe(through.obj(function(file, enc, callback) {
      const codeIndex = file.basename.lastIndexOf('_');
      const extIndex = file.basename.lastIndexOf('.');
      const langcode = codeIndex === -1
        ? ''
        : file.basename.substring(codeIndex, extIndex === -1
          ? file.basename.length
          : extIndex);

      src([...SOURCE_FILES, '!resources/public/include/**/*.js', '!resources/public/profile/**/*.js'], { read: false })
        .pipe(tap(file => {
          file.contents = browserify(file.path, { debug: isDevEnvironment })
            .bundle();
        }))
        .pipe(buffer())
        .pipe(translate(file.path))
        .pipe(gulpIf(isDevEnvironment, sourcemaps.init({ loadMaps: true })))
        .pipe(minify({
          ext: {
            src: '.src.js',
            min: '.js'
          }
        }))
        .pipe(gulpIf(isDevEnvironment, sourcemaps.write()))
        .pipe(rename({ suffix: langcode }))
        .pipe(dest('target/classes/public'))
        .once('end', callback);
    }));
}

exports.html = html;
exports.css = css;
exports.minJS = minJS;
exports.srcJS = srcJS;
exports.lint = lint;
exports.default = parallel(html, css, minJS, series(lint, srcJS));
