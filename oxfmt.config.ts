import { defineConfig } from 'oxfmt';

export default defineConfig({
    printWidth: 120,
    singleQuote: true,
    quoteProps: 'as-needed',
    trailingComma: 'all',
    arrowParens: 'avoid',
    endOfLine: 'lf',
    sortPackageJson: false,
    bracketSpacing: true,
    ignorePatterns: [
        'crates/**',
        '**/build/**',
        '**/dist/**',
        '**/*.impl.ts',
        '**/*.cmake',
        '**/*.txt',
        '**/wasm/**',
        '**/zstd-wasm/*.{js,d.ts}',
        '**/draco-loader/*.js',
        '**/sort-wasm/*.{js,d.ts}',
        '.clang-format',
        '.clang-tidy',
    ],
});
