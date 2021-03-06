const util = require('./util')

module.exports = function stringify (value, replacer, space, circularRefHandler) {
    const stack = []
    const keyStack = []
    let indent = ''
    let propertyList
    let replacerFunc
    let gap = ''
    let quote
    let noES6string

    // check if `replacer` is really an `options` object instead
    // and take the arguments from there if it is.
    if (
        replacer != null &&
        typeof replacer === 'object' &&
        !Array.isArray(replacer)
    ) {
        space = replacer.space
        quote = replacer.quote
        noES6string = replacer.noES6StringOutput
        circularRefHandler = replacer.circularRefHandler
        replacer = replacer.replacer
    }

    if (typeof replacer === 'function') {
        replacerFunc = replacer
    } else if (Array.isArray(replacer)) {
        propertyList = []
        for (const v of replacer) {
            let item

            if (typeof v === 'string') {
                item = v
            } else if (
                typeof v === 'number' ||
                v instanceof String ||
                v instanceof Number
            ) {
                item = String(v)
            }

            if (item !== undefined && propertyList.indexOf(item) < 0) {
                propertyList.push(item)
            }
        }
    }

    if (space instanceof Number) {
        space = Number(space)
    } else if (space instanceof String) {
        space = String(space)
    }

    if (typeof space === 'number') {
        if (space > 0) {
            space = Math.min(10, Math.floor(space))
            gap = '          '.substr(0, space)
        }
    } else if (typeof space === 'string') {
        gap = space.substr(0, 10)
    }

    return serializeProperty('', {'': value})

    function serializeProperty (key, holder) {
        let value = holder[key]
        if (value != null) {
            if (typeof value.toJSON5 === 'function') {
                value = value.toJSON5(key)
            } else if (typeof value.toJSON === 'function') {
                value = value.toJSON(key)
            }
        }

        if (replacerFunc) {
            value = replacerFunc.call(holder, key, value)
        }

        if (value instanceof Number) {
            value = Number(value)
        } else if (value instanceof String) {
            value = String(value)
        } else if (value instanceof Boolean) {
            value = value.valueOf()
        }

        switch (value) {
        case null: return 'null'
        case true: return 'true'
        case false: return 'false'
        }

        if (typeof value === 'string') {
            if (noES6string) {
                return quoteString(value)
            } else {
                return quoteStringES6(value)
            }
        }

        if (typeof value === 'number') {
            return String(value)
        }

        if (typeof value === 'object') {
            if (value instanceof Error) {
                const ex = {
                    message: value.message,
                    // stack: value.stack,
                    name: value.name,
                }
                const exKeys = Object.keys(value)
                for (const exKey of exKeys) {
                    ex[exKey] = value[exKey]
                }
                value = ex
            } else if (value instanceof RegExp) {
                const re = {
                    re: String(value),
                    source: value.source,
                    flags: value.flags,
                }
                const exKeys = Object.keys(value)
                for (const exKey of exKeys) {
                    re[exKey] = value[exKey]
                }
                value = re
            }

            const circusPos = stack.indexOf(value)
            if (circusPos >= 0) {
                const err = new TypeError('converting circular structure to JSON5')
                if (typeof circularRefHandler === 'function') {
                    // The user callback MAY introduce another circular ref (unwanted) to serialize:
                    // we cope with it by temporarily switching out the callback, while we
                    // serialize the produce.
                    const newValue = circularRefHandler(value, circusPos, stack.slice(0) /* snapshot */, keyStack.slice(0) /* snapshot */, key, err)
                    const oldF = circularRefHandler
                    circularRefHandler = (value, circusPos, stack, keyStack, key, err) => '[!circular ref inside circularRefHandler!]'
                    const rv = serializeProperty('', {'': newValue})
                    circularRefHandler = oldF
                    return rv
                } else {
                    throw err
                }
            }

            return Array.isArray(value) ? serializeArray(value, key) : serializeObject(value, key)
        }

        return undefined
    }

    function quoteStringES6 (value) {
        // When a string contains multiline content, consider printing it as
        // an ES6 template string instead.
        // Ditto for strings with lots of characters which require escaping.
        const eolRe = /[\r\n]/g
        const regularReplacementsRe = /['"]/g
        // NOTE: we are intentionally inaccurate with the regexes
        // here as these only serve as heauristics assistants and we do not want
        // to skew preference for ES6style output for strings which array a lot
        // of \x00-\x1f characters besides CR/LF as those strings would be formatted
        // to a *shorter* string in the classic JSON5 string format!
        const es6ReplacementHeuristicRe = /[`]/g
        const es6ReplacementRe = /[\\`\x00-\x08\x0b\x0c\x0e-\x1f\u2028\u2029]/g // eslint-disable-line no-control-regex
        // table of character substitutions
        const metaES6 = {
            '\b': '\\b', // \b = U+0008
            '\f': '\\f', // \f = U+000C
            '\v': '\\v', // \v = U+000B
            '`': '\\`',
            '\\': '\\\\',
        }

        // apply heuristic to the decision:
        let es6style = false
        const l1 = value.split(eolRe)
        const l2 = value.split(regularReplacementsRe)
        const l3 = value.split(es6ReplacementHeuristicRe)

        es6style = (l1.length >= 3)
        if (!es6style) {
            es6style = (l3.length < l2.length - 2)
        }
        if (!es6style) {
            return quoteString(value)
        }
        return '`' + value.replace(es6ReplacementRe, function (a) {
            var c = metaES6[a]
            return typeof c === 'string'
                ? c
                : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4)
        }) + '`'
    }

    function quoteString (value) {
        const quotes = {
            "'": 0.1,
            '"': 0.2,
        }

        const replacements = {
            "'": "\\'",
            '"': '\\"',
            '\\': '\\\\',
            '\b': '\\b',
            '\f': '\\f',
            '\n': '\\n',
            '\r': '\\r',
            '\t': '\\t',
            '\v': '\\v',
            '\0': '\\0',
            '\u2028': '\\u2028',
            '\u2029': '\\u2029',
        }

        let product = ''

        for (const c of value) {
            switch (c) {
            case "'":
            case '"':
                quotes[c]++
                product += c
                continue
            }

            if (replacements[c]) {
                product += replacements[c]
                continue
            }

            if (c < ' ') {
                const hexString = c.charCodeAt(0).toString(16)
                product += '\\x' + ('00' + hexString).substring(hexString.length)
                continue
            }

            product += c
        }

        const quoteChar = quote || Object.keys(quotes).reduce((a, b) => (quotes[a] < quotes[b]) ? a : b)

        product = product.replace(new RegExp(quoteChar, 'g'), replacements[quoteChar])

        return quoteChar + product + quoteChar
    }

    function serializeObject (value, key) {
        stack.push(value)
        keyStack.push(key)

        const stepback = indent
        indent = indent + gap

        const keys = propertyList || Object.keys(value)
        const partial = []
        for (const key of keys) {
            const propertyString = serializeProperty(key, value)
            if (propertyString !== undefined) {
                let member = serializeKey(key) + ':'
                if (gap !== '') {
                    member += ' '
                }
                member += propertyString
                partial.push(member)
            }
        }

        let final
        if (partial.length === 0) {
            final = '{}'
        } else {
            let properties
            if (gap === '') {
                properties = partial.join(',')
                final = '{' + properties + '}'
            } else {
                const separator = ',\n' + indent
                properties = partial.join(separator)
                final = '{\n' + indent + properties + ',\n' + stepback + '}'
            }
        }

        keyStack.pop()
        stack.pop()
        indent = stepback
        return final
    }

    function serializeKey (key) {
        if (key.length === 0) {
            return quoteString(key, true)
        }

        const firstChar = String.fromCodePoint(key.codePointAt(0))
        if (!util.isIdStartChar(firstChar)) {
            return quoteString(key, true)
        }

        for (let i = firstChar.length; i < key.length; i++) {
            if (!util.isIdContinueChar(String.fromCodePoint(key.codePointAt(i)))) {
                return quoteString(key, true)
            }
        }

        return key
    }

    function serializeArray (value, key) {
        stack.push(value)
        keyStack.push(key)

        const stepback = indent
        indent = indent + gap

        const partial = []
        for (let i = 0; i < value.length; i++) {
            const propertyString = serializeProperty(String(i), value)
            partial.push((propertyString !== undefined) ? propertyString : 'null')
        }

        let final
        if (partial.length === 0) {
            final = '[]'
        } else {
            if (gap === '') {
                const properties = partial.join(',')
                final = '[' + properties + ']'
            } else {
                const separator = ',\n' + indent
                const properties = partial.join(separator)
                final = '[\n' + indent + properties + ',\n' + stepback + ']'
            }
        }

        keyStack.pop()
        stack.pop()
        indent = stepback
        return final
    }
}
