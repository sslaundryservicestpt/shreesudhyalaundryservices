import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config({ ignores: ['**/out/**', '**/.next/**', '**/next-env.d.ts', '**/node_modules/**', '**/generated/**', 'output/**', '.local-checks/**', '.local-design-history/**'] }, js.configs.recommended, ...tseslint.configs.recommended, { files: ['**/*.mjs'], languageOptions: { globals: { console: 'readonly', URL: 'readonly' } } }, { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } });
