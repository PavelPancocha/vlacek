type Child = Node | string | undefined | false;

/** Small element factory; text always goes through text nodes (no HTML). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | boolean | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    element.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children) {
    if (child === undefined || child === false) continue;
    element.append(
      typeof child === 'string' ? document.createTextNode(child) : child,
    );
  }
  return element;
}

/** A large button routed through the InputRouter via `data-action`. */
export function actionButton(
  action: string,
  label: string,
  content: Child[],
  options: { className?: string; disabled?: boolean; pressed?: boolean } = {},
): HTMLButtonElement {
  return el(
    'button',
    {
      type: 'button',
      class: options.className ?? 'button',
      'data-action': action,
      'aria-label': label,
      disabled: options.disabled === true,
      'aria-pressed':
        options.pressed === undefined ? undefined : String(options.pressed),
    },
    ...content,
  );
}
