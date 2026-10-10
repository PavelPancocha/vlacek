import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gameConfig } from '../src/config/gameConfig.ts';
import { artParts, vehicleArt } from '../src/content/artManifest.ts';
import {
  releaseErrors,
  validateVehicleArt,
} from '../src/content/artValidation.ts';
import { validateCatalog } from '../src/content/catalogValidation.ts';
import { locomotives, wagons } from '../src/content/vehicles.ts';
import { trackTileParts, worldParts } from '../src/content/worldArt.ts';
import { validateWorldArt } from '../src/content/worldValidation.ts';

/**
 * Catalog and asset contract check (doc 10 §9, CNT-01/02): catalog data,
 * the vehicle and world art manifests and their SVG files in
 * `assets/vehicles/` and `assets/world/`. During development placeholders
 * are allowed and listed; `--release` rejects them.
 */
const release = process.argv.includes('--release');
const vehicles = [...locomotives, ...wagons];
/** SVG text by file name in an `assets/` folder. */
function svgFiles(folder: string): Map<string, string> {
  const dir = resolve(import.meta.dirname, '../assets', folder);
  return new Map(
    readdirSync(dir)
      .filter((file) => file.endsWith('.svg'))
      .map((file) => [file, readFileSync(resolve(dir, file), 'utf8')]),
  );
}
const errors = [
  ...validateCatalog(locomotives, wagons, {
    maxVehicleLengthU: gameConfig.train.maxVehicleLengthU,
  }),
  ...validateVehicleArt({
    vehicles,
    parts: artParts,
    art: vehicleArt,
    files: svgFiles('vehicles'),
  }),
  ...validateWorldArt({
    parts: worldParts,
    files: svgFiles('world'),
    usedKeys: trackTileParts,
  }),
];
const placeholders = vehicles.filter(
  (vehicle) => vehicle.placeholder !== undefined,
);
if (release) errors.push(...releaseErrors(vehicles));
for (const error of errors) console.error(error);
if (errors.length > 0) process.exitCode = 1;
else {
  const withArt = vehicles.length - placeholders.length;
  console.log(
    `${vehicles.length} vehicles valid (${withArt} with art, ` +
      `${Object.keys(artParts).length} art parts), ` +
      `${Object.keys(worldParts).length} world parts, ` +
      `${placeholders.length} placeholders` +
      (placeholders.length > 0
        ? ' (allowed until M4; --release rejects them)'
        : ''),
  );
}
