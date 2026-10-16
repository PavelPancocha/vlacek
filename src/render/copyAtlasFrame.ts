import type Phaser from 'phaser';
/** Copy already rasterised pixels; the source page stays owned until activation. */
export function copyAtlasFrame(
  scene: Phaser.Scene,
  oldKey: string,
  frameKey: string,
  destination: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  gpuCopy:
    | ((
        source: Phaser.Textures.Frame,
        x: number,
        y: number,
        width: number,
        height: number,
      ) => void)
    | undefined,
) {
  const source = scene.textures.getFrame(oldKey, frameKey);
  if (!source) throw new Error(`missing live frame ${frameKey}`);
  if (gpuCopy) gpuCopy(source, x, y, width, height);
  else {
    const image = scene.textures.get(oldKey).getSourceImage();
    if (!(image instanceof HTMLCanvasElement))
      throw new Error('atlas source is not a canvas');
    const context = destination.getContext('2d');
    if (!context) throw new Error('no 2D context');
    context.drawImage(
      image,
      source.cutX + 1,
      source.cutY + 1,
      width,
      height,
      x,
      y,
      width,
      height,
    );
  }
}
