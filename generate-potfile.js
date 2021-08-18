const fs = require('fs');
const PO = require('pofile');
const esprima = require('esprima');

const {
  AssignmentExpression,
  AssignmentPattern,
  FunctionExpression,
  ExpressionStatement,
  BlockStatement,
  CallExpression,
  IfStatement,
  BinaryExpression,
  StaticMemberExpression,
  ComputedMemberExpression,
  Identifier,
  ForInStatement,
  MemberExpression,
  ClassDeclaration,
  ClassBody,
  VariableDeclaration,
  VariableDeclarator,
  ThisExpression,
  ArrowFunctionExpression,
  LogicalExpression,
  ReturnStatement,
  ObjectExpression,
  Property,
  SpreadElement,
  Literal,
  ArrayExpression,
  ForStatement,
  UpdateExpression,
  NewExpression,
  UnaryExpression,
  FunctionDeclaration,
  TemplateLiteral,
  ConditionalExpression,
  SwitchStatement,
  SwitchCase,
  TryStatement,
  CatchClause,
  RestElement,
  ObjectPattern,
  BreakStatement,
  ForOfStatement,
  AwaitExpression,
  WhileStatement,
  ThrowStatement,
  ContinueStatement
} = esprima.Syntax;

const PEBBLE_FILES = [
  'resources/public/pebble_templates/index.html',
  'resources/public/pebble_templates/faq.html',
  'resources/public/pebble_templates/info.html',
  'resources/public/pebble_templates/profile.html',
  'resources/public/pebble_templates/40x.html'
];

const PEBBLE_COMMENT_MATCH = /{([#])((?!\1}).)*\1}/g;
const PEBBLE_CODE_MATCH = /{([%])((?!\1}).)*\1}|{{((?!}}).)*}}/g;

const I18N_MATCH = /i18n\s*[(]/g;
// a string matching regex, handles escapes and escaped escapes.
const STRING_MATCH = /(["'])((\\{2})*|(.*?[^\\](\\{2})*))\1/g;

const contract = (s, size) => s.slice(size, -size);
const shave = (s, size) => contract(s, size).trim();

const poFiles = new Map();

let stringCount = 0;

const offsetToLine = (text, offset) => Array.from(text.slice(0, offset).matchAll('\n')).length;
const globalOffsetToLocal = (text, offset) => offset - text.slice(0, offset).lastIndexOf('\n');

const itemsByIdByPofile = new Map();

function createPoFile(name) {
  const poFile = new PO();
  poFile.headers['Project-Id-Version'] = 'Pxls';
  poFile.headers['POT-Creation-Date'] = (new Date()).toISOString();
  // "Better written as…" no it's not - look at the context.
  /* eslint-disable-next-line dot-notation */
  poFile.headers['Language'] = '';
  poFile.headers['Content-Type'] = 'text/plain; charset=UTF-8';

  itemsByIdByPofile.set(name, new Map());
  poFiles.set(name, poFile);
}

for (const path of PEBBLE_FILES) {
  const file = fs.readFileSync(path).toString();

  const commentsByLine = new Map();

  const comments = file.matchAll(PEBBLE_COMMENT_MATCH);

  for (const comment of comments) {
    const line = offsetToLine(file, comment.index);
    if (!commentsByLine.has(line)) {
      commentsByLine.set(line, []);
    }
    commentsByLine.get(line).push(shave(comment[0], 2));
  }

  const sections = file.matchAll(PEBBLE_CODE_MATCH);

  for (const section of sections) {
    const sectionOffset = section.index;
    const sectionLine = offsetToLine(file, section.index);

    const gettextCalls = section[0].matchAll(I18N_MATCH);

    for (const call of gettextCalls) {
      const callOffset = sectionOffset + call.index;
      const callLine = sectionLine + offsetToLine(section[0], call.index);
      const callLocalOffset = globalOffsetToLocal(file, callOffset);

      const params = [];

      let depth = 1;
      let callLength;

      for (let i = call.index + 5; i < section[0].length; i++) {
        let char = section[0][i];

        if (char === '\'' || char === '"') {
          const match = section[0].slice(i - 1).matchAll(STRING_MATCH).next();
          if (match.done) {
            throw new Error(`Template file is incorrect (unterminated string) at ${callLine}:${callLocalOffset}`);
          }
          i += match.value[0].length;
          params.push(contract(match.value[0], 1).replaceAll('\\\'', '\''));

          char = section[0][i];
        }

        if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            // Since we can calculate this, it's worth having
            // even if we don't currently use it.
            /* eslint-disable-next-line no-unused-vars */
            callLength = i;
            break;
          }
        }
      }

      const [poFileName, id] = params;

      if (!poFiles.has(poFileName)) {
        createPoFile(poFileName);
      }

      const poFile = poFiles.get(poFileName);

      const itemsById = itemsByIdByPofile.get(poFileName);

      if (!itemsById.has(id)) {
        stringCount++;
        const item = new PO.Item();
        itemsById.set(id, item);
        poFile.items.push(item);
      }

      const item = itemsById.get(id);

      item.msgid = id;
      item.references.push(`${path}:${callLine + 1}:${callLocalOffset + 1}`);

      if (commentsByLine.has(callLine - 1)) {
        item.extractedComments.push(...commentsByLine.get(callLine - 1));
      }

      if (commentsByLine.has(callLine)) {
        item.extractedComments.push(...commentsByLine.get(callLine));
      }
    }
  }
}

// TODO: maybe just use ttag instead?

const JS_FILES = [
  'resources/public/pxls.js',
  'resources/public/include/ban.js',
  'resources/public/include/board.js',
  'resources/public/include/chat.js',
  'resources/public/include/chromeOffsetWorkaround.js',
  'resources/public/include/coords.js',
  'resources/public/include/grid.js',
  'resources/public/include/helpers.js',
  'resources/public/include/lookup.js',
  'resources/public/include/modal.js',
  'resources/public/include/nativeNotifications.js',
  'resources/public/include/notifications.js',
  'resources/public/include/overlays.js',
  'resources/public/include/panels.js',
  'resources/public/include/place.js',
  'resources/public/include/query.js',
  'resources/public/include/serviceworkers.js',
  'resources/public/include/settings.js',
  'resources/public/include/socket.js',
  'resources/public/include/storage.js',
  'resources/public/include/template.js',
  'resources/public/include/timer.js',
  'resources/public/include/typeahead.js',
  'resources/public/include/uiHelper.js',
  'resources/public/include/user.js',
  'resources/public/admin/admin.js'
];

const GETTEXT_FUNCTION_NAME = '__';
const JS_POFILE = 'Localization';

function isGettextCall(callExpression) {
  return callExpression.callee.type === Identifier &&
    callExpression.callee.name === GETTEXT_FUNCTION_NAME;
}

const translatableStrings = [];

function addTranslatableStringsFromExpression(expression) {
  if (expression === null) {
    return;
  }

  switch (expression.type) {
    case ExpressionStatement:
      addTranslatableStringsFromExpression(expression.expression);
      break;
    case VariableDeclaration:
      for (const declaration of expression.declarations) {
        addTranslatableStringsFromExpression(declaration);
      }
      break;
    case VariableDeclarator:
      addTranslatableStringsFromExpression(expression.init);
      break;
    case AssignmentPattern:
    case AssignmentExpression:
      addTranslatableStringsFromExpression(expression.right);
      break;
    case ArrowFunctionExpression:
    case FunctionDeclaration:
    case FunctionExpression:
      for (const parameter of expression.params) {
        addTranslatableStringsFromExpression(parameter);
      }
      addTranslatableStringsFromExpression(expression.body);
      break;
    case ClassBody:
    case BlockStatement:
      for (const nestedExpression of expression.body) {
        addTranslatableStringsFromExpression(nestedExpression);
      }
      break;
    case NewExpression:
      addTranslatableStringsFromExpression(expression.callee);
      for (const argument of expression.arguments) {
        addTranslatableStringsFromExpression(argument);
      }
      break;
    case CallExpression:
      if (isGettextCall(expression)) {
        if (expression.arguments.length !== 1) {
          throw new Error(`Invalid call to gettext: expected exactly one argument: ${expression}`);
        }

        const [argument] = expression.arguments;
        translatableStrings.push(argument.range);
      } else {
        addTranslatableStringsFromExpression(expression.callee);
        for (const argument of expression.arguments) {
          addTranslatableStringsFromExpression(argument);
        }
      }
      break;
    case WhileStatement:
      addTranslatableStringsFromExpression(expression.test);
      addTranslatableStringsFromExpression(expression.body);
      break;
    case ConditionalExpression:
    case IfStatement:
      addTranslatableStringsFromExpression(expression.test);
      addTranslatableStringsFromExpression(expression.consequent);
      addTranslatableStringsFromExpression(expression.alternate);
      break;
    case ForStatement:
      addTranslatableStringsFromExpression(expression.init);
      addTranslatableStringsFromExpression(expression.test);
      addTranslatableStringsFromExpression(expression.update);
      addTranslatableStringsFromExpression(expression.body);
      break;
    case ForOfStatement:
    case ForInStatement:
      addTranslatableStringsFromExpression(expression.right);
      addTranslatableStringsFromExpression(expression.body);
      break;
    case SwitchStatement:
      addTranslatableStringsFromExpression(expression.discriminant);
      for (const switchcase of expression.cases) {
        addTranslatableStringsFromExpression(switchcase);
      }
      break;
    case SwitchCase:
      for (const nestedExpression of expression.consequent) {
        addTranslatableStringsFromExpression(nestedExpression);
      }
      break;
    case ClassDeclaration:
      addTranslatableStringsFromExpression(expression.body);
      break;
    case LogicalExpression:
    case BinaryExpression:
      addTranslatableStringsFromExpression(expression.left);
      addTranslatableStringsFromExpression(expression.right);
      break;
    case ObjectPattern:
    case ObjectExpression:
      for (const property of expression.properties) {
        addTranslatableStringsFromExpression(property);
      }
      break;
    case Property:
      addTranslatableStringsFromExpression(expression.value);
      break;
    case ThrowStatement:
    case ReturnStatement:
    case AwaitExpression:
    case RestElement:
    case SpreadElement:
      addTranslatableStringsFromExpression(expression.argument);
      break;
    case ArrayExpression:
      for (const element of expression.elements) {
        addTranslatableStringsFromExpression(element);
      }
      break;
    case TryStatement:
    case CatchClause:
      addTranslatableStringsFromExpression(expression.block);
      break;
    case TemplateLiteral:
      for (const nestedExpression of expression.expressions) {
        addTranslatableStringsFromExpression(nestedExpression);
      }
      break;
    case ThisExpression:
    case MemberExpression:
    case ComputedMemberExpression:
    case StaticMemberExpression:
    case Identifier:
    case Literal:
    case UpdateExpression:
    case UnaryExpression:
    case BreakStatement:
    case ContinueStatement:
      break;
    default:
      console.debug(`Unknown expression type: ${expression.type}`);
      console.debug(expression);
  }
}

if (!poFiles.has(JS_POFILE)) {
  createPoFile(JS_POFILE);
}

const jsPoFile = poFiles.get(JS_POFILE);
const jsItemsById = itemsByIdByPofile.get(JS_POFILE);

const TRANSLATOR_COMMENT_REGEX = /^\s*translator:\s?(.*)$/i;

for (const path of JS_FILES) {
  const file = fs.readFileSync(path).toString();
  const script = esprima.parseScript(file, { range: true, comment: true });

  for (const expression of script.body) {
    addTranslatableStringsFromExpression(expression);
  }

  for (const [start, end] of translatableStrings) {
    const relevantComments = script.comments.filter(comment => {
      const [commentStart, commentEnd] = comment.range;

      if (!TRANSLATOR_COMMENT_REGEX.test(comment.value)) {
        return false;
      }

      if (commentEnd < start) {
        // before string

        const newlineCount = Array.from(file
          .substring(commentEnd, start)
          .matchAll('\n')).length;

        return newlineCount < 2;
      } else {
        // after string

        const hasNewline = file
          .substring(end, commentStart)
          .indexOf('\n') !== -1;

        return !hasNewline;
      }
    }).map(comment => TRANSLATOR_COMMENT_REGEX.exec(comment.value)[1]);

    const id = contract(file.substring(start, end), 1);
    const callLine = offsetToLine(file, start);
    const callLocalOffset = globalOffsetToLocal(file, start);

    if (!jsItemsById.has(id)) {
      stringCount++;
      const item = new PO.Item();
      jsItemsById.set(id, item);
      jsPoFile.items.push(item);
    }

    const item = jsItemsById.get(id);

    item.msgid = id;
    item.references.push(`${path}:${callLine + 1}:${callLocalOffset + 1}`);

    for (const comment of relevantComments) {
      item.extractedComments.push(comment);
    }
  }

  // clear the strings array
  // because none of this code is well-structured
  translatableStrings.splice(0);
}

for (const [name, poFile] of poFiles.entries()) {
  poFile.save(`po/${name}.pot`, e => e ? console.error : null);
}

console.info(`Parsed ${PEBBLE_FILES.length + JS_FILES.length} files.`);
console.info(`${stringCount} strings found.`);
console.info(`Output ${poFiles.size} files.`);
