import {
  artParts,
  type ArtPart,
  type ArtPartKey,
  type VehicleArt,
} from './artManifest.ts';
import { steamGear } from './steamGear.ts';

/** One part of a vehicle drawing in its current pose. */
export interface PlacedPart {
  part: ArtPartKey;
  /**
   * Where the part's pivot goes, vehicle-local: u from the vehicle's middle
   * on the rail, x forward, y down (the frame the ride renderer rotates).
   */
  x: number;
  y: number;
  /** Clockwise on screen, radians. */
  rotation: number;
}

const parts: Readonly<Record<ArtPartKey, ArtPart>> = artParts;

/**
 * Parts of a vehicle in drawing order for a travelled distance: body,
 * wheels turned by distance / radius (doc 03 §3), rods driven by the main
 * wheel's crank, overlay. The ride and the depot previews both use it, so
 * they always show the same vehicle.
 */
export function vehicleArtLayers(
  art: VehicleArt,
  lengthU: number,
  distanceU: number,
): PlacedPart[] {
  const half = lengthU / 2;
  const layers: PlacedPart[] = [{ part: art.body, x: 0, y: 0, rotation: 0 }];
  for (const wheel of art.wheels) {
    const radius = parts[wheel.part].heightU / 2;
    layers.push({
      part: wheel.part,
      x: wheel.xU - half,
      y: -radius,
      rotation: distanceU / radius,
    });
  }
  const gear = art.steamGear;
  const main = gear ? art.wheels[gear.mainWheel] : undefined;
  if (gear && main) {
    const radius = parts[main.part].heightU / 2;
    const rod = parts[gear.connectingRod];
    const small = rod.endU ?? rod.pivotU;
    const pose = steamGear(
      {
        mainWheel: { x: main.xU - half, y: -radius },
        crankU: gear.crankU,
        connectingRodU: Math.hypot(
          small.x - rod.pivotU.x,
          small.y - rod.pivotU.y,
        ),
        guideY: gear.guideYU - art.heightU,
      },
      distanceU / radius,
    );
    layers.push(
      { part: gear.couplingRod, ...pose.crankPin, rotation: 0 },
      { part: gear.crosshead, ...pose.crosshead, rotation: 0 },
      {
        part: gear.connectingRod,
        ...pose.crankPin,
        rotation: pose.connectingRodAngle,
      },
    );
  }
  if (art.overlay) layers.push({ part: art.overlay, x: 0, y: 0, rotation: 0 });
  return layers;
}
