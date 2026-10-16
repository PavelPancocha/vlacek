import type { TextureMemory } from './TextureMemory.ts';
import type { AtlasMetrics } from './AtlasMetrics.ts';
import type { ArtSource } from './ArtAtlas.ts';
/** One disposable SVG bitmap at the required scale, derived from bundled bytes. */
export async function svgSource(
  part: ArtSource,
  pxPerU: number,
  signal: AbortSignal,
  text: string,
  metrics: AtlasMetrics | undefined,
  memory: TextureMemory,
  key: string,
) {
  const prepare = () =>
    URL.createObjectURL(
      new Blob([svgDocument(part, text, pxPerU)], { type: 'image/svg+xml' }),
    );
  const url = metrics
    ? metrics.measure('prepare', prepare, `source:${part.key}`)
    : prepare();
  const image = new Image();
  let bitmap: ImageBitmap | undefined;
  const bytes =
    Math.ceil(part.widthU * pxPerU) * Math.ceil(part.heightU * pxPerU) * 4;
  memory.set(key, { sources: bytes });
  // Native decode/bitmap work cannot be cancelled: an abort is honoured once it
  // settles, so its accounting and a late bitmap live until then. Detaching
  // src during decode() would leave that promise unsettled in Chromium.
  const release = () => {
    image.removeAttribute('src');
    bitmap?.close();
    memory.remove(key);
    URL.revokeObjectURL(url);
  };
  try {
    const load = () => {
      image.src = url;
      return image.decode();
    };
    await (metrics
      ? metrics.measure('prepare', load, `decode:${part.key}`)
      : load());
    signal.throwIfAborted();
    // decode() parses SVG but may defer expensive rasterisation to the first draw.
    const raster = () => createImageBitmap(image);
    // The bitmap is allocated while the decoded image still exists.
    memory.set(key, { sources: 2 * bytes });
    bitmap = await (metrics
      ? metrics.measure('prepare', raster, `bitmap:${part.key}`)
      : raster());
    image.removeAttribute('src');
    URL.revokeObjectURL(url);
    memory.set(key, { sources: bytes });
    signal.throwIfAborted();
    return { image: bitmap, release };
  } catch (error) {
    release();
    throw error;
  }
}

/** Sized SVG envelope preserves the source viewBox without reparsing its full tree. */
export function svgDocument(
  part: Pick<ArtSource, 'key' | 'widthU' | 'heightU'>,
  text: string,
  pxPerU: number,
): string {
  let source = text.trimStart().replace(/^<\?xml\s[\s\S]*?\?>\s*/, '');
  while (source.startsWith('<!--')) {
    const end = source.indexOf('-->');
    if (end < 0) throw new Error(`invalid SVG ${part.key}`);
    source = source.slice(end + 3).trimStart();
  }
  if (!/^<svg(?:\s|>|\/)/.test(source))
    throw new Error(`invalid SVG ${part.key}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(part.widthU * pxPerU)}" height="${Math.ceil(part.heightU * pxPerU)}" viewBox="0 0 ${part.widthU} ${part.heightU}">${source}</svg>`;
}
