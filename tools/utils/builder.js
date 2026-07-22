import { existsSync, rmSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve, dirname } from 'node:path';
import chalk from 'chalk';
import { sync } from 'glob';
import { $ } from './process.js';
import { rollup } from './dts-rollup.js';

export function build(cp, release, typeOnly) {
    if (existsSync('./build')) {
        rmSync('./build', { recursive: true });
    }

    $(`pnpm tsc -b ${typeOnly ? '--emitDeclarationOnly' : ''}`);

    const movePatterns = ['./package.json', './README.md', './CHANGELOG.md', './LICENSE', ...(cp ?? [])];
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
    const distPackageJsonPath = relative('.', resolve('./build', './package.json'));
    delete packageJson.typeOnlyExports;
    delete packageJson.devDependencies;
    delete packageJson.scripts;
    delete packageJson.release;
    writeFileSync(distPackageJsonPath, JSON.stringify(packageJson, undefined, 2));
    console.log(chalk.bold.green('[build]: package.json prepared.'));

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
