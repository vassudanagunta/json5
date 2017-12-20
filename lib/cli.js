'use strict';

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _minimist = require('minimist');

var _minimist2 = _interopRequireDefault(_minimist);

var _package = require('../package.json');

var _package2 = _interopRequireDefault(_package);

var _ = require('./');

var _2 = _interopRequireDefault(_);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var argv = (0, _minimist2.default)(process.argv.slice(2), {
    alias: {
        'convert': 'c',
        'space': 's',
        'validate': 'v',
        'out-file': 'o',
        'version': 'V',
        'help': 'h'
    },
    boolean: ['convert', 'validate', 'version', 'help'],
    string: ['space', 'out-file']
});

if (argv.version) {
    version();
} else if (argv.help) {
    usage();
} else {
    var inFilename = argv._[0];

    var readStream = void 0;
    if (inFilename) {
        readStream = _fs2.default.createReadStream(inFilename);
    } else {
        readStream = process.stdin;
    }

    var json5 = '';
    readStream.on('data', function (data) {
        json5 += data;
    });

    readStream.on('end', function () {
        var space = void 0;
        if (argv.space === 't' || argv.space === 'tab') {
            space = '\t';
        } else {
            space = Number(argv.space);
        }

        var value = void 0;
        try {
            value = _2.default.parse(json5);
            if (!argv.validate) {
                var json = JSON.stringify(value, null, space);

                var writeStream = void 0;

                // --convert is for backward compatibility with v0.5.1. If
                // specified with <file> and not --out-file, then a file with
                // the same name but with a .json extension will be written.
                if (argv.convert && inFilename && !argv.o) {
                    var outFilename = _path2.default.format(Object.assign(_path2.default.parse(inFilename), { ext: 'json' }));

                    writeStream = _fs2.default.createWriteStream(outFilename);
                } else if (argv.o) {
                    writeStream = _fs2.default.createWriteStream(argv.o);
                } else {
                    writeStream = process.stdout;
                }

                writeStream.write(json);
            }
        } catch (err) {
            console.error(err.message);
        }
    });
}

function version() {
    console.log(_package2.default.version);
}

function usage() {
    console.log('\n  Usage: json5 [options] <file>\n\n\n  Options:\n\n    -s, --space              The number of spaces to indent or \'t\' for tabs\n    -o, --out-file [file]    Outputs to the specified file\n    -v, --validate           Validate JSON5 but do not output JSON\n    -V, --version            Output the version number\n    -h, --help               Output usage information');
}