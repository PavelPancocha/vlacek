/**
 * Road traffic geometry at a level crossing (doc 05 §4, D-015). A leaf
 * module without imports, so the configuration validator can check
 * `crossing.roadClearanceSeconds` against it without an import cycle
 * through the world modules that read the configuration.
 */

export type RoadActorKind = 'car' | 'bike';

/** Half the track bed along the road: the road actors' conflict zone. */
export const ROAD_CONFLICT_U = 30;
/**
 * Stop lines, measured from the track. Behind the track the road meets the
 * rails level; in front of it the road climbs the bank, so its barrier and
 * stop line stand at the bank's foot, further out (D-015).
 */
export const FAR_STOP_LINE_U = 40;
export const NEAR_STOP_LINE_U = 56;

export const ROAD_ACTOR_LENGTH_U: Readonly<Record<RoadActorKind, number>> = {
  car: 26,
  bike: 14,
};
export const ROAD_ACTOR_SPEED_U_PER_SEC: Readonly<
  Record<RoadActorKind, number>
> = {
  car: 70,
  bike: 56,
};

/**
 * Longest time a road actor just past its stop line needs until it is
 * clear of the conflict zone, also stuck behind the slowest actor.
 * `crossing.roadClearanceSeconds` must not be shorter (the configuration
 * validator rejects it): it is part of Dclose.
 */
export function worstClearingSeconds(): number {
  const longest = Math.max(...Object.values(ROAD_ACTOR_LENGTH_U));
  const slowest = Math.min(...Object.values(ROAD_ACTOR_SPEED_U_PER_SEC));
  const stop = Math.max(FAR_STOP_LINE_U, NEAR_STOP_LINE_U);
  return (stop + ROAD_CONFLICT_U + longest) / slowest;
}
