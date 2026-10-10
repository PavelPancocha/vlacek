/**
 * Distance from a pantograph's base along the vehicle's "up" axis to the
 * contact wire (doc 03 §9). `base` is in render coordinates (y down) and
 * `angleRad` the vehicle's world angle; up is then (−sin, −cos). The wire
 * height (world, up) is read where the head actually touches it, refined
 * a few times since the head leans with the roof. Pure.
 */
export function pantographReachU(
  base: { x: number; y: number },
  angleRad: number,
  wireHeightU: (x: number) => number,
): number {
  const sin = Math.sin(angleRad);
  const cos = Math.cos(angleRad);
  let reach = 0;
  for (let i = 0; i < 4; i++)
    reach = (base.y + wireHeightU(base.x - reach * sin)) / cos;
  return reach;
}
