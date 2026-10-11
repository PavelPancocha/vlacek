import type { QualityConfig } from '../config/gameConfig.ts';
import type { Settings } from '../platform/SaveValidation.ts';

/** The common display rate; a target at or above it needs no cap. */
const DISPLAY_FPS = 60;

/** What the renderer and the effects take from the player's settings. */
export interface RenderProfile {
  /** Upper bound of the render buffer density. */
  maxDpr: number;
  /** Frame rate cap, or 0 for none (the display's own rate). */
  fpsLimit: number;
  /** Decorative particles and motion (doc 07 §9). */
  effects: 'low' | 'standard';
}

/**
 * The quality profile of doc 13 for these settings: `low` lowers the
 * render density, the frame rate and the effects; reduced effects lower
 * only the effects.
 */
export function renderProfile(
  settings: Pick<Settings, 'quality' | 'reducedEffects'>,
  quality: QualityConfig,
): RenderProfile {
  const low = settings.quality === 'low';
  const profile = low ? quality.low : quality.standard;
  return {
    maxDpr: profile.maxDpr,
    // A cap at the display's own rate makes Phaser drop frames, so only a
    // lower target becomes a cap.
    fpsLimit: profile.targetFps < DISPLAY_FPS ? profile.targetFps : 0,
    effects: low || settings.reducedEffects ? 'low' : 'standard',
  };
}
