import type { DebugSnapshot } from '../app/debugSnapshot.ts';
import { diagnosticGroups } from './diagnosticsFormat.ts';
import { actionButton, el } from './dom.ts';

/** A fixed pause-time sample; full JSON is retained only for the report button. */
export function diagnosticsView(snapshot: DebugSnapshot): HTMLElement {
  return el(
    'section',
    {
      class: 'screen diagnostics-detail',
      role: 'region',
      'aria-labelledby': 'diagnostics-title',
    },
    el('h1', { id: 'diagnostics-title', tabindex: '-1' }, 'Diagnostika'),
    el(
      'div',
      { class: 'screen-content' },
      el(
        'div',
        { class: 'diagnostics-groups' },
        ...diagnosticGroups(snapshot).map((group) =>
          el(
            'section',
            {},
            el('h2', {}, group.title),
            el(
              'dl',
              {},
              ...group.rows.flatMap(([key, value]) => [
                el('dt', {}, key),
                el('dd', {}, value),
              ]),
            ),
          ),
        ),
      ),
      el(
        'div',
        { 'data-copy-output': '' },
        el('p', { role: 'status', 'data-copy-status': '' }),
      ),
    ),
    el(
      'div',
      { class: 'row' },
      actionButton('dev-copy-json', 'Kopírovat JSON', ['Kopírovat JSON']),
      actionButton('dev-details-close', 'Zpět', ['Zpět']),
    ),
  );
}

/** Clipboard rejection and absent API both leave selectable report text. */
export async function copyDiagnosticText(
  text: string,
  output: HTMLElement,
): Promise<void> {
  const status = output.querySelector('[data-copy-status]');
  output.querySelector('textarea')?.remove();
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(text);
    if (status) status.textContent = 'Zkopírováno.';
  } catch {
    if (!output.isConnected) return;
    if (status)
      status.textContent =
        'Schránka není dostupná. Označený text zkopíruj ručně.';
    const field = el('textarea', {
      readonly: true,
      'aria-label': 'Text k ručnímu kopírování',
    });
    field.value = text;
    output.append(field);
    field.focus();
    field.select();
  }
}
