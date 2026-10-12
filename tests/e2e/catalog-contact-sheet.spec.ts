import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { artParts, vehicleArt } from '../../src/content/artManifest.ts';
import { vehicleArtLayers } from '../../src/content/artLayers.ts';
import { locomotives, wagons } from '../../src/content/vehicles.ts';
import { tapAction } from './helpers.ts';

test('H2: contact sheet draws all 42 catalog vehicles from built art', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 2560, height: 1200 });
  await page.goto('./?seed=123');
  // Expand the real app's cards for evidence; no test-only production page.
  await page.addStyleTag({
    content:
      '.catalog { display: grid; grid-template-columns: repeat(8, 1fr); overflow: visible; flex: none; } .catalog .group { display: contents; } .card { flex: none; } .card svg { max-width: none; } .selected-mark { visibility: hidden; }',
  });
  async function photograph(
    vehicles: typeof locomotives | typeof wagons,
    prefix: string,
  ) {
    const expected = vehicles.map((vehicle) => {
      expect(vehicle.placeholder, vehicle.id).toBeUndefined();
      const art = vehicleArt[vehicle.id];
      if (!art) throw new Error(`${vehicle.id}: art missing`);
      return {
        id: vehicle.id,
        label: vehicle.labelCs,
        width: vehicle.lengthU,
        height: art.heightU,
        sources: vehicleArtLayers(art, vehicle.lengthU, 0).map((layer) =>
          readFileSync(
            resolve(
              import.meta.dirname,
              '../../assets/vehicles',
              artParts[layer.part].file,
            ),
            'utf8',
          ),
        ),
      };
    });
    const cards = page.locator(`[data-action^="${prefix}:"]`);
    await expect(cards).toHaveCount(vehicles.length);
    const pictures = await cards.evaluateAll(async (cards, expected) => {
      const sources = new Map<string, Promise<string>>();
      const previews = cards.map((card, index) => {
        const vehicle = expected[index];
        const svg = card.querySelector('svg');
        if (!svg || !vehicle) throw new Error('vehicle preview missing');
        svg.setAttribute('width', String(vehicle.width));
        svg.setAttribute('height', String(vehicle.height));
        const hrefs = [...svg.querySelectorAll('image')].map(
          (image) => image.getAttribute('href') ?? '',
        );
        for (const href of hrefs) {
          if (sources.has(href)) continue;
          sources.set(
            href,
            (async () => {
              const response = await fetch(href);
              if (!response.ok) throw new Error('built art source missing');
              const image = new Image();
              image.src = href;
              await image.decode();
              if (!image.naturalWidth) throw new Error('empty art source');
              return response.text();
            })(),
          );
        }
        return {
          svg,
          hrefs,
          vehicle,
          action: card.getAttribute('data-action'),
        };
      });
      return Promise.all(
        previews.map(async ({ svg, hrefs, vehicle, action }) => {
          const loaded = await Promise.all(
            hrefs.map(async (href) => {
              const source = sources.get(href);
              if (!source) throw new Error('art source was not decoded');
              return source;
            }),
          );
          const { x, y, width, height } = svg.getBoundingClientRect();
          return {
            id: vehicle.id,
            label: vehicle.label,
            action,
            sources: loaded,
            box: { x, y, width, height },
          };
        }),
      );
    }, expected);
    for (const [index, picture] of pictures.entries()) {
      expect(picture.action).toBe(`${prefix}:${picture.id}`);
      // Vite deduplicates byte-identical parts under one hashed filename.
      expect(picture.sources, picture.id).toEqual(expected[index]?.sources);
      expect(picture.box.width).toBe(expected[index]?.width);
      expect(picture.box.height).toBe(expected[index]?.height);
      expect(picture.box.x).toBeGreaterThanOrEqual(0);
      expect(picture.box.y).toBeGreaterThanOrEqual(0);
      expect(picture.box.x + picture.box.width).toBeLessThanOrEqual(2560);
      expect(picture.box.y + picture.box.height).toBeLessThanOrEqual(1200);
    }
    return { png: (await page.screenshot()).toString('base64'), pictures };
  }
  const stages = [await photograph(locomotives, 'loco')];
  await tapAction(page, 'to-depot');
  stages.push(await photograph(wagons, 'add'));
  const ids = stages.flatMap((stage) => stage.pictures.map(({ id }) => id));
  expect(ids).toEqual([...locomotives, ...wagons].map(({ id }) => id));
  expect(new Set(ids).size).toBe(42);
  // Arrange only pixels photographed above, without redrawing any vehicle.
  const png = await page.evaluate(async (stages) => {
    const canvas = document.createElement('canvas');
    canvas.width = 708;
    canvas.height = 14 * 152;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('contact sheet canvas missing');
    context.fillStyle = '#f5f1e8';
    context.fillRect(0, 0, canvas.width, canvas.height);
    let index = 0;
    for (const stage of stages) {
      const image = new Image();
      image.src = `data:image/png;base64,${stage.png}`;
      await image.decode();
      for (const { label, id, box } of stage.pictures) {
        const x = (index % 3) * 236;
        const y = Math.floor(index / 3) * 152;
        context.drawImage(
          image,
          box.x,
          box.y,
          box.width,
          box.height,
          x + (236 - box.width) / 2,
          y + 116 - box.height,
          box.width,
          box.height,
        );
        context.fillStyle = '#2b2b2b';
        context.font = '14px system-ui';
        context.fillText(label, x + 10, y + 133);
        context.font = '11px system-ui';
        context.fillText(id, x + 10, y + 149);
        index += 1;
      }
    }
    return canvas.toDataURL('image/png').split(',')[1] ?? '';
  }, stages);
  const output = Buffer.from(png, 'base64');
  expect(output.byteLength).toBeGreaterThan(0);
  expect(output.byteLength).toBeLessThan(1024 * 1024);
  writeFileSync(testInfo.outputPath('kontaktni-list-42-vozidel.png'), output);
  await testInfo.attach('Kontaktní list 42 vozidel', {
    body: output,
    contentType: 'image/png',
  });
  expect(errors).toEqual([]);
});
