import { defineConfig } from 'oxlint';

export default defineConfig({
    env: {
        browser: true,
        node: true,
        es2026: true,
    },
    ignorePatterns: [
        'crates/**',
        '**/build/**',
        '**/dist/**',
        '**/wasm/**',
        '**/bin/**',
        '**/scripts/**',
        '**/*.impl.ts',
        '**/draco-loader/*.js',
    ],
    rules: {
        'no-console': 'off',
        'guard-for-in': 'off',
        'no-shadow': 'off',
        'no-use-before-define': 'off',
        'typescript/prefer-for-of': 'off',
        'no-loss-of-precision': 'off',
        'no-unused-expressions': [
            'deny',
            {
                allowShortCircuit: true,
                allowTernary: true,
            },
        ],
        'unicorn/no-new-array': 'off',
        'no-extra-boolean-cast': 'off',
        'typescript/no-this-alias': 'off',
        'typescript/no-duplicate-enum-values': 'off',
        'erasing-op': 'off',
    },
});
