/** Calm, child-safe failure screen; technical detail goes to the console only. */
export function showErrorView(container: HTMLElement, error: unknown): void {
  console.error(error);
  const message = document.createElement('p');
  message.textContent = 'Vláček se teď nepodařilo spustit.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'big-button';
  retry.textContent = 'Zkusit znovu';
  retry.addEventListener('click', () => window.location.reload(), {
    once: true,
  });
  const panel = document.createElement('div');
  panel.className = 'error-view';
  panel.append(message, retry);
  container.replaceChildren(panel);
}
