import { expect, test } from '@playwright/test';
import { tapAction } from './helpers.ts';

test('CNT-03: closed cargo frames connect visibly to both running-gear supports', async ({
  page,
}) => {
  await page.goto('./');
  await tapAction(page, 'loco:steam_local');
  await tapAction(page, 'to-depot');
  for (const [id, heightU, supports, halfWidthU] of [
    ['cargo_tank', 82, [33, 143], 6],
    ['cargo_milk', 76, [32, 136], 14],
    ['cargo_grain', 84, [33, 139], 6],
    ['cargo_mail', 78, [31, 133], 14],
    ['cargo_refrigerated', 80, [33, 143], 14],
  ] as const) {
    const gaps = await page.locator(`[data-action="add:${id}"] svg`).evaluate(
      async (svg, { heightU, supports, halfWidthU }) => {
        if (!(svg instanceof SVGSVGElement))
          throw new Error('vehicle preview is not an SVG');
        const scale = 4;
        const canvas = document.createElement('canvas');
        const frame = svg.viewBox.baseVal;
        canvas.width = frame.width * scale;
        canvas.height = frame.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('2D canvas unavailable');
        for (const layer of svg.querySelectorAll('image')) {
          const image = new Image();
          image.src = layer.href.baseVal;
          await image.decode();
          const matrix = layer.transform.baseVal.consolidate()?.matrix;
          if (!matrix) throw new Error('preview layer has no transform');
          ctx.setTransform(
            scale * matrix.a,
            scale * matrix.b,
            scale * matrix.c,
            scale * matrix.d,
            scale * matrix.e,
            scale * matrix.f,
          );
          ctx.drawImage(
            image,
            0,
            0,
            layer.width.baseVal.value,
            layer.height.baseVal.value,
          );
        }
        const missing: { supportXU: number; yU: number }[] = [];
        // Every raster row from inside the solebar to the suspension must
        // contain solid material near each support, not just rim highlights.
        for (const supportXU of supports) {
          for (
            let yPx = (heightU - 28) * scale;
            yPx < (heightU - 22) * scale;
            yPx++
          ) {
            const row = ctx.getImageData(
              (supportXU - halfWidthU) * scale,
              yPx,
              halfWidthU * 2 * scale,
              1,
            ).data;
            if (!row.some((value, index) => index % 4 === 3 && value >= 200))
              missing.push({ supportXU, yU: yPx / scale });
          }
        }
        return missing;
      },
      { heightU, supports: [...supports], halfWidthU },
    );
    expect(
      gaps,
      `${id}: transparent rows between frame and running gear`,
    ).toEqual([]);
  }
});
