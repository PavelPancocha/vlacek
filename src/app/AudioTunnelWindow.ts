import { tunnelSite } from '../domain/world/Structures.ts';
import { gameConfig } from '../config/gameConfig.ts';

/** Audio coverage uses the retained track window, including duplicate long-tunnel sites. */
export class AudioTunnelWindow {
  #seed: number | undefined;
  #first = NaN;
  #last = NaN;
  readonly #tunnels: { fromX: number; toX: number }[] = [];
  update(
    seed: number,
    first: number,
    last: number,
  ): readonly { fromX: number; toX: number }[] {
    const tunnels = this.#tunnels;
    if (seed === this.#seed && first === this.#first && last === this.#last)
      return tunnels;
    this.#seed = seed;
    this.#first = first;
    this.#last = last;
    tunnels.length = 0;
    for (let k = first; k <= last; k++) {
      const tunnel = tunnelSite(seed, k);
      if (!tunnel) continue;
      const fromX = k * gameConfig.world.chunkWidthU + tunnel.fromX;
      if (!tunnels.some((range) => range.fromX === fromX))
        tunnels.push({
          fromX,
          toX: k * gameConfig.world.chunkWidthU + tunnel.toX,
        });
    }
    return tunnels;
  }
}
