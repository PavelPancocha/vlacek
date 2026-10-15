/** Attachment motion is driven exclusively by the existing simulation clock. */
export function settlementAttachmentAngle(
  kind: string,
  timeSec: number,
  phase: number,
  winter: boolean,
  wave: boolean,
  motion: number,
): number {
  if (kind === 'back.playground-swing')
    return winter ? 0 : 0.055 * Math.sin(timeSec * 1.7 + phase * 6) * motion;
  if (wave && (timeSec + phase * 30) % 30 < 2)
    return -2.15 + 0.12 * Math.sin(timeSec * 4) * motion;
  return 0.015 * Math.sin(timeSec + phase * 6) * motion;
}
