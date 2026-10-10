import { artFileUrl } from '../content/artFiles.ts';
import { vehicleArtLayers } from '../content/artLayers.ts';
import { artParts, vehicleArt } from '../content/artManifest.ts';
import type { ShapedVehicle } from '../content/placeholderShapes.ts';
import { vehicleSvg } from './placeholderArt.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Depot and catalog picture of a vehicle (doc 14 §3): the same SVG parts
 * and the same layout as the ride, standing still. Each part stays its own
 * `<image>`, so the files' gradient ids never clash in the page. Vehicles
 * without art show their marked placeholder.
 */
export function vehiclePreview(
  vehicle: ShapedVehicle,
  pixelsPerU: number,
): SVGSVGElement {
  const art = vehicleArt[vehicle.id];
  if (!art) return vehicleSvg(vehicle, pixelsPerU);
  const length = vehicle.lengthU;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${length} ${art.heightU}`);
  svg.setAttribute('width', String(Math.round(length * pixelsPerU)));
  svg.setAttribute('height', String(Math.round(art.heightU * pixelsPerU)));
  svg.setAttribute('aria-hidden', 'true');
  for (const layer of vehicleArtLayers(art, length, 0)) {
    const part = artParts[layer.part];
    const image = document.createElementNS(SVG_NS, 'image');
    image.setAttribute('href', artFileUrl(part.file));
    image.setAttribute('width', String(part.widthU));
    image.setAttribute('height', String(part.heightU));
    // Pivot onto the layer position; layer coordinates are centred on the
    // rail, the preview's are from the frame's top left.
    image.setAttribute(
      'transform',
      `translate(${layer.x + length / 2} ${layer.y + art.heightU}) ` +
        `rotate(${(layer.rotation * 180) / Math.PI}) ` +
        `scale(1 ${layer.scaleY ?? 1}) ` +
        `translate(${-part.pivotU.x} ${-part.pivotU.y})`,
    );
    svg.append(image);
  }
  return svg;
}
