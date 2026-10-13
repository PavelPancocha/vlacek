/** Drawing order (doc 07 §3). */
export const DEPTH = {
  sky: 0,
  clouds: 0.5,
  far: 1,
  mid: 2,
  backGround: 3,
  backProps: 4,
  ground: 5,
  track: 6,
  train: 7,
  wires: 7.5,
  nearProps: 8,
  objects: 9,
  /** Vehicle particles above wires/train, below the main rock (7.6). */
  trainEffects: 7.55,
  /** NPC particles above their train (4.3), below their rock (4.35). */
  npcEffects: 4.32,
  effects: 10,
} as const;
