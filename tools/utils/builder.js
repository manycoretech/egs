import { existsSync, rmSync, mkdirSync, copyFileSync } from 'fs';
import { relative, resolve, dirname } from 'path';
import chalk from 'chalk';
import { sync } from 'glob';
import { $ } from './process.js';
import { rollup } from './dts-rollup.js';

export function build(cp, release) {
    if (existsSync('./build')) {
        rmSync('./build', { recursive: true });
    }

    $('pnpm tsc -b');

    const movePatterns = [
        './package.json',
        './README.md',
        './CHANGELOG.md',
        './LICENSE',
        ...(cp ?? []),
    ];
    for (let i = 0; i < movePatterns.length; i++) {
        const files = sync(movePatterns[i]);
        files.forEach(item => {
            const t = relative('.', resolve('./build', item));
            mkdirSync(dirname(t), { recursive: true });
            copyFileSync(item, t);
            console.log(item, '->', t);
        });
    }
    console.log(chalk.bold.green('[build]: copy file finished.'));

    if (release) {
        rollup(process.cwd());
    }
}
