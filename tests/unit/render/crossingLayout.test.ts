import { describe, expect, it } from 'vitest';
import {
  crossingPostAnchors,
  worldParts,
} from '../../../src/content/worldArt.ts';
import {
  FAR_STOP_LINE_U,
  NEAR_STOP_LINE_U,
  ROAD_CONFLICT_U,
  ROAD_FAR_END_U,
  ROAD_NEAR_END_U,
  TRACK_CONFLICT_U,
} from '../../../src/domain/interaction/LevelCrossing.ts';
import {
  NEAR_DEPTH_RANGE_U,
  NEAR_PROP_MAX_HEIGHT_U,
} from '../../../src/domain/world/Scenery.ts';
import {
  FAR_POST_ROAD_U,
  NEAR_POST_ROAD_U,
  POST_SIDE_GAP_U,
  ROAD_ACTOR_SCALE,
  boomAngle,
  laneOffsetU,
  redLampsLit,
  roadActorAlpha,
  roadHalfWidthU,
  roadPointY,
  roadScale,
  whiteLampLit,
} from '../../../src/render/crossingLayout.ts';

/** Height a near-meadow object may reach at a road position (D-013). */
const allowedNearHeight = (roadU: number) =>
  NEAR_PROP_MAX_HEIGHT_U + (roadU - ROAD_CONFLICT_U);

const frame = { railY: -100, meadowY: -60 };

describe('crossing road in the picture (doc 05 §4)', () => {
  it('runs from the horizon behind the track down past the meadow without a jump', () => {
    let previous = roadPointY(frame, ROAD_FAR_END_U);
    expect(previous).toBeCloseTo(frame.railY + ROAD_FAR_END_U, 9);
    for (let r = ROAD_FAR_END_U + 1; r <= ROAD_NEAR_END_U; r += 1) {
      const y = roadPointY(frame, r);
      expect(y).toBeGreaterThan(previous);
      expect(y - previous).toBeLessThan(2.5);
      previous = y;
    }
    // It crosses the track between the rail head and the bank foot.
    expect(roadPointY(frame, -ROAD_CONFLICT_U)).toBeLessThan(frame.railY);
    expect(roadPointY(frame, ROAD_CONFLICT_U)).toBeGreaterThan(frame.meadowY);
  });

  it('widens and grows towards the viewer like the meadow props', () => {
    expect(roadHalfWidthU(ROAD_FAR_END_U)).toBeLessThan(roadHalfWidthU(0));
    expect(roadHalfWidthU(ROAD_NEAR_END_U)).toBeGreaterThan(roadHalfWidthU(0));
    expect(roadScale(ROAD_FAR_END_U)).toBeLessThan(1);
    expect(roadScale(ROAD_CONFLICT_U)).toBeCloseTo(1, 9);
    const deep = ROAD_CONFLICT_U + NEAR_DEPTH_RANGE_U / 2;
    expect(roadScale(deep)).toBeCloseTo(1.25, 9);
  });

  it('is as wide at the track as the conflict zone of the train, with room for a car per lane', () => {
    expect(roadHalfWidthU(0)).toBe(TRACK_CONFLICT_U);
    // A car seen from the front (34 u at the art's scale) fits its lane.
    expect(roadHalfWidthU(0)).toBeGreaterThanOrEqual(30);
  });

  it('stands each barrier between its stop line and the track', () => {
    expect(-FAR_POST_ROAD_U).toBeGreaterThan(ROAD_CONFLICT_U);
    expect(-FAR_POST_ROAD_U).toBeLessThan(FAR_STOP_LINE_U);
    expect(NEAR_POST_ROAD_U).toBeGreaterThan(ROAD_CONFLICT_U);
    expect(NEAR_POST_ROAD_U).toBeLessThan(NEAR_STOP_LINE_U);
  });

  it('keeps the near post, its raised boom and the traffic in front below the train (doc 14 §2)', () => {
    const post = worldParts['crossing.post-low'];
    const hinge = crossingPostAnchors['crossing.post-low'].hinge;
    const boom = worldParts['crossing.boom'];
    const s = roadScale(NEAR_POST_ROAD_U);
    const allowed = allowedNearHeight(NEAR_POST_ROAD_U);
    expect(post.heightU * s).toBeLessThanOrEqual(allowed);
    const raised = boomAngle(0, 'right');
    const boomTop =
      (post.heightU - hinge.y) * s +
      (boom.widthU - boom.pivotU.x) * s * Math.abs(Math.sin(raised)) +
      (boom.heightU / 2) * s;
    expect(boomTop).toBeLessThanOrEqual(allowed);
    // Cars and bikes in front of the track, from its edge to the end.
    for (let r = ROAD_CONFLICT_U; r <= 320; r += 10)
      for (const key of ['road.car-a-front', 'road.bike-back'] as const)
        expect(
          worldParts[key].heightU * ROAD_ACTOR_SCALE * roadScale(r),
          `${key} at ${r}`,
        ).toBeLessThanOrEqual(allowedNearHeight(r));
  });

  it('closes each lane with its boom: from the post past the middle line, not beyond the road', () => {
    const boom = worldParts['crossing.boom'];
    const reach = boom.widthU - boom.pivotU.x;
    for (const r of [FAR_POST_ROAD_U, NEAR_POST_ROAD_U]) {
      const half = roadHalfWidthU(r);
      const hingeFromMiddle = half + POST_SIDE_GAP_U;
      expect(reach * roadScale(r), `at ${r}`).toBeGreaterThan(hingeFromMiddle);
      expect(reach * roadScale(r), `at ${r}`).toBeLessThan(
        hingeFromMiddle + half / 2,
      );
    }
  });

  it('lowers the booms flat and raises them nearly upright, both ways round', () => {
    expect(Math.cos(boomAngle(1, 'left'))).toBeCloseTo(1, 9);
    expect(Math.cos(boomAngle(1, 'right'))).toBeCloseTo(-1, 9);
    for (const side of ['left', 'right'] as const) {
      // Screen y grows downwards: up is a negative sine.
      expect(Math.sin(boomAngle(0, side))).toBeLessThan(-0.98);
      expect(Math.sin(boomAngle(0.5, side))).toBeLessThan(-0.5);
    }
  });

  it('drives towards the viewer on the left lane and away on the right', () => {
    for (const r of [-200, -40, 0, 40, 300]) {
      const half = roadHalfWidthU(r);
      expect(laneOffsetU(1, r)).toBeLessThan(0);
      expect(laneOffsetU(-1, r)).toBeGreaterThan(0);
      expect(Math.abs(laneOffsetU(1, r))).toBeLessThan(half);
      expect(Math.abs(laneOffsetU(-1, r))).toBeLessThan(half);
    }
  });

  it('fades traffic in and out at the ends of the road, never on the crossing', () => {
    expect(roadActorAlpha(ROAD_FAR_END_U)).toBeCloseTo(0, 9);
    expect(roadActorAlpha(ROAD_NEAR_END_U)).toBeCloseTo(0, 9);
    for (let r = -120; r <= 200; r += 5) expect(roadActorAlpha(r)).toBe(1);
  });

  it('flashes the red lamps in turn, never together, and blinks the white one', () => {
    let first = 0;
    let second = 0;
    let white = 0;
    for (let t = 0; t < 4; t += 1 / 60) {
      const [a, b] = redLampsLit(t);
      expect(a && b).toBe(false);
      expect(a || b).toBe(true);
      if (a) first += 1;
      if (b) second += 1;
      if (whiteLampLit(t)) white += 1;
    }
    // About half the time each (doc 05 §4: calm, local signalling).
    expect(first / (first + second)).toBeGreaterThan(0.4);
    expect(first / (first + second)).toBeLessThan(0.6);
    expect(white).toBeGreaterThan(60);
    expect(white).toBeLessThan(180);
  });
});
