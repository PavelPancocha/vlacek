import { worldDiagnostics } from '../domain/world/WorldValidation.ts';
import { expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { Backdrop } from './Backdrop.ts';
import { regionAt } from '../domain/world/Regions.ts';
vi.mock('phaser', () => ({ default: {} }));

function setup() {
  const images: ReturnType<typeof image>[] = [];
  function image(_x: number, _y: number, key: string, frame?: string) {
    const data = new Map<string, unknown>();
    return {
      frame: { name: frame, width: 1022, height: 240 },
      texture: { key },
      setFrame(name: string) {
        this.frame.name = name;
        return this;
      },
      setTexture(key: string, name: string) {
        this.texture.key = key;
        this.frame.name = name;
        return this;
      },
      setData(key: string, value: unknown) {
        data.set(key, value);
        return this;
      },
      getData: (key: string) => data.get(key),
      setOrigin: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      setDisplaySize: vi.fn().mockReturnThis(),
      setScale: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
  }
  const rectangle = {
    setAlpha: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setFillStyle: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setSize: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
  // Boundary fixture supplies the Phaser object API used by Backdrop.
  const scene = {
    textures: { exists: () => true },
    add: {
      image: (...args: Parameters<typeof image>) => {
        const item = image(...args);
        images.push(item);
        return item;
      },
      rectangle: () => rectangle,
    },
  } as unknown as Phaser.Scene;
  const backdrop = new Backdrop(scene, { sky: 0, clouds: 1, far: 2, mid: 3 });
  return { backdrop, images };
}

it('moves reused backdrop tiles to the incoming region page and updates their diagnostic identity', () => {
  const { backdrop, images } = setup();
  backdrop.setAtlas('page-country', 1, (key) =>
    key.includes('forest') ? 'page-forest' : 'page-country',
  );
  const first = regionAt(1, 10000),
    next = regionAt(1, first.toXU);
  const view = { left: 0, worldLeft: 0, top: -600, width: 2200, height: 1000 };
  backdrop.update(
    view,
    0,
    0,
    { from: first, to: first, progress: 0 },
    0,
    worldDiagnostics(1, 10000, [], 0),
  );
  const tile = images.find(
    (item) => item.frame.name === 'backdrop.countryside-far',
  );
  expect(tile).toBeDefined();
  backdrop.update(
    view,
    0,
    0,
    { from: next, to: next, progress: 0 },
    0,
    worldDiagnostics(1, first.toXU, [], 0),
  );
  expect(tile?.texture.key).toBe('page-forest');
  expect(tile?.getData('world-part')).toBe('backdrop.forest-dense-far-summer');
});

it('keeps valid country art when incoming forest frames are unavailable and recovers without arbitrary art', () => {
  const { backdrop, images } = setup();
  const first = regionAt(1, 10000),
    next = regionAt(1, first.toXU);
  const view = { left: 0, worldLeft: 0, top: -600, width: 2200, height: 1000 };
  backdrop.setAtlas('page-country', 1, (key) =>
    key.includes('forest') ? undefined : 'page-country',
  );
  backdrop.update(
    view,
    0,
    0,
    { from: first, to: first, progress: 0 },
    0,
    worldDiagnostics(1, 10000, [], 0),
  );
  const tile = images.find(
    (item) => item.frame.name === 'backdrop.countryside-far',
  );
  backdrop.update(
    view,
    0,
    0,
    { from: next, to: next, progress: 0 },
    0,
    worldDiagnostics(1, first.toXU, [], 0),
  );
  expect(tile?.frame.name).toBe('backdrop.countryside-far');
  expect(
    images.some(
      (item) => item.frame.name === 'backdrop.forest-dense-far-summer',
    ),
  ).toBe(false);
  expect(backdrop.state.missingFrames).toEqual(
    expect.arrayContaining([
      'backdrop.forest-dense-far-summer',
      'backdrop.forest-dense-mid-summer',
    ]),
  );
  backdrop.setAtlas('page-forest', 1, (key) =>
    key.includes('forest') ? 'page-forest' : 'page-country',
  );
  backdrop.update(
    view,
    0,
    0,
    { from: next, to: next, progress: 0 },
    0,
    worldDiagnostics(1, first.toXU, [], 0),
  );
  expect(
    images.some(
      (item) =>
        item.frame.name === 'backdrop.forest-dense-far-summer' &&
        item.texture.key === 'page-forest',
    ),
  ).toBe(true);
  expect(backdrop.state.missingFrames).toEqual([]);
});
