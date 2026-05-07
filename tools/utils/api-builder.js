#!/usr/bin/env node

const fse = require('node:fs');
const os = require('node:os');
const path = require('node:path')
const ts = require('typescript');
const prettier = require('prettier')

const templateRoot = path.resolve(__dirname, './template');

const configKeys = {
    target: 'target',
    type: 'type',
    onlyThrowUsefulError: 'onlyThrowUsefulError',
    invalidParameterEnabled: 'invalidParameterEnabled',
    invalidParameter: 'invalidParameter'
}


function generateOnlyThrowUsefulError(content) {
    return `try {
        ${content}
    } catch(e) {
        if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
            throw e;
        }
    }`;
}

function generateParameterCheck(parameters, template, enabledCheck) {
    const check = `if (${parameters.map(p => template.replace(/\$value/g, p.name)).join(' || ')}) {
        return;
    }`
    return enabledCheck ? `if (${enabledCheck}) { ${check} }` : check;
}

function generateCall(target, method, generateReturn) {
    return `${generateReturn ? 'return ' : ''}${target}?.${method.name}?.(${method.parameters.map(p => p.name).join(', ')});`;
}

function generateArrayCall(target, method) {
    return `const _l = ${target}.length;
    for (let _i = 0; _i < _l; _i++) {
        ${generateCall(`${target}[_i]`, method, false)}
    }`
}

function generateMethodBody(method, config) {
    const content = `
     ${method.parameters.length && config.invalidParameter ? generateParameterCheck(method.parameters, config.invalidParameter, config.invalidParameterEnabled) : ''}
     ${config.type === 'array' ? generateArrayCall(config.target, method) : generateCall(config.target, method, true)}
    `
    return config.onlyThrowUsefulError ? generateOnlyThrowUsefulError(content) : content;
}

function parseConfig(entry, template) {
    const pattern = new RegExp(`\\$\\{(${entry}.*)\\}`);
    const config = { entry, pattern };
    const result = pattern.exec(template);
    const configArray = result[1].split(';');
    configArray.shift();
    for (const e of configArray) {
        const data = e.split(':');
        switch (data[0]) {
            case configKeys.target:
            case configKeys.invalidParameterEnabled:
            case configKeys.invalidParameter:
            case configKeys.type:
                config[data[0]] = data[1]; break;
            case configKeys.onlyThrowUsefulError:
                config.onlyThrowUsefulError = true; break;
        }
    }
    return config;
}

function parseInterface(entry, sourceFile, parsedInterface) {
    if (parsedInterface[entry]) {
        return parsedInterface[entry];
    }
    sourceFile.forEachChild(ch => {
        if (ch.kind === ts.SyntaxKind.InterfaceDeclaration && ch.name.escapedText === entry) {
            let inherits = [];
            let parsed = {
                members: []
            };
            parsedInterface[entry] = parsed;
            if (ch.heritageClauses) {
                for (const inherit of ch.heritageClauses) {
                    inherits.push(parseInterface(inherit.types[0].expression.escapedText, sourceFile, parsedInterface))
                }
            }
            for (const inherit of inherits) {
                for (const member of inherit.members) {
                    parsed.members.push(member);
                }
            }
            for (const member of ch.members) {
                if (member.kind === ts.SyntaxKind.MethodSignature) {
                    const method = {
                        name: member.name.escapedText,
                        typeParameters: member.typeParameters?.map(t => t.getFullText(sourceFile)) ?? [],
                        parameters: []
                    };
                    for (const parameter of member.parameters) {
                        method.parameters.push({
                            name: parameter.name.escapedText,
                            optional: !!parameter.questionToken,
                            type: parameter.type.getText(sourceFile).trim()
                        })
                    }
                    parsed.members.push(method);
                }
            }
        }
    });
    return parsedInterface[entry];
}


function generate(target, entries) {
    const pathInfo = path.parse(target);
    const implName = `${pathInfo.name}.impl`
    let template = fse.readFileSync(path.join(templateRoot, `${implName}.template`), { encoding: 'utf-8' });
    const program = ts.createProgram([target], {});
    const sourceFile = program.getSourceFile(target);
    const prettierOptions = {
        printWidth: 120,
        tabWidth: 4,
        singleQuote: true,
        quoteProps: 'as-needed',
        trailingComma: 'all',
        arrowParens: 'avoid',
        endOfLine: 'auto',
        parser: 'typescript',
    };
    const parsedInterface = {};
    for (const entry of entries) {
        const config = parseConfig(entry, template);
        const data = parseInterface(entry, sourceFile, parsedInterface);
        const content = `{
        ${data.members.map(method => {
            return `${method.name}${method.typeParameters.length > 0 ? `<${method.typeParameters.join(', ')}>` : ''}(${method.parameters.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')}) {
                    ${generateMethodBody(method, config)}
                },`
        }).join(os.EOL)}
    };
    `
        template = template.replace(config.pattern, content);
    }

    prettier.format(template, prettierOptions).then(data => {
        fse.writeFileSync(path.join(pathInfo.dir, `${implName}.ts`), data);
    })
}

exports.generate = generate;
