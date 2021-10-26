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
  SequenceExpression,
  ContinueStatement
} = esprima.Syntax;

function isGettextCall(callExpression) {
  return callExpression.callee.type === Identifier &&
    callExpression.callee.name === GETTEXT_FUNCTION_NAME;
}

const GETTEXT_FUNCTION_NAME = '__';
function findTranslationCalls(expression) {
  if (expression === null) {
    return [];
  }

  switch (expression.type) {
    case ExpressionStatement:
      return findTranslationCalls(expression.expression);
    case VariableDeclaration:
      return expression.declarations
        .map(findTranslationCalls)
        .flat();
    case VariableDeclarator:
      return findTranslationCalls(expression.init);
    case AssignmentPattern:
    case AssignmentExpression:
      return findTranslationCalls(expression.right);
    case ArrowFunctionExpression:
    case FunctionDeclaration:
    case FunctionExpression:
      return expression.params
        .map(findTranslationCalls)
        .concat(findTranslationCalls(expression.body))
        .flat();
    case ClassBody:
    case BlockStatement:
      return expression.body
        .map(findTranslationCalls)
        .flat();
    case NewExpression:
      return expression.arguments
        .map(findTranslationCalls)
        .concat(findTranslationCalls(expression.callee))
        .flat();
    case CallExpression:
      if (isGettextCall(expression)) {
        if (expression.arguments.length !== 1) {
          throw new Error(`Invalid call to gettext: expected exactly one argument: ${expression}`);
        }

        return [expression];
      } else {
        return expression.arguments
          .map(findTranslationCalls)
          .concat(findTranslationCalls(expression.callee))
          .flat();
      }
    case WhileStatement:
      return [expression.test, expression.body]
        .map(findTranslationCalls)
        .flat();
    case ConditionalExpression:
    case IfStatement:
      return [expression.test, expression.consequent, expression.alternate]
        .map(findTranslationCalls)
        .flat();
    case ForStatement:
      return [expression.init, expression.test, expression.update, expression.body]
        .map(findTranslationCalls)
        .flat();
    case ForOfStatement:
    case ForInStatement:
      return [expression.right, expression.body]
        .map(findTranslationCalls)
        .flat();
    case SwitchStatement:
      return expression.cases
        .map(findTranslationCalls)
        .concat(findTranslationCalls(expression.discriminant))
        .flat();
    case SwitchCase:
      return expression.consequent
        .map(findTranslationCalls)
        .flat();
    case ClassDeclaration:
      return findTranslationCalls(expression.body);
    case LogicalExpression:
    case BinaryExpression:
      return [expression.left, expression.right]
        .map(findTranslationCalls)
        .flat();
    case ObjectPattern:
    case ObjectExpression:
      return expression.properties
        .map(findTranslationCalls)
        .flat();
    case Property:
      return findTranslationCalls(expression.value);
    case ThrowStatement:
    case ReturnStatement:
    case AwaitExpression:
    case RestElement:
    case SpreadElement:
      return findTranslationCalls(expression.argument);
    case ArrayExpression:
      return expression.elements
        .map(findTranslationCalls)
        .flat();
    case TryStatement:
    case CatchClause:
      return findTranslationCalls(expression.block);
    case TemplateLiteral:
    case SequenceExpression:
      return expression.expressions
        .map(findTranslationCalls)
        .flat();
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
      return [];
    default:
      console.debug(`Unknown expression type: ${expression.type}`);
      console.debug(expression);
      return [];
  }
}

module.exports.findTranslationCalls = findTranslationCalls;
module.exports.contract = (s, size) => s.slice(size, -size);
module.exports.shave = (s, size) => module.exports.contract(s, size).trim();
