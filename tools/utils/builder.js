const fs = require("fs");
const path = require("path");
const chalk = require("chalk").default;
const { sync } = require("glob");
const { $ } = require('./process');

function build(cp) {
    const movePatterns = [
        './package.json',
        './README.md',
        './CHANGELOG.md',
        './LICENSE'
    ];

    if (fs.existsSync('./build')) {
        fs.rmdirSync('./build', { recursive: true });
    }

    $('pnpm tsc --build');

    if (cp) {
        for (let i = 0; i < cp.length; i++) {
            movePatterns.push(cp[i]);
        }
    }

    for (let i = 0; i < movePatterns.length; i++) {
        const files = sync(movePatterns[i]);
        files.forEach(item => {
            const t = path.relative('.', path.resolve('./build', item));
            fs.mkdirSync(path.dirname(t), { recursive: true });
            fs.copyFileSync(item, t);
            console.log(item, '->', t);
        });
    }
    console.log(chalk.bold.green('[build]: copy file finished.'));
}

exports.build = build;
