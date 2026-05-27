import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import chalk from 'chalk';
import { sync } from 'glob';
import ts from 'typescript';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const genericParams = '<T = any, T1 = any, T2 = any, T3 = any, T4 = any, T5 = any, T6 = any, T7 = any, T8 = any, T9 = any>';
const identifierPattern = '[$A-Z_a-z][$0-9A-Z_a-z]*';
const identifierRegExp = new RegExp(`^${identifierPattern}$`);

function isExternalModuleName(moduleName) {
    return !moduleName.startsWith('.') && !path.isAbsolute(moduleName);
}

function toPosixPath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function getModuleStub(moduleStubs, moduleName) {
    let moduleStub = moduleStubs.get(moduleName);
    if (!moduleStub) {
        moduleStub = {
            defaultExport: false,
            names: new Set(),
            namespaces: new Map(),
        };
        moduleStubs.set(moduleName, moduleStub);
    }
    return moduleStub;
}

function addExportName(moduleStub, name) {
    if (identifierRegExp.test(name) && name !== 'default') {
        moduleStub.names.add(name);
    }
}

function addNamespaceMember(moduleStub, namespaceName, memberName) {
    if (!identifierRegExp.test(namespaceName) || !identifierRegExp.test(memberName)) {
        return;
    }

    moduleStub.names.delete(namespaceName);

    let members = moduleStub.namespaces.get(namespaceName);
    if (!members) {
        members = new Set();
        moduleStub.namespaces.set(namespaceName, members);
    }
    members.add(memberName);
}

function getQualifiedNameParts(ts, node) {
    if (ts.isIdentifier(node)) {
        return [node.text];
    }
    if (ts.isQualifiedName(node)) {
        return [...getQualifiedNameParts(ts, node.left), node.right.text];
    }
    if (ts.isPropertyAccessExpression(node)) {
        return [...getQualifiedNameParts(ts, node.expression), node.name.text];
    }
    return [];
}

function collectExternalImports(ts, sourceFile, moduleStubs) {
    const importedLocals = new Map();

    function rememberLocal(localName, moduleName, exportName, namespaceImport = false) {
        importedLocals.set(localName, { moduleName, exportName, namespaceImport });
    }

    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
            continue;
        }

        if (!isExternalModuleName(statement.moduleSpecifier.text)) {
            continue;
        }

        const moduleName = statement.moduleSpecifier.text;
        const moduleStub = getModuleStub(moduleStubs, moduleName);
        const importClause = statement.importClause;
        if (importClause?.name) {
            moduleStub.defaultExport = true;
        }

        const namedBindings = importClause?.namedBindings;
        if (namedBindings && ts.isNamespaceImport(namedBindings)) {
            rememberLocal(namedBindings.name.text, moduleName, '*', true);
        } else if (namedBindings && ts.isNamedImports(namedBindings)) {
            for (const element of namedBindings.elements) {
                const exportName = (element.propertyName || element.name).text;
                addExportName(moduleStub, exportName);
                rememberLocal(element.name.text, moduleName, exportName);
            }
        }
    }

    return importedLocals;
}

function rewriteImportEqualsAliases(ts, content, aliases) {
    const aliasNames = [...aliases.keys()].map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const aliasDeclarationRegExp = new RegExp(`^\\s*import\\s+(${aliasNames})\\s*=\\s*(${identifierPattern}(?:\\.${identifierPattern})+)\\s*;\\r?\\n?`, 'gm');
    const contentWithoutAliasDeclarations = content.replace(
        aliasDeclarationRegExp,
        (line, aliasName, targetName) => aliases.get(aliasName) === targetName ? '' : line
    );

    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, contentWithoutAliasDeclarations);
    let output = '';
    let offset = 0;

    while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
        if (scanner.getToken() !== ts.SyntaxKind.Identifier) {
            continue;
        }

        const replacement = aliases.get(scanner.getTokenText());
        if (!replacement) {
            continue;
        }

        const start = scanner.getTokenPos();
        const end = scanner.getTextPos();
        output += contentWithoutAliasDeclarations.slice(offset, start) + replacement;
        offset = end;
    }

    return offset === 0
        ? contentWithoutAliasDeclarations
        : output + contentWithoutAliasDeclarations.slice(offset);
}

function collectExternalModuleStubsAndNormalizeDeclarations(projectDir) {
    const moduleStubs = new Map();
    const dtsFiles = sync('./build/**/*.d.ts', { cwd: projectDir, nodir: true })
        .filter(item => !toPosixPath(item).includes('/.api-extractor/'));

    for (const file of dtsFiles) {
        const filePath = path.resolve(projectDir, file);
        const sourceText = fs.readFileSync(filePath, 'utf8');
        const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
        const importedLocals = collectExternalImports(ts, sourceFile, moduleStubs);
        const aliases = new Map();

        function trackQualifiedName(node) {
            const parts = getQualifiedNameParts(ts, node);
            if (parts.length < 2) {
                return;
            }

            const imported = importedLocals.get(parts[0]);
            if (!imported) {
                return;
            }

            const moduleStub = getModuleStub(moduleStubs, imported.moduleName);
            if (imported.namespaceImport) {
                addExportName(moduleStub, parts[1]);
            } else {
                addNamespaceMember(moduleStub, imported.exportName, parts[1]);
            }
        }

        function visit(node) {
            if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
                const moduleName = node.moduleSpecifier.text;
                if (isExternalModuleName(moduleName)) {
                    const moduleStub = getModuleStub(moduleStubs, moduleName);
                    const exportClause = node.exportClause;
                    if (exportClause && ts.isNamedExports(exportClause)) {
                        for (const element of exportClause.elements) {
                            addExportName(moduleStub, (element.propertyName || element.name).text);
                        }
                    }
                }
            } else if (ts.isImportEqualsDeclaration(node)) {
                const parts = getQualifiedNameParts(ts, node.moduleReference);
                if (parts.length > 1 && importedLocals.has(parts[0])) {
                    aliases.set(node.name.text, parts.join('.'));
                }
                trackQualifiedName(node.moduleReference);
            } else if (ts.isExpressionWithTypeArguments(node)) {
                trackQualifiedName(node.expression);
            } else if (ts.isTypeQueryNode(node)) {
                trackQualifiedName(node.exprName);
            } else if (
                ts.isImportTypeNode(node) &&
                ts.isLiteralTypeNode(node.argument) &&
                ts.isStringLiteral(node.argument.literal)
            ) {
                const moduleName = node.argument.literal.text;
                if (isExternalModuleName(moduleName)) {
                    const moduleStub = getModuleStub(moduleStubs, moduleName);
                    if (node.qualifier) {
                        const parts = getQualifiedNameParts(ts, node.qualifier);
                        if (parts.length > 0) {
                            addExportName(moduleStub, parts[0]);
                        }
                        if (parts.length > 1) {
                            addNamespaceMember(moduleStub, parts[0], parts[1]);
                        }
                    }
                }
            } else if (ts.isTypeReferenceNode(node)) {
                trackQualifiedName(node.typeName);
            }

            ts.forEachChild(node, visit);
        }

        visit(sourceFile);

        if (aliases.size > 0) {
            fs.writeFileSync(filePath, rewriteImportEqualsAliases(ts, sourceText, aliases));
        }
    }

    return moduleStubs;
}

function renderModuleStub(moduleStub) {
    const lines = [
        '// Generated by egs-build for API Extractor only.',
        ''
    ];

    if (moduleStub.defaultExport) {
        lines.push('declare const _default: any;');
        lines.push('export default _default;');
    }

    for (const name of [...moduleStub.names].sort()) {
        lines.push(`export class ${name}${genericParams} {}`);
    }

    for (const [namespaceName, members] of [...moduleStub.namespaces.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        lines.push(`export namespace ${namespaceName} {`);
        for (const memberName of [...members].sort()) {
            lines.push(`    export class ${memberName}${genericParams} {}`);
        }
        lines.push('}');
    }

    return lines.join('\n');
}

function prepareApiExtractorTsconfig(projectDir) {
    const apiExtractorDir = path.resolve(projectDir, 'build/.api-extractor');
    fs.rmSync(apiExtractorDir, { recursive: true, force: true });
    fs.mkdirSync(apiExtractorDir, { recursive: true });
    const moduleStubs = collectExternalModuleStubsAndNormalizeDeclarations(projectDir);
    const externalModulePaths = {};

    for (const [moduleName, moduleStub] of moduleStubs) {
        const stubPath = path.resolve(apiExtractorDir, 'node_modules', ...moduleName.split('/'), 'index.d.ts');
        fs.mkdirSync(path.dirname(stubPath), { recursive: true });
        fs.writeFileSync(stubPath, renderModuleStub(moduleStub));
        externalModulePaths[moduleName] = [toPosixPath(path.relative(apiExtractorDir, stubPath))];
    }

    const tsconfig = {
        compilerOptions: {
            baseUrl: '.',
            paths: externalModulePaths,
            target: 'ESNext',
            module: 'ESNext',
            moduleResolution: 'bundler',
            strict: false,
            skipLibCheck: true,
            lib: ['ESNext', 'DOM'],
            types: [],
            ignoreDeprecations: '6.0'
        },
        files: [
            '../index.d.ts'
        ]
    };

    const tsconfigPath = path.resolve(apiExtractorDir, 'tsconfig.json');
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n');
    return tsconfigPath;
}

export function rollup(projectDir) {
    const apiExtractorConfigPath = path.resolve(__dirname, './api-extractor.json');
    const packageJsonFullPath = path.resolve(projectDir, 'package.json');
    const tsconfigFilePath = prepareApiExtractorTsconfig(projectDir);
    const projectRequire = createRequire(path.join(projectDir, 'package.json'));
    const configObject = ExtractorConfig.loadFile(apiExtractorConfigPath);
    configObject.projectFolder = projectDir;
    configObject.compiler.tsconfigFilePath = tsconfigFilePath;
    const extractorConfig = ExtractorConfig.prepare({
        configObject,
        configObjectFullPath: apiExtractorConfigPath,
        packageJsonFullPath,
    });
    const extractorResult = Extractor.invoke(extractorConfig, {
        showVerboseMessages: false,
        typescriptCompilerFolder: path.dirname(projectRequire.resolve('typescript/package.json')),
    });
    if (!extractorResult.succeeded) {
        throw new Error(
            `API Extractor failed with ${extractorResult.errorCount} errors ` +
            `and ${extractorResult.warningCount} warnings.`
        );
    }

    const rolledDts = extractorConfig.publicTrimmedFilePath;
    const rollupDtsContent = fs.readFileSync(rolledDts, 'utf8').replace(/<ArrayBufferLike>/g, '');
    fs.rmSync(path.dirname(rolledDts), { recursive: true });
    const removePatterns = [
        './build/**/*.d.ts',
        './build/**/*.d.ts.map',
        './build/tsconfig.tsbuildinfo',
    ];
    for (const pattern of removePatterns) {
        const files = sync(pattern, { cwd: projectDir, nodir: true });
        for (const file of files) {
            fs.rmSync(path.resolve(projectDir, file), { force: true });
        }
    }
    fs.writeFileSync(path.resolve(projectDir, 'build/index.d.ts'), rollupDtsContent);
    console.log(chalk.bold.green('[build]: api extractor finished.'));
}
