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

/**
 * Catalog and asset contract check (doc 10 §9, CNT-01/02): catalog data,
 * the vehicle art manifest and its SVG files in `assets/vehicles/`. During
 * development placeholders are allowed and listed; `--release` rejects them.
 */
const release = process.argv.includes('--release');
const vehicles = [...locomotives, ...wagons];
const artDir = resolve(import.meta.dirname, '../assets/vehicles');
const files = new Map(
  readdirSync(artDir)
    .filter((file) => file.endsWith('.svg'))
    .map((file) => [file, readFileSync(resolve(artDir, file), 'utf8')]),
);
const errors = [
  ...validateCatalog(locomotives, wagons, {
    maxVehicleLengthU: gameConfig.train.maxVehicleLengthU,
  }),
  ...validateVehicleArt({ vehicles, parts: artParts, art: vehicleArt, files }),
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
      `${placeholders.length} placeholders` +
      (placeholders.length > 0
        ? ' (allowed until M4; --release rejects them)'
        : ''),
  );
}
