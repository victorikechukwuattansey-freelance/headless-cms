import importPlugin from 'eslint-plugin-import';

export default [
  {
    ignores: ['dist/**', '.expo/**', 'node_modules/**'],
  },
  {
    plugins: { import: importPlugin },
    rules: {
      'import/no-unresolved': 'off',
      'no-unused-vars': 'warn',
    },
  },
];