import { expect, test } from '@playwright/test';
import { startRide } from './helpers.ts';

declare global {
  interface Window {
    __hudPerfController: { snapshot(): unknown };
    __hudPerfCalls: number;
  }
}

test('PERF: periodic HUD refresh avoids collecting the detailed diagnostic snapshot', async ({
  page,
}) => {
  await page.clock.install();
  // Test-only access to the shell; production diagnostics remain read-only.
  await page.route('**/assets/index-*.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const anchor = 'Object.assign(window,{__vlacek:';
    if (!body.includes(anchor)) throw new Error('shell probe anchor missing');
    await route.fulfill({
      response,
      body: body.replace(anchor, `window.__hudPerfController=this,${anchor}`),
    });
  });
  await startRide(page, [], '?debug=1&renderer=canvas&seed=123');
  await expect(page.locator('#diagnostics')).toContainText('canvas');
  await page.evaluate(() => {
    const app = window.__hudPerfController;
    const snapshot = app.snapshot.bind(app);
    window.__hudPerfCalls = 0;
    const hud = document.getElementById('diagnostics');
    if (!hud) throw new Error('HUD missing');
    hud.textContent = 'Čeká na obnovení';
    app.snapshot = () => {
      window.__hudPerfCalls++;
      return snapshot();
    };
  });
  await page.clock.fastForward(1100);
  expect(await page.evaluate(() => window.__hudPerfCalls)).toBe(0);
  await expect(page.locator('#diagnostics')).toContainText('Svět 123');
  await expect(page.locator('#diagnostics')).toContainText('p95');
});
