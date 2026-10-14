// Profile-key guard (READ-ONLY. It never writes).
//
// Profiles moved every board key from a bare name to `profile:<id>:<key>`
// (src/profileStorage.js), and the suites bridge the two with the page-side
// helpers in e2e/lib/page.mjs. Three things silently break coverage if that
// bridging is dropped, and all three fail the SAME way - quietly, with a green
// run:
//
//   1. A seed writing a bare 'ttrpg_characters'. The app reads the scoped key,
//      so the seed lands somewhere nothing reads and the suite exercises an
//      EMPTY BOARD while still reporting PASS.
//   2. An audio sweep or count using `startsWith('sound_file_')`. All audio is
//      now `profile:<id>:sound_file_*`, so the predicate matches nothing: the
//      seed-to-clean step becomes a no-op and the count becomes a vacuous 0.
//   3. A raw `cdp('Page.reload', ...)`. A page load wipes every window helper,
//      including __pk/__pseed/__bareKeys, so the next seed after a reload hits
//      (1). Go through reloadPage() in the entrypoints instead.
//
// This exists because the migration that made these changes was one-shot and
// got run twice by accident - the second run rewrote reloadPage's own body into
// a self-call, and the suite died with a stack overflow. The one-shot scripts
// were deleted after use; this is the guard that replaces them.
//
// Run: node e2e/check-profile-keys.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ENTRYPOINTS = ['e2e/e2e-full.mjs', 'e2e/e2e-mobile.mjs'];
const SPECS_DIR = 'e2e/specs';
// Every file in e2e/specs, read from the DIRECTORY. This list was a hard-coded
// enumeration, which is the same shape of bug this script exists to catch: a spec
// added later is simply not scanned, so it can quietly go non-profile-aware and
// still report OK. A guard whose own coverage list can go stale is worse than no
// guard. `existsSync` on the directory keeps this working before it exists.
const SPECS = existsSync(join(root, SPECS_DIR))
  ? readdirSync(join(root, SPECS_DIR)).filter(f => f.endsWith('.mjs')).map(f => `${SPECS_DIR}/${f}`).sort()
  : [];

const BARE_KEYS = [
  'ttrpg_characters_icon', 'ttrpg_environment_icon', 'ttrpg_characters',
  'ttrpg_environment', 'ttrpg_groups', 'ttrpg_data_version', 'ttrpg_themes',
  'backgroundSettings', 'boxSize',
];

const problems = [];

// A block may opt out when writing bare keys is the POINT of the test - the
// profiles spec seeds the pre-profiles storage shape on purpose, to prove the
// first-run migration adopts it. The opt-out has to be visible and justified,
// never a silent gap.
//
//   // PROFILE-GUARD-OFF: <why>
//   ...
//   // PROFILE-GUARD-ON
function scan(rel) {
  const src = readFileSync(join(root, rel), 'utf8');
  let exempt = false;
  src.split('\n').forEach((line, i) => {
    if (/PROFILE-GUARD-OFF/.test(line)) {
      const why = line.replace(/.*PROFILE-GUARD-OFF:?\s*/, '').trim();
      if (!why) problems.push(`${rel}:${i + 1}  PROFILE-GUARD-OFF with no reason given`);
      exempt = true;
      return;
    }
    if (/PROFILE-GUARD-ON/.test(line)) { exempt = false; return; }
    if (exempt) return;
    checkLine(rel, i + 1, line);
  });
  if (exempt) problems.push(`${rel}  PROFILE-GUARD-OFF is never closed with PROFILE-GUARD-ON`);
}

// 1 + 2. bare / unscoped storage access
function checkLine(rel, n, line) {
  for (const key of BARE_KEYS) {
    if (new RegExp(`localStorage\\.(setItem|getItem|removeItem)\\(\\s*'${key}'`).test(line)) {
      problems.push(`${rel}:${n}  bare '${key}' - route it through window.__pk()`);
    }
  }
  if (line.includes("Object.keys(localStorage)")) {
    problems.push(`${rel}:${n}  Object.keys(localStorage) - use window.__bareKeys()`);
  }
  // A LITERAL web-audio key ('sound_file_foo.mp3'), which is easy to miss -
  // the sweep form startsWith('sound_file_') is caught below, but a seed or
  // assertion naming a concrete file is not, and a bare one reads/writes a
  // key the app never touches.
  for (const m of line.matchAll(/localStorage\.(setItem|getItem|removeItem)\(\s*'(sound_file_[^']+)'/g)) {
    problems.push(`${rel}:${n}  bare '${m[2]}' - route it through window.__pk()`);
  }
  // A key passed as a VARIABLE (a helper that takes the key name as an
  // argument). The literal-key checks above cannot see these, and they fail
  // the same quiet way: the helper reads a key nothing writes.
  // Exception: a variable that came straight out of localStorage.key(i) in an
  // enumeration loop already holds the FULL scoped key, so re-scoping it
  // would double the prefix. Those lines are excluded.
  const fromEnumeration = line.includes('localStorage.key(i)');
  for (const m of line.matchAll(/localStorage\.(setItem|getItem|removeItem)\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g)) {
    const v = m[2];
    if (fromEnumeration) continue;
    if (['key', 'k', 'name'].includes(v) && !line.includes('__pk')) {
      problems.push(`${rel}:${n}  localStorage.${m[1]}(${v}...) with a variable key - route it through window.__pk()`);
    }
  }
  if (/\.startsWith\('sound_file_'\)/.test(line)) {
    problems.push(`${rel}:${n}  unscoped sound_file_ sweep/count - scope it to the active profile`);
  }
}

// 3. raw Page.reload outside reloadPage's own body
for (const rel of ENTRYPOINTS) {
  const src = readFileSync(join(root, rel), 'utf8');
  const lines = src.split('\n');
  const inReloadPage = new Set();
  let depth = 0, inside = false;
  lines.forEach((line, i) => {
    if (/async function reloadPage/.test(line)) { inside = true; depth = 0; }
    if (inside) {
      depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (depth <= 0 && i > 0 && /\}/.test(line)) inside = false;
      inReloadPage.add(i);
    }
  });
  lines.forEach((line, i) => {
    // The reloadPage doc-comment names `cdp('Page.reload')` to explain why it
    // exists. A comment is not a call site.
    if (line.trim().startsWith('//')) return;
    if (line.includes("cdp('Page.reload'") && !inReloadPage.has(i)) {
      problems.push(`${rel}:${i + 1}  raw Page.reload - use reloadPage() so helpers are re-injected`);
    }
  });
}

for (const rel of [...ENTRYPOINTS, ...SPECS]) scan(rel);

if (problems.length) {
  console.log('PROFILE KEY GUARD: FAILED');
  for (const p of problems) console.log('  ' + p);
  console.log(`\n${problems.length} problem(s). See e2e/lib/page.mjs (PROFILE_HELPER) for why each matters.`);
  process.exit(1);
}
console.log('PROFILE KEY GUARD: OK - seeds, audio sweeps and reloads are all profile-aware');