/**
 * Build URLs of the vehicle art files (doc 07 §2: art ships in the build,
 * no asset server). Vite fingerprints each file or inlines a small one.
 * Browser-only: Node tests and scripts read `assets/vehicles/` directly.
 */
const urls = import.meta.glob<string>('../../assets/vehicles/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
});

export function artFileUrl(file: string): string {
  const url = urls[`../../assets/vehicles/${file}`];
  if (url === undefined) throw new Error(`vehicle art file ${file} missing`);
  return url;
}
