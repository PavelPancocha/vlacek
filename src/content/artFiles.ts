/**
 * Build URLs of the vehicle and world art files (doc 07 §2: art ships in the build,
 * no asset server). Vite fingerprints each file or inlines a small one.
 * Browser-only: Node tests and scripts read `assets/vehicles/` directly.
 */
const vehicleUrls = import.meta.glob<string>('../../assets/vehicles/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
});
const worldUrls = import.meta.glob<string>('../../assets/world/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
});

export function artFileUrl(file: string): string {
  const url = vehicleUrls[`../../assets/vehicles/${file}`];
  if (url === undefined) throw new Error(`vehicle art file ${file} missing`);
  return url;
}

export function worldFileUrl(file: string): string {
  const url = worldUrls[`../../assets/world/${file}`];
  if (url === undefined) throw new Error(`world art file ${file} missing`);
  return url;
}
