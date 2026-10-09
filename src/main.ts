import './styles/main.css';

const root = document.getElementById('app');
if (root) {
  const title = document.createElement('h1');
  title.textContent = 'Vláček';
  const status = document.createElement('p');
  status.textContent = 'Hra se připravuje. Verze 0.1 bude první hratelná.';
  const build = document.createElement('p');
  build.className = 'build-id';
  build.textContent = `Build ${__APP_BUILD_ID__}`;
  root.replaceChildren(title, status, build);
}
