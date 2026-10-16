/// <reference types="vite/client" />
/** Only URL strings enter the menu bundle; no MP3 bytes or requests before unlock. */
const urls = import.meta.glob<string>('../../assets/audio/*.mp3', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
});
export function audioFileUrl(file: string): string {
  const url = urls[`../../assets/audio/${file}`];
  if (url === undefined) throw new Error(`Missing audio file: ${file}`);
  return url;
}
