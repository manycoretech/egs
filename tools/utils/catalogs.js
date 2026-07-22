import { $ } from './process.js';

export function resolveCatalogs(workspace) {
    const data = {};
    const result = {};
    let r = $('pnpm config get catalogs --location=project --json', workspace, false);
    if (r) {
        Object.assign(data, JSON.parse(r));
    } else {
        r = $('pnpm config get catalog --location=project --json', workspace, false);
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

export function applyCatalogs(
    packageJson,
    fields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'],
    catalogs = resolveCatalogs(),
) {
    for (const field of fields) {
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
}
