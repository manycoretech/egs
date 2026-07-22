import { existsSync, rmSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve, dirname } from 'node:path';
import chalk from 'chalk';
import { sync } from 'glob';
import { $ } from './process.js';
import { rollup } from './dts-rollup.js';
import { applyCatalogs, resolveCatalogs } from './catalogs.js';

const workspace =
    $('git rev-parse --show-superproject-working-tree', undefined, false).trim() ||
    resolve($('pnpm root -w', undefined, false).trim(), '../');

export function build(cp, release, typeOnly) {
    if (existsSync('./build')) {
        rmSync('./build', { recursive: true });
    }

    const catalogs = resolveCatalogs(workspace);

    $(`pnpm tsc -b ${typeOnly ? '--emitDeclarationOnly' : ''}`);

    const movePatterns = ['./README.md', './CHANGELOG.md', './LICENSE', ...(cp ?? [])];
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
    const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
    const typeOnlyExports = packageJson.typeOnlyExports;
    delete packageJson.typeOnlyExports;
    delete packageJson.devDependencies;
    delete packageJson.scripts;
    delete packageJson.release;

    applyCatalogs(packageJson, ['dependencies', 'peerDependencies', 'optionalDependencies'], catalogs);

    writeFileSync(relative('.', resolve('./build', './package.json')), JSON.stringify(packageJson, undefined, 2));
    console.log(chalk.bold.green('[build]: package.json for publish written.'));

    if (release) {
        rollup(
            process.cwd(),
            typeOnlyExports
                ? {
                      typeOnlyExports,
                  }
                : undefined,
        );
    }
}
