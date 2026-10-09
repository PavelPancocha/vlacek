import type { WorldConfig } from '../../config/gameConfig.ts';
import {
  arcAtX,
  buildArcLengthTable,
  sampleArcLengthTable,
  type ArcLengthTable,
  type TrackSample,
} from './ArcLengthTable.ts';
import type { TrackProfile } from './TrackProfile.ts';

/** Persistent track position: chunk identity + offset along its curve. */
export interface TrackCursor {
  chunkIndex: number;
  arcOffsetU: number;
}

interface WindowChunk {
  index: number;
  table: ArcLengthTable;
  /** Window-local arc coordinate of the chunk start. */
  startS: number;
}

export interface WindowChange {
  added: number[];
  removed: number[];
}

/**
 * Contiguous chunks of track geometry kept for the simulation corridor
 * (doc 04 §8). Window-local `s` is measured along the curve from the start of
 * the anchor chunk; persistence uses {@link TrackCursor}, never `s`.
 */
export class TrackWindow {
  readonly #source: (chunkIndex: number) => TrackProfile;
  readonly #world: WorldConfig;
  readonly #chunks: WindowChunk[] = [];

  constructor(
    source: (chunkIndex: number) => TrackProfile,
    anchorChunkIndex: number,
    world: WorldConfig,
  ) {
    if (!Number.isSafeInteger(anchorChunkIndex)) {
      throw new RangeError(`Invalid chunk index ${anchorChunkIndex}`);
    }
    this.#source = source;
    this.#world = world;
    this.#chunks.push({
      index: anchorChunkIndex,
      table: this.#build(anchorChunkIndex),
      startS: 0,
    });
  }

  #build(index: number): ArcLengthTable {
    return buildArcLengthTable(
      this.#source(index),
      index,
      this.#world.chunkWidthU,
      this.#world.arcSampleSpacingU,
    );
  }

  #first(): WindowChunk {
    const chunk = this.#chunks[0];
    if (!chunk) throw new Error('TrackWindow is empty');
    return chunk;
  }

  #last(): WindowChunk {
    const chunk = this.#chunks[this.#chunks.length - 1];
    if (!chunk) throw new Error('TrackWindow is empty');
    return chunk;
  }

  get firstChunkIndex(): number {
    return this.#first().index;
  }

  get lastChunkIndex(): number {
    return this.#last().index;
  }

  get chunkCount(): number {
    return this.#chunks.length;
  }

  get startS(): number {
    return this.#first().startS;
  }

  get endS(): number {
    const last = this.#last();
    return last.startS + last.table.lengthU;
  }

  /**
   * Makes geometry exist for [fromS, toS] and drops chunks that lie wholly
   * behind `fromS` (the tail of the whole consist minus its margin).
   */
  ensureRange(fromS: number, toS: number): WindowChange {
    const change: WindowChange = { added: [], removed: [] };
    while (this.endS < toS) {
      const index = this.lastChunkIndex + 1;
      this.#chunks.push({
        index,
        table: this.#build(index),
        startS: this.endS,
      });
      change.added.push(index);
    }
    while (this.startS > fromS) {
      const index = this.firstChunkIndex - 1;
      const table = this.#build(index);
      this.#chunks.unshift({
        index,
        table,
        startS: this.startS - table.lengthU,
      });
      change.added.push(index);
    }
    while (this.#chunks.length > 1) {
      const first = this.#first();
      if (first.startS + first.table.lengthU >= fromS) break;
      this.#chunks.shift();
      change.removed.push(first.index);
    }
    return change;
  }

  #locate(s: number): WindowChunk {
    if (!(s >= this.startS && s <= this.endS)) {
      throw new RangeError(
        `s=${s} is outside the track window [${this.startS}, ${this.endS}]`,
      );
    }
    let low = 0;
    let high = this.#chunks.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if ((this.#chunks[middle]?.startS ?? Infinity) <= s) low = middle;
      else high = middle - 1;
    }
    const chunk = this.#chunks[low];
    if (!chunk) throw new RangeError(`No chunk for s=${s}`);
    return chunk;
  }

  #chunk(index: number): WindowChunk {
    const chunk = this.#chunks[index - this.firstChunkIndex];
    if (!chunk || chunk.index !== index) {
      throw new RangeError(`Chunk ${index} is not in the track window`);
    }
    return chunk;
  }

  sample(s: number): TrackSample {
    const chunk = this.#locate(s);
    return sampleArcLengthTable(chunk.table, s - chunk.startS);
  }

  cursorAt(s: number): TrackCursor {
    const chunk = this.#locate(s);
    return { chunkIndex: chunk.index, arcOffsetU: s - chunk.startS };
  }

  sAt(cursor: TrackCursor): number {
    return this.#chunk(cursor.chunkIndex).startS + cursor.arcOffsetU;
  }

  chunkStartS(chunkIndex: number): number {
    return this.#chunk(chunkIndex).startS;
  }

  /** Converts a chunk-local x (e.g. `spawnLocalXU`) to arc coordinate `s`. */
  sFromLocalX(chunkIndex: number, localXU: number): number {
    const chunk = this.#chunk(chunkIndex);
    return (
      chunk.startS +
      arcAtX(chunk.table, chunkIndex * this.#world.chunkWidthU + localXU)
    );
  }
}
