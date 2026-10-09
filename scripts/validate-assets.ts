import { gameConfig } from '../src/config/gameConfig.ts';
import { validateCatalog } from '../src/content/catalogValidation.ts';
import { locomotives, wagons } from '../src/content/vehicles.ts';

/**
 * Catalog and asset contract check (doc 10 §9, CNT-01/02). During
 * development placeholders are allowed and listed; `--release` rejects them.
 * Asset file checks join here when the first real assets are added (M4).
 */
const release = process.argv.includes('--release');
const vehicles = [...locomotives, ...wagons];
const errors = validateCatalog(locomotives, wagons, {
  maxVehicleLengthU: gameConfig.train.maxVehicleLengthU,
});
const placeholders = vehicles.filter(
  (vehicle) => vehicle.placeholder !== undefined,
);
if (release) {
  errors.push(...placeholders.map((vehicle) => `${vehicle.id}: placeholder`));
}
for (const error of errors) console.error(error);
if (errors.length > 0) process.exitCode = 1;
else {
  console.log(
    `${vehicles.length} vehicles valid, ${placeholders.length} placeholders` +
      (placeholders.length > 0
        ? ' (allowed until M4; --release rejects them)'
        : ''),
  );
}
