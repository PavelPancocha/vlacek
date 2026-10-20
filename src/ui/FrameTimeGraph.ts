import { FRAME_PHASES, type FramePacing } from '../platform/FrameStats.ts';
const COLORS = [
  '#35bdda',
  '#ffae42',
  '#ae7ee8',
  '#60ce72',
  '#f880ad',
  '#eeeeee',
  '#ee6666',
  '#6d9bff',
];
/** One fixed DOM canvas. No textures/uploads, snapshots or allocations while drawing. */
export class FrameTimeGraph {
  readonly #canvas = document.createElement('canvas');
  readonly #context: CanvasRenderingContext2D | null;
  #lastDraw = -Infinity;
  constructor(
    parent: HTMLElement,
    readonly pacing: FramePacing,
  ) {
    this.#canvas.width = 320;
    this.#canvas.height = 76;
    this.#canvas.id = 'frame-time-graph';
    this.#canvas.setAttribute(
      'aria-label',
      'Čas snímků: vodítka 16,7 / 33,3 / 50 ms. Oranžová trať, zelená objekty, růžová zvuk, červená save.',
    );
    Object.assign(this.#canvas.style, {
      position: 'absolute',
      left: '8px',
      top: '64px',
      width: '320px',
      height: '76px',
      maxWidth: '90vw',
      pointerEvents: 'none',
      zIndex: '20',
    });
    this.#context = this.#canvas.getContext('2d');
    parent.append(this.#canvas);
  }
  draw(nowMs: number, visible: boolean): void {
    this.#canvas.hidden = !visible;
    if (!visible || nowMs - this.#lastDraw < 100 || !this.#context) return;
    this.#lastDraw = nowMs;
    const ctx = this.#context;
    ctx.fillStyle = '#12202bce';
    ctx.fillRect(0, 0, 320, 76);
    const count = this.pacing.size,
      start = Math.max(0, count - 320);
    for (let i = start; i < count; i++) {
      const ms = this.pacing.value(i, 2);
      let dominant = 0,
        cost = 0;
      for (let p = 0; p < FRAME_PHASES.length; p++) {
        const next = this.pacing.value(Math.max(0, i - 1), 6 + p);
        if (next > cost) {
          cost = next;
          dominant = p;
        }
      }
      ctx.fillStyle =
        ms > this.pacing.longThresholdMs
          ? (COLORS[dominant] ?? '#ffffff')
          : '#6595a6';
      const height = Math.min(64, ms * 0.8);
      ctx.fillRect(i - start, 76 - height, 1, height);
    }
    ctx.fillStyle = '#ffffff70';
    ctx.fillRect(0, 76 - 16.7 * 0.8, 320, 1);
    ctx.fillRect(0, 76 - 33.3 * 0.8, 320, 1);
    ctx.fillRect(0, 36, 320, 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.fillText('16.7 / 33.3 / 50 ms', 4, 11);
  }
  dispose(): void {
    this.#canvas.remove();
  }
}
