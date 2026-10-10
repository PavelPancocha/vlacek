export default {
  '*': ['secretlint --no-glob', 'node scripts/check-file-sizes.ts'],
  '*.{ts,mjs}': 'eslint --max-warnings 0',
  '*.{ts,mjs,json,yml,yaml,md,css,html}': 'prettier --check',
  '*.md': () => 'npm run check:docs',
};
