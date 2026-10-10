const SVG_NS = 'http://www.w3.org/2000/svg';

type IconName =
  | 'brake'
  | 'horn'
  | 'pause'
  | 'play'
  | 'soundOn'
  | 'soundOff'
  | 'build'
  | 'next'
  | 'back'
  | 'depart'
  | 'remove'
  | 'forward'
  | 'backward'
  | 'undo'
  | 'locomotive'
  | 'rotate'
  | 'check';

/** Own simple icons (24 × 24 paths), drawn as SVG elements, no files. */
const PATHS: Record<IconName, string[]> = {
  brake: ['M8 2h8l6 6v8l-6 6H8l-6-6V8z', 'M7 11h10v2H7z'],
  horn: [
    'M3 10h4l7-5v14l-7-5H3z',
    'M17 8c2 2 2 6 0 8l-1.4-1.4c1.2-1.2 1.2-4 0-5.2z',
  ],
  pause: ['M6 4h4v16H6z', 'M14 4h4v16h-4z'],
  play: ['M7 4l13 8-13 8z'],
  soundOn: [
    'M3 9h4l6-5v16l-6-5H3z',
    'M16 8c2 2 2 6 0 8l-1.4-1.4c1.2-1.2 1.2-4 0-5.2z',
  ],
  soundOff: [
    'M3 9h4l6-5v16l-6-5H3z',
    'M15 9l1.4-1.4L22 13.2 20.6 14.6z',
    'M20.6 7.6L22 9l-5.6 5.6L15 13.2z',
  ],
  build: [
    'M2 15h20v4H2z',
    'M4 8h8v7H4z',
    'M14 10h6v5h-6z',
    'M5 19a2 2 0 104 0',
    'M15 19a2 2 0 104 0',
  ],
  next: ['M4 11h11l-4-4 1.4-1.4L19 12l-6.6 6.4L11 17l4-4H4z'],
  back: ['M20 11H9l4-4-1.4-1.4L5 12l6.6 6.4L13 17l-4-4h11z'],
  depart: ['M5 3h2v18H5z', 'M7 4h12l-3 4 3 4H7z'],
  remove: [
    'M6 4.6L7.4 3.2 12 7.8l4.6-4.6L18 4.6 13.4 9.2 18 13.8l-1.4 1.4L12 10.6l-4.6 4.6L6 13.8l4.6-4.6z',
  ],
  forward: ['M15 5l-7 7 7 7-1.4 1.4L5.2 12l8.4-8.4z'],
  backward: ['M9 5l7 7-7 7 1.4 1.4 8.4-8.4-8.4-8.4z'],
  undo: ['M8 7V3L2 9l6 6v-4h6a4 4 0 010 8h-2v2h2a6 6 0 000-12z'],
  locomotive: [
    'M3 6h8v8H3z',
    'M11 9h9v5H11z',
    'M15 4h3v5h-3z',
    'M2 15h20v3H2z',
  ],
  rotate: [
    'M7 2h10v20H7z',
    'M9 4v16h6V4z',
    'M19 6a8 8 0 012 6h2l-3 4-3-4h2a6 6 0 00-1.5-4.5z',
  ],
  check: ['M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'],
};

export function icon(name: IconName, size = 40): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of PATHS[name]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'currentColor');
    svg.append(path);
  }
  return svg;
}
