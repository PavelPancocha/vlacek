import './styles/main.css';
import { AppController } from './app/AppController.ts';
import { GameSession } from './app/GameSession.ts';
import { gameConfig, validateGameConfig } from './config/gameConfig.ts';
import { locomotives, wagons } from './content/vehicles.ts';
import { browserStorage, randomSeed } from './platform/browserEnvironment.ts';
import {
  debugEnabled,
  rendererPreference,
  seedOverride,
} from './platform/CapabilityProbe.ts';
import { SaveRepository } from './platform/SaveRepository.ts';
import { saveRules } from './platform/SaveValidation.ts';
import { showErrorView } from './ui/ErrorView.ts';

const app = document.getElementById('app');
const gameRoot = document.getElementById('game-root');

if (app && gameRoot) {
  try {
    const configErrors = validateGameConfig(gameConfig);
    if (configErrors.length > 0)
      throw new Error(`Invalid config: ${configErrors.join(', ')}`);
    const pinnedSeed = seedOverride(window.location.search);
    const session = new GameSession({
      config: gameConfig,
      catalog: { locomotives, wagons },
      repository: new SaveRepository(
        browserStorage(),
        saveRules(gameConfig, locomotives, wagons),
        gameConfig.save,
      ),
      randomSeed: pinnedSeed === undefined ? randomSeed : () => pinnedSeed,
      nowIso: () => new Date().toISOString(),
      buildId: __APP_BUILD_ID__,
    });
    session.boot();
    new AppController(app, gameRoot, session, {
      renderer: rendererPreference(window.location.search),
      debug: debugEnabled(window.location.search),
      buildId: __APP_BUILD_ID__,
    });
  } catch (error) {
    showErrorView(app, error);
  }
}
