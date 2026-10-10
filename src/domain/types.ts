/** Shared data contracts (doc 08 §4) used by the implemented features. */
export type Power = 'steam' | 'diesel' | 'electric' | 'fantasy';
export type EffectId =
  'none' | 'steam' | 'diesel' | 'stars' | 'bubbles' | 'rainbow';
export type WagonGroup = 'passenger' | 'cargo' | 'service' | 'fun';

export interface VehicleBase {
  id: string;
  labelCs: string;
  /** Between nominal coupler ends; > 0 and at most `train.maxVehicleLengthU`. */
  lengthU: number;
  /** Both symmetric support points; < lengthU / 2. */
  bogieOffsetU: number;
  wheelRadiusU: number;
  bodyAsset: string;
  previewAsset: string;
  interactionId?: string;
}

export interface LocomotiveDefinition extends VehicleBase {
  kind: 'locomotive';
  power: Power;
  /** Must equal `power === 'electric'`. */
  requiresCatenary: boolean;
  hornAudio: string;
  effect: EffectId;
}

export interface WagonDefinition extends VehicleBase {
  kind: 'wagon';
  group: WagonGroup;
}

export interface WagonInstance {
  /** Unique within the consist; order is not identity. */
  instanceId: string;
  definitionId: string;
  visualSeed: number;
}

export interface Consist {
  locomotiveId: string;
  /** 0 to `train.maxWagons`; repeated definitions are allowed. */
  wagons: WagonInstance[];
}
