import './styles/main.css';
import { rendererPreference } from './platform/CapabilityProbe.ts';
import { createGameHost } from './render/GameHost.ts';
import { PreviewScene } from './render/PreviewScene.ts';
import { showErrorView } from './ui/ErrorView.ts';

const app = document.getElementById('app');
const gameRoot = document.getElementById('game-root');

if (app && gameRoot) {
  try {
    createGameHost({
      parent: gameRoot,
      renderer: rendererPreference(window.location.search),
      maxDpr: 1.5,
      scenes: [PreviewScene],
      onReady: (renderer) => {
        gameRoot.dataset['renderer'] = renderer;
      },
    });
  } catch (error) {
    showErrorView(app, error);
  }
}
