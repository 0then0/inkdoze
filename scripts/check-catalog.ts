/**
 * Validates the device catalog and install methods. Runs in CI before the build.
 * Usage: npm run catalog:check
 */
import { DEVICES } from '../src/catalog/devices.ts';
import { INSTALL_METHODS } from '../src/catalog/install.ts';
import { validateCatalog } from '../src/catalog/validate.ts';
import { en } from '../src/i18n/locales/en.ts';

const issues = validateCatalog(DEVICES, INSTALL_METHODS, (key) => key in en);
const unused = Object.keys(INSTALL_METHODS).filter((id) => !DEVICES.some((d) => d.install.includes(id)));
for (const id of unused) issues.push({ id, message: 'install method is not used by any device' });

const byKind = new Map<string, number>();
for (const d of DEVICES) {
  const best = d.sources.some((s) => s.kind === 'manufacturer')
    ? 'manufacturer'
    : d.sources.some((s) => s.kind === 'firmware')
      ? 'firmware'
      : d.sources.some((s) => s.kind === 'community')
        ? 'community'
        : 'secondary';
  byKind.set(best, (byKind.get(best) ?? 0) + 1);
}

if (issues.length) {
  for (const i of issues) console.error(`✗ ${i.id}: ${i.message}`);
  console.error(`\n${issues.length} catalog issue(s).`);
  process.exit(1);
}

const brands = new Set(DEVICES.map((d) => d.brand));
console.log(`✓ ${DEVICES.length} devices, ${brands.size} brands, ${Object.keys(INSTALL_METHODS).length} install methods.`);
console.log(`  Best resolution source: ${[...byKind].map(([k, n]) => `${k} ${n}`).join(', ')}.`);
