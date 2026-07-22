import { existsSync, rmSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve, dirname } from 'node:path';
import chalk from 'chalk';
import { sync } from 'glob';
import { $ } from './process.js';
import { rollup } from './dts-rollup.js';

const workspaceRoot =
    $('git rev-parse --show-superproject-working-tree', undefined, false).trimEnd('\n') ||
    resolve(import.meta.dirname, '../../');

const publishDependencyFields = ['dependencies', 'peerDependencies', 'optionalDependencies'];

function resolveCatalogs() {
    const data = {};
    const result = {};
    let r = $('pnpm config get catalogs --location=project --json', workspaceRoot, false);
    if (r) {
        Object.assign(data, JSON.parse(r));
    } else {
        r = $('pnpm config get catalog --location=project --json', workspaceRoot, false);
        if (r) {
            Object.assign(data, JSON.parse(r));
        }
    }

    for (const key of Object.keys(data)) {
        if (typeof data[key] === 'string') {
            if (!result[key]) {
                result[key] = {};
            }
            result[key]['default'] = data[key];
        } else {
            const versions = data[key];
            for (const p of Object.keys(versions)) {
                if (!result[p]) {
                    result[p] = {};
                }
                result[p][`${key}`] = versions[p];
            }
        }
    }
    return result;
}

export function build(cp, release, typeOnly) {
    if (existsSync('./build')) {
        rmSync('./build', { recursive: true });
    }

    const catalogs = resolveCatalogs();

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

    // resolve catalog
    for (const field of publishDependencyFields) {
        const dependencies = packageJson[field];
        if (dependencies) {
            for (const p of Object.keys(dependencies)) {
                if (dependencies[p].startsWith('catalog:')) {
                    const version = dependencies[p].slice('catalog:'.length) || 'default';
                    dependencies[p] = catalogs[p][version];
                }
            }
        }
    }

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
