export default {
  '*.{ts,mjs}': 'eslint --max-warnings 0',
  '*.{ts,mjs,json,yml,yaml,md,css,html}': 'prettier --check',
  '*.md': () => 'npm run check:docs',
};
