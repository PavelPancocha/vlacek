/**
 * Steam locomotive motion (doc 14 §3): the coupling rod and the connecting
 * rod follow the crank pin of the turning wheels. Pure geometry in
 * vehicle-local render coordinates (x forward, y down, rail at y = 0),
 * testable without Phaser.
 */
export interface GearPoint {
  x: number;
  y: number;
}

export interface SteamGearGeometry {
  /** Centre of the driving wheel the connecting rod works on. */
  mainWheel: GearPoint;
  /** Crank pin distance from the wheel centre. */
  crankU: number;
  /** Connecting rod length, crank pin to crosshead. */
  connectingRodU: number;
  /** Height of the cylinder axis, along which the crosshead slides. */
  guideY: number;
}

export interface SteamGearPose {
  crankPin: GearPoint;
  /** Translation of the coupling rod from its rest (pin forward) pose. */
  couplingOffset: GearPoint;
  crosshead: GearPoint;
  /** Rotation of the connecting rod, from the pin towards the crosshead. */
  connectingRodAngle: number;
}

/**
 * Pose for a wheel turned by `wheelAngle` radians, clockwise on screen (the
 * same rotation the wheel image gets). The cylinder sits in front of the
 * main wheel, so the crosshead is always forward of the pin.
 */
export function steamGear(
  geometry: SteamGearGeometry,
  wheelAngle: number,
): SteamGearPose {
  const dx = geometry.crankU * Math.cos(wheelAngle);
  const dy = geometry.crankU * Math.sin(wheelAngle);
  const crankPin = {
    x: geometry.mainWheel.x + dx,
    y: geometry.mainWheel.y + dy,
  };
  const rise = geometry.guideY - crankPin.y;
  const run = Math.sqrt(
    Math.max(0, geometry.connectingRodU ** 2 - rise * rise),
  );
  const crosshead = { x: crankPin.x + run, y: geometry.guideY };
  return {
    crankPin,
    couplingOffset: { x: dx, y: dy },
    crosshead,
    connectingRodAngle: Math.atan2(rise, run),
  };
}
