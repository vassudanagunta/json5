'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _util = require('./util');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var source = void 0;
var parseState = void 0;
var stack = void 0;
var pos = void 0;
var line = void 0;
var column = void 0;
var token = void 0;
var key = void 0;
var root = void 0;

function parse(text, reviver) {
    source = String(text);
    parseState = 'start';
    stack = [];
    pos = 0;
    line = 1;
    column = 0;
    token = undefined;
    key = undefined;
    root = undefined;

    do {
        token = lex();

        // This code is unreachable.
        // if (!parseStates[parseState]) {
        //     throw invalidParseState()
        // }

        parseStates[parseState]();
    } while (token.type !== 'eof');

    if (typeof reviver === 'function') {
        return internalize({ '': root }, '', reviver);
    }

    return root;
}

function internalize(holder, name, reviver) {
    var value = holder[name];
    if (value != null && (typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object') {
        for (var _key in value) {
            var replacement = internalize(value, _key, reviver);
            if (replacement === undefined) {
                delete value[_key];
            } else {
                value[_key] = replacement;
            }
        }
    }

    return reviver.call(holder, name, value);
}

var lexState = void 0;
var buffer = void 0;
var doubleQuote = void 0;
var _sign = void 0;
var c = void 0;

function lex() {
    lexState = 'default';
    buffer = '';
    doubleQuote = false;
    _sign = 1;

    for (;;) {
        c = peek();

        // This code is unreachable.
        // if (!lexStates[lexState]) {
        //     throw invalidLexState(lexState)
        // }

        var _token = lexStates[lexState]();
        if (_token) {
            return _token;
        }
    }
}

function peek() {
    if (source[pos]) {
        return String.fromCodePoint(source.codePointAt(pos));
    }
}

function read() {
    var c = peek();

    if (c === '\n') {
        line++;
        column = 0;
    } else if (c) {
        column += c.length;
    } else {
        column++;
    }

    if (c) {
        pos += c.length;
    }

    return c;
}

var lexStates = {
    default: function _default() {
        switch (c) {
            case '\t':
            case '\v':
            case '\f':
            case ' ':
            case '\xA0':
            case '\uFEFF':
            case '\n':
            case '\r':
            case '\u2028':
            case '\u2029':
                read();
                return;

            case '/':
                read();
                lexState = 'comment';
                return;

            case undefined:
                return newToken('eof');
        }

        if (_util2.default.isSpaceSeparator(c)) {
            read();
            return;
        }

        // This code is unreachable.
        // if (!lexStates[parseState]) {
        //     throw invalidLexState(parseState)
        // }

        return lexStates[parseState]();
    },
    comment: function comment() {
        switch (c) {
            case '*':
                read();
                lexState = 'multiLineComment';
                return;

            case '/':
                read();
                lexState = 'singleLineComment';
                return;
        }

        throw invalidChar(read());
    },
    multiLineComment: function multiLineComment() {
        switch (c) {
            case '*':
                lexState = 'multiLineCommentAsterisk';
                break;

            case undefined:
                throw invalidChar(read());
        }

        read();
    },
    multiLineCommentAsterisk: function multiLineCommentAsterisk() {
        if (c === undefined) {
            throw invalidChar(read());
        }

        read();
        lexState = c === '/' ? 'default' : 'multiLineComment';
    },
    singleLineComment: function singleLineComment() {
        switch (c) {
            case '\n':
            case '\r':
            case '\u2028':
            case '\u2029':
                lexState = 'default';
                break;

            case undefined:
                return newToken('eof');
        }

        read();
    },
    value: function value() {
        switch (c) {
            case '{':
            case '[':
                return newToken('punctuator', read());

            case 'n':
                read();
                literal('ull');
                return newToken('null', null);

            case 't':
                read();
                literal('rue');
                return newToken('boolean', true);

            case 'f':
                read();
                literal('alse');
                return newToken('boolean', false);

            case '-':
            case '+':
                if (read() === '-') {
                    _sign = -1;
                }

                lexState = 'sign';
                return;

            case '.':
                buffer = read();
                lexState = 'decimalPointLeading';
                return;

            case '0':
                buffer = read();
                lexState = 'zero';
                return;

            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                buffer = read();
                lexState = 'decimalInteger';
                return;

            case 'I':
                read();
                literal('nfinity');
                return newToken('numeric', Infinity);

            case 'N':
                read();
                literal('aN');
                return newToken('numeric', NaN);

            case '"':
            case "'":
                doubleQuote = read() === '"';
                buffer = '';
                lexState = 'string';
                return;
        }

        throw invalidChar(read());
    },
    identifierNameStartEscape: function identifierNameStartEscape() {
        if (c !== 'u') {
            throw invalidChar(read());
        }

        read();
        var u = unicodeEscape();
        switch (u) {
            case '$':
            case '_':
                break;

            default:
                if (!_util2.default.isIdStartChar(u)) {
                    throw invalidIdentifier();
                }

                break;
        }

        buffer += u;
        lexState = 'identifierName';
    },
    identifierName: function identifierName() {
        switch (c) {
            case '$':
            case '_':
            case '\u200C':
            case '\u200D':
                buffer += read();
                return;

            case '\\':
                read();
                lexState = 'identifierNameEscape';
                return;
        }

        if (_util2.default.isIdContinueChar(c)) {
            buffer += read();
            return;
        }

        return newToken('identifier', buffer);
    },
    identifierNameEscape: function identifierNameEscape() {
        if (c !== 'u') {
            throw invalidChar(read());
        }

        read();
        var u = unicodeEscape();
        switch (u) {
            case '$':
            case '_':
            case '\u200C':
            case '\u200D':
                break;

            default:
                if (!_util2.default.isIdContinueChar(u)) {
                    throw invalidIdentifier();
                }

                break;
        }

        buffer += u;
        lexState = 'identifierName';
    },
    sign: function sign() {
        switch (c) {
            case '.':
                buffer = read();
                lexState = 'decimalPointLeading';
                return;

            case '0':
                buffer = read();
                lexState = 'zero';
                return;

            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                buffer = read();
                lexState = 'decimalInteger';
                return;

            case 'I':
                read();
                literal('nfinity');
                return newToken('numeric', _sign * Infinity);
        }

        throw invalidChar(read());
    },
    zero: function zero() {
        switch (c) {
            case '.':
                buffer += read();
                lexState = 'decimalPoint';
                return;

            case 'e':
            case 'E':
                buffer += read();
                lexState = 'decimalExponent';
                return;

            case 'x':
            case 'X':
                buffer += read();
                lexState = 'hexadecimal';
                return;
        }

        return newToken('numeric', 0);
    },
    decimalInteger: function decimalInteger() {
        switch (c) {
            case '.':
                buffer += read();
                lexState = 'decimalPoint';
                return;

            case 'e':
            case 'E':
                buffer += read();
                lexState = 'decimalExponent';
                return;
        }

        if (_util2.default.isDigit(c)) {
            buffer += read();
            return;
        }

        return newToken('numeric', _sign * Number(buffer));
    },
    decimalPointLeading: function decimalPointLeading() {
        if (_util2.default.isDigit(c)) {
            buffer += read();
            lexState = 'decimalFraction';
            return;
        }

        throw invalidChar(read());
    },
    decimalPoint: function decimalPoint() {
        switch (c) {
            case 'e':
            case 'E':
                buffer += read();
                lexState = 'decimalExponent';
                return;
        }

        if (_util2.default.isDigit(c)) {
            buffer += read();
            lexState = 'decimalFraction';
            return;
        }

        return newToken('numeric', _sign * Number(buffer));
    },
    decimalFraction: function decimalFraction() {
        switch (c) {
            case 'e':
            case 'E':
                buffer += read();
                lexState = 'decimalExponent';
                return;
        }

        if (_util2.default.isDigit(c)) {
            buffer += read();
            return;
        }

        return newToken('numeric', _sign * Number(buffer));
    },
    decimalExponent: function decimalExponent() {
        switch (c) {
            case '+':
            case '-':
                buffer += read();
                lexState = 'decimalExponentSign';
                return;
        }

        if (_util2.default.isDigit(c)) {
            buffer += read();
            lexState = 'decimalExponentInteger';
            return;
        }

        throw invalidChar(read());
    },
    decimalExponentSign: function decimalExponentSign() {
        if (_util2.default.isDigit(c)) {
            buffer += read();
            lexState = 'decimalExponentInteger';
            return;
        }

        throw invalidChar(read());
    },
    decimalExponentInteger: function decimalExponentInteger() {
        if (_util2.default.isDigit(c)) {
            buffer += read();
            return;
        }

        return newToken('numeric', _sign * Number(buffer));
    },
    hexadecimal: function hexadecimal() {
        if (_util2.default.isHexDigit(c)) {
            buffer += read();
            lexState = 'hexadecimalInteger';
            return;
        }

        throw invalidChar(read());
    },
    hexadecimalInteger: function hexadecimalInteger() {
        if (_util2.default.isHexDigit(c)) {
            buffer += read();
            return;
        }

        return newToken('numeric', _sign * Number(buffer));
    },
    string: function string() {
        switch (c) {
            case '\\':
                read();
                buffer += escape();
                return;

            case '"':
                if (doubleQuote) {
                    read();
                    return newToken('string', buffer);
                }

                buffer += read();
                return;

            case "'":
                if (!doubleQuote) {
                    read();
                    return newToken('string', buffer);
                }

                buffer += read();
                return;

            case '\n':
            case '\r':
                throw invalidChar(read());

            case '\u2028':
            case '\u2029':
                separatorChar(c);
                break;

            case undefined:
                throw invalidChar(read());
        }

        buffer += read();
    },
    start: function start() {
        switch (c) {
            case '{':
            case '[':
                return newToken('punctuator', read());

            // This code is unreachable since the default lexState handles eof.
            // case undefined:
            //     return newToken('eof')
        }

        lexState = 'value';
    },
    beforePropertyName: function beforePropertyName() {
        switch (c) {
            case '$':
            case '_':
                buffer = read();
                lexState = 'identifierName';
                return;

            case '\\':
                read();
                lexState = 'identifierNameStartEscape';
                return;

            case '}':
                return newToken('punctuator', read());

            case '"':
            case "'":
                doubleQuote = read() === '"';
                lexState = 'string';
                return;
        }

        if (_util2.default.isIdStartChar(c)) {
            buffer += read();
            lexState = 'identifierName';
            return;
        }

        throw invalidChar(read());
    },
    afterPropertyName: function afterPropertyName() {
        if (c === ':') {
            return newToken('punctuator', read());
        }

        throw invalidChar(read());
    },
    beforePropertyValue: function beforePropertyValue() {
        lexState = 'value';
    },
    afterPropertyValue: function afterPropertyValue() {
        switch (c) {
            case ',':
            case '}':
                return newToken('punctuator', read());
        }

        throw invalidChar(read());
    },
    beforeArrayValue: function beforeArrayValue() {
        if (c === ']') {
            return newToken('punctuator', read());
        }

        lexState = 'value';
    },
    afterArrayValue: function afterArrayValue() {
        switch (c) {
            case ',':
            case ']':
                return newToken('punctuator', read());
        }

        throw invalidChar(read());
    },
    end: function end() {
        // This code is unreachable since it's handled by the default lexState.
        // if (c === undefined) {
        //     read()
        //     return newToken('eof')
        // }

        throw invalidChar(read());
    }
};

function newToken(type, value) {
    return {
        type: type,
        value: value,
        line: line,
        column: column
    };
}

function literal(s) {
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = s[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var _c = _step.value;

            var p = peek();

            if (p !== _c) {
                throw invalidChar(read());
            }

            read();
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
}

function escape() {
    var c = peek();
    switch (c) {
        case 'b':
            read();
            return '\b';

        case 'f':
            read();
            return '\f';

        case 'n':
            read();
            return '\n';

        case 'r':
            read();
            return '\r';

        case 't':
            read();
            return '\t';

        case 'v':
            read();
            return '\v';

        case '0':
            read();
            return '\0';

        case 'x':
            read();
            return hexEscape();

        case 'u':
            read();
            return unicodeEscape();

        case '\n':
        case '\u2028':
        case '\u2029':
            read();
            return '';

        case '\r':
            read();
            if (peek() === '\n') {
                read();
            }

            return '';

        case undefined:
            throw invalidChar(read());
    }

    return read();
}

function hexEscape() {
    var buffer = '';
    var c = peek();

    if (!_util2.default.isHexDigit(c)) {
        throw invalidChar(read());
    }

    buffer += read();

    c = peek();
    if (!_util2.default.isHexDigit(c)) {
        throw invalidChar(read());
    }

    buffer += read();

    return String.fromCodePoint(parseInt(buffer, 16));
}

function unicodeEscape() {
    var buffer = '';
    var count = 4;

    while (count-- > 0) {
        var _c2 = peek();
        if (!_util2.default.isHexDigit(_c2)) {
            throw invalidChar(read());
        }

        buffer += read();
    }

    return String.fromCodePoint(parseInt(buffer, 16));
}

var parseStates = {
    start: function start() {
        push();
    },
    beforePropertyName: function beforePropertyName() {
        switch (token.type) {
            case 'identifier':
            case 'string':
                key = token.value;
                parseState = 'afterPropertyName';
                return;

            case 'punctuator':
                // This code is unreachable since it's handled by the lexState.
                // if (token.value !== '}') {
                //     throw invalidToken()
                // }

                pop();
        }

        // This code is unreachable since it's handled by the lexState.
        // throw invalidToken()
    },
    afterPropertyName: function afterPropertyName() {
        // This code is unreachable since it's handled by the lexState.
        // if (token.type !== 'punctuator' || token.value !== ':') {
        //     throw invalidToken()
        // }

        parseState = 'beforePropertyValue';
    },
    beforePropertyValue: function beforePropertyValue() {
        push();
    },
    beforeArrayValue: function beforeArrayValue() {
        if (token.type === 'punctuator' && token.value === ']') {
            pop();
            return;
        }

        push();
    },
    afterPropertyValue: function afterPropertyValue() {
        // This code is unreachable since it's handled by the lexState.
        // if (token.type !== 'punctuator') {
        //     throw invalidToken()
        // }

        switch (token.value) {
            case ',':
                parseState = 'beforePropertyName';
                return;

            case '}':
                pop();
        }

        // This code is unreachable since it's handled by the lexState.
        // throw invalidToken()
    },
    afterArrayValue: function afterArrayValue() {
        // This code is unreachable since it's handled by the lexState.
        // if (token.type !== 'punctuator') {
        //     throw invalidToken()
        // }

        switch (token.value) {
            case ',':
                parseState = 'beforeArrayValue';
                return;

            case ']':
                pop();
        }

        // This code is unreachable since it's handled by the lexState.
        // throw invalidToken()
    },
    end: function end() {
        // This code is unreachable since it's handled by the lexState.
        // if (token.type !== 'eof') {
        //     throw invalidToken()
        // }
    }
};

function push() {
    var value = void 0;

    switch (token.type) {
        case 'punctuator':
            switch (token.value) {
                case '{':
                    value = {};
                    break;

                case '[':
                    value = [];
                    break;
            }

            break;

        case 'null':
        case 'boolean':
        case 'numeric':
        case 'string':
            value = token.value;
            break;

        // This code is unreachable.
        // default:
        //     throw invalidToken()
    }

    if (root === undefined) {
        root = value;
    } else {
        var parent = stack[stack.length - 1];
        if (Array.isArray(parent)) {
            parent.push(value);
        } else {
            parent[key] = value;
        }
    }

    if (value !== null && (typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object') {
        stack.push(value);

        if (Array.isArray(value)) {
            parseState = 'beforeArrayValue';
        } else {
            parseState = 'beforePropertyName';
        }
    } else {
        var current = stack[stack.length - 1];
        if (current == null) {
            parseState = 'end';
        } else if (Array.isArray(current)) {
            parseState = 'afterArrayValue';
        } else {
            parseState = 'afterPropertyValue';
        }
    }
}

function pop() {
    stack.pop();

    var current = stack[stack.length - 1];
    if (current == null) {
        parseState = 'end';
    } else if (Array.isArray(current)) {
        parseState = 'afterArrayValue';
    } else {
        parseState = 'afterPropertyValue';
    }
}

// This code is unreachable.
// function invalidParseState () {
//     return new Error(`JSON5: invalid parse state '${parseState}'`)
// }

// This code is unreachable.
// function invalidLexState (state) {
//     return new Error(`JSON5: invalid lex state '${state}'`)
// }

function invalidChar(c) {
    if (c === undefined) {
        return syntaxError('JSON5: invalid end of input at ' + line + ':' + column);
    }

    return syntaxError('JSON5: invalid character \'' + formatChar(c) + '\' at ' + line + ':' + column);
}

// This code is unreachable.
// function invalidToken () {
//     if (token.type === 'eof') {
//         return syntaxError(`JSON5: invalid end of input at ${line}:${column}`)
//     }

//     const c = String.fromCodePoint(token.value.codePointAt(0))
//     return syntaxError(`JSON5: invalid character '${formatChar(c)}' at ${line}:${column}`)
// }

function invalidIdentifier() {
    column -= 5;
    return syntaxError('JSON5: invalid identifier character at ' + line + ':' + column);
}

function separatorChar(c) {
    console.warn('JSON5: \'' + c + '\' is not valid ECMAScript; consider escaping');
}

function formatChar(c) {
    var replacements = {
        "'": "\\'",
        '"': '\\"',
        '\b': '\\b',
        '\f': '\\f',
        '\n': '\\n',
        '\r': '\\r',
        '\t': '\\t',
        '\v': '\\v',
        '\0': '\\0',
        '\u2028': '\\u2028',
        '\u2029': '\\u2029'
    };

    if (replacements[c]) {
        return replacements[c];
    }

    if (c < ' ') {
        var hexString = c.charCodeAt(0).toString(16);
        return '\\x' + ('00' + hexString).substring(hexString.length);
    }

    return c;
}

function syntaxError(message) {
    var err = new SyntaxError(message);
    err.lineNumber = line;
    err.columnNumber = column;
    return err;
}

exports.default = module.exports = parse;