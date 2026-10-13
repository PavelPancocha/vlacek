import './styles/main.css';
import { AppController } from './app/AppController.ts';
import { GameSession } from './app/GameSession.ts';
import { gameConfig, validateGameConfig } from './config/gameConfig.ts';
import { locomotives, wagons } from './content/vehicles.ts';
import { browserStorage, randomSeed } from './platform/browserEnvironment.ts';
import {
  debugEnabled,
  qualityOverride,
  rendererPreference,
  seedOverride,
} from './platform/CapabilityProbe.ts';
import { readDevOptions } from './platform/DevOptions.ts';
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
    const storage = browserStorage();
    const storedDev = readDevOptions(storage);
    const search = window.location.search;
    const pinnedSeed = seedOverride(search, storedDev);
    const session = new GameSession({
      config: gameConfig,
      catalog: { locomotives, wagons },
      repository: new SaveRepository(
        storage,
        saveRules(gameConfig, locomotives, wagons),
        gameConfig.save,
      ),
      randomSeed: pinnedSeed === undefined ? randomSeed : () => pinnedSeed,
      nowIso: () => new Date().toISOString(),
      buildId: __APP_BUILD_ID__,
    });
    session.boot();
    new AppController(app, gameRoot, session, {
      renderer: rendererPreference(search, storedDev),
      debug: debugEnabled(search, storedDev),
      buildId: __APP_BUILD_ID__,
      qualityOverride: qualityOverride(search, session.settings.quality),
      seedOverride: pinnedSeed,
    });
  } catch (error) {
    showErrorView(app, error);
  }
}
