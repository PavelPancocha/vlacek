let resident: ((frame: string) => string | undefined) | undefined;

/**
 * Installs the D-030 resident frame map: the published world/backdrop page
 * that holds a frame. RideScene sets it with its atlases and clears it
 * (undefined) when the scene is destroyed.
 */
export function setFrameResolver(
  resolver: ((frame: string) => string | undefined) | undefined,
): void {
  resident = resolver;
}

/**
 * Single world-frame page accessor for attachments, animations and particles.
 * A frame that is not resident falls back to the given texture, whose missing
 * frame the D-030 `world-part` diagnostics report.
 */
export function frameTexture(frame: string, fallbackTexture: string): string {
  return resident?.(frame) ?? fallbackTexture;
}
