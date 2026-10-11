// Coverage manifest checker — static analysis only, no browser and no CDP.
//
// The E2E harness was refactored (2026-10-10) into shared specs in ./specs that
// run from BOTH entrypoints. That arrangement has one invariant worth enforcing
// mechanically: a spec that runs on one platform but not the other is a silent
// coverage hole, and nothing at runtime will ever report it.
//
// This script holds that line. It cross-checks coverage.manifest.json against
// the actual suites:
//
//   1. every suite in the manifest maps to a file that exists
//   2. every scanned file is in the manifest, and every suite's declared
//      platforms match where the code really runs it
//   3. every id the manifest claims exists in the code, and every id in the
//      code is registered in the manifest (nothing rots unnoticed in either
//      direction)
//   4. every shared spec is imported AND passed to runSpecs() by BOTH
//      entrypoints — the check the whole refactor exists to make
//   5. every retired file is actually gone
//
// Usage:
//   node e2e/check-coverage.mjs           verify (exit 0 clean, 1 on findings)
//   node e2e/check-coverage.mjs --update  rewrite each suite's `ids` from the
//                                        code, leaving the hand-written
//                                        metadata alone. Review the diff.
//
// --update only ever fills in ids. It never invents, deletes or reorders
// suites, so a manifest that has drifted structurally still fails verification
// and still has to be fixed by a human.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, 'coverage.manifest.json');

// The entrypoints, and the phases each one is driven by. A suite's platform list
// is DERIVED from this table, not trusted from the manifest.
const ENTRYPOINTS = {
  'e2e-full.mjs': ['web', 'win'],
  'e2e-mobile.mjs': ['android'],
};

const SPEC_DIR = 'specs';

// Matches log('CAT','name' — the label may be a concatenation ('T3: '+theme), so
// only the leading string literal is captured and the id is pulled out of that.
// Ids are letter(s) + digits + an optional sub-letter (P9a, P23b, Q6c).
//
// The CATEGORY class must allow digits. It did not, and that was a real blind
// spot: 'A11Y' (the keyboard suite) never matched, so its three tests were
// invisible to every check below while the checker still reported green.
// Anything narrower than [A-Za-z0-9]+ silently hides whole suites.
const LOG_RE = /log\(\s*'([A-Za-z0-9]+)'\s*,\s*'([^']*)'/g;
const ID_RE = /^([A-Z]+\d+[a-z]?)/;

const UPDATE = process.argv.includes('--update');
const findings = [];
const notes = [];
const err = (code, msg) => findings.push(`${code}: ${msg}`);

// ---------------------------------------------------------------- scan

// file -> category -> Set(ids). Sets, not lists: a legitimate pattern in this
// harness is one id logged from both arms of an if/else (the else arm logging a
// hard-coded FAIL, e.g. e2e-mobile.mjs C4), and a platform branch asserting a
// different thing under the same id (sliders.mjs B2: card width on desktop,
// grid columns on mobile). Neither is a duplicate assertion at runtime.
function scanFile(rel) {
  const src = readFileSync(join(HERE, rel), 'utf8');
  const byCat = new Map();
  const nonTestLabels = [];
  let m;
  LOG_RE.lastIndex = 0;
  while ((m = LOG_RE.exec(src)) !== null) {
    const [, cat, label] = m;
    const id = (label.match(ID_RE) || [])[1];
    if (!id) {
      nonTestLabels.push(label);
      continue;
    }
    if (!byCat.has(cat)) byCat.set(cat, new Set());
    byCat.get(cat).add(id);
  }
  return { byCat, nonTestLabels };
}

// ------------------------------------------------------ shared-spec wiring

// A shared spec is only "shared" if both entrypoints import it AND hand it to
// runSpecs(). Importing without running is a plausible way to end up with a
// spec that looks wired up and never executes.
function wiringFor(basename, exportedName) {
  const result = {};
  for (const ep of Object.keys(ENTRYPOINTS)) {
    const src = readFileSync(join(HERE, ep), 'utf8');
    const imported = new RegExp(`import\\s*\\{[^}]*\\b${exportedName}\\b[^}]*\\}\\s*from\\s*'\\./${SPEC_DIR}/${basename}'`).test(src);
    const runRe = new RegExp(`runSpecs\\s*\\(\\s*ctx\\s*,\\s*\\[([^\\]]*)\\]`, 'g');
    let run = false;
    let r;
    while ((r = runRe.exec(src)) !== null) {
      if (new RegExp(`\\b${exportedName}\\b`).test(r[1])) run = true;
    }
    result[ep] = { imported, run };
  }
  return result;
}

// The export name each spec file publishes, read from its source rather than
// assumed — a rename should break the check, not silently disable it.
function exportNameOf(rel) {
  const src = readFileSync(join(HERE, rel), 'utf8');
  const m = src.match(/export\s+(?:async\s+)?(?:function|const|let)\s+([A-Za-z_$][\w$]*)/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------- main

if (!existsSync(MANIFEST)) {
  console.error(`FATAL: no manifest at ${relative(process.cwd(), MANIFEST)}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const suites = manifest.suites || [];

// Every suite keyed by (file, key) — the pair is unique. Neither half is usable
// alone: the log CATEGORY repeats (GRP G1 is group CRUD in both entrypoints and
// the file-share guard is GUARD G1; MOVE M1 and MOBILE M1 coexist in the mobile
// runner), and `SOUND` covers three separate suites in each entrypoint (add,
// edit, delete). `key` is the manifest's own stable handle for the suite.
const seen = new Map();
for (const s of suites) {
  if (!s.key) err('NO_KEY', `suite "${s.title}" in ${s.file} has no manifest "key"`);
  const k = `${s.file}::${s.key}`;
  if (seen.has(k)) err('DUPLICATE_SUITE', `${k} is declared twice in the manifest`);
  seen.set(k, s);
}

let idCount = 0;
let touched = 0;
const orphans = [];
const syncFixes = [];

for (const s of suites) {
  const abs = join(HERE, s.file);
  if (!existsSync(abs)) {
    err('MISSING_FILE', `suite ${s.cat} claims file ${s.file}, which does not exist`);
    continue;
  }

  // (3) ids, both directions. An id belongs to a suite when it is logged under
  // that suite's category AND matches its idPattern — the namespace is the pair,
  // because `cat` alone cannot split a category (SOUND holds the add, edit and
  // delete suites in each entrypoint) and an id prefix alone cannot either
  // (mobile's MOBILE M1-M7 and MOVE M1-M22 both start with M).
  const { byCat } = scanFile(s.file);
  const inCat = byCat.get(s.cat);
  if (!inCat) {
    err('MISSING_SUITE_IN_CODE', `suite ${s.key} is declared in the manifest but no log('${s.cat}', ...) call exists in ${s.file}`);
    continue;
  }
  if (!s.idPattern) {
    err('NO_ID_PATTERN', `suite ${s.key} (${s.file}) has no "idPattern", so its tests cannot be told apart from the other suites sharing category ${s.cat}`);
    continue;
  }
  const re = new RegExp(s.idPattern);
  const actualIds = [...inCat].filter(id => re.test(id)).sort();
  // Disjointness: within one (file, category) the patterns must partition the
  // ids. An id claimed by two suites means both suites are wrong about it.
  for (const id of actualIds) {
    const owners = suites.filter(o => o.file === s.file && o.cat === s.cat && o.idPattern && new RegExp(o.idPattern).test(id));
    if (owners.length > 1) err('AMBIGUOUS_ID', `${s.file} ${s.cat} ${id} is claimed by ${owners.map(o => o.key).join(' and ')} — their idPatterns overlap`);
  }
  if (!actualIds.length) {
    err('EMPTY_SUITE', `suite ${s.key} (${s.file} ${s.cat}) matched no ids with /${s.idPattern}/ — is the pattern wrong, or the suite gone?`);
  }
  idCount += actualIds.length;

  const declared = new Set(s.ids || []);
  // In --update these two are the work being done, not findings — report them
  // as "would fix" so a clean re-sync does not look like a broken manifest.
  const idErr = (code, msg) => (UPDATE ? syncFixes.push(`${code}: ${msg}`) : err(code, msg));
  for (const id of declared) if (!actualIds.includes(id)) idErr('STALE_MANIFEST_ID', `${s.file} ${s.key}: manifest lists ${id}, which is not logged under ${s.cat} matching /${s.idPattern}/`);
  for (const id of actualIds) if (!declared.has(id)) idErr('UNREGISTERED_ID', `${s.file} ${s.key}: ${id} exists in the code but is not in the manifest`);

  // Anything in the category that no suite claims would be a test nobody
  // accounts for. Collected across suites, reported once.
  orphans.push(...[...inCat].filter(id => !re.test(id)).map(id => `${s.file} ${s.cat} ${id}`));

  if (UPDATE) {
    const next = actualIds;
    if (JSON.stringify(s.ids || []) !== JSON.stringify(next)) {
      s.ids = next;
      touched++;
    }
  }

  // (2) + (4) platform truth. Inline suites are pinned to their entrypoint's
  // phases; shared specs must be wired into both.
  const isSpec = s.file.startsWith(`${SPEC_DIR}/`);
  let actualPlatforms;

  if (isSpec) {
    const wiring = s.export ? wiringFor(basenameOf(s.file), s.export) : {};
    actualPlatforms = Object.entries(wiring).filter(([, w]) => w.imported && w.run).flatMap(([ep]) => ENTRYPOINTS[ep]);
    for (const [ep, w] of Object.entries(wiring)) {
      if (!w.imported) err('SPEC_NOT_IMPORTED', `${s.file} is not imported by ${ep} — it cannot run there`);
      else if (!w.run) err('SPEC_NOT_RUN', `${s.file} is imported by ${ep} but never passed to runSpecs() — it looks wired up and never executes`);
    }
    const ranOn = Object.entries(wiring).filter(([, w]) => w.imported && w.run).flatMap(([ep]) => ENTRYPOINTS[ep]);
    if (ranOn.length < Object.keys(ENTRYPOINTS).length) {
      err('SPEC_NOT_SHARED', `${s.file} runs on [${ranOn.join(', ')}] only; a shared spec must run on all of [${Object.values(ENTRYPOINTS).flat().join(', ')}]`);
    }
    if (!s.export) err('NO_EXPORT_NAME', `${s.file} has no manifest "export" field, so its wiring cannot be verified`);
  } else {
    actualPlatforms = ENTRYPOINTS[basenameOf(s.file)] || [];
    if (!actualPlatforms.length) err('NOT_AN_ENTRYPOINT', `${s.file} is not a known entrypoint (${Object.keys(ENTRYPOINTS).join(', ')})`);
  }

  // The manifest's own claim must agree with the derived truth.
  const declaredPlatforms = [...(s.platforms || [])].sort();
  const derived = [...new Set(actualPlatforms)].sort();
  if (JSON.stringify(declaredPlatforms) !== JSON.stringify(derived)) {
    err('PLATFORM_MISMATCH', `${s.file} ${s.cat}: manifest says [${declaredPlatforms.join(', ')}] but the code runs it on [${derived.join(', ')}]`);
  }
}

function basenameOf(p) {
  return p.slice(p.lastIndexOf('/') + 1);
}

// An id sitting in a category that NO suite in that category matches is a test
// nobody claims. (Matching "no suite" is per file+category, not per suite: the
// add suite's ^A\d naturally does not match the delete suite's D1, and that is
// correct, not an orphan.)
const byFileCat = new Map();
for (const o of orphans) {
  const [file, cat] = o.split(' ');
  if (!byFileCat.has(`${file} ${cat}`)) byFileCat.set(`${file} ${cat}`, []);
  byFileCat.get(`${file} ${cat}`).push(o);
}
for (const [fc, list] of byFileCat) {
  const [file, cat] = fc.split(' ');
  const claimed = new Set(
    [...(scanFile(file).byCat.get(cat) || [])].filter(id =>
      suites.some(o => o.file === file && o.cat === cat && o.idPattern && new RegExp(o.idPattern).test(id)))
  );
  for (const o of list) {
    const id = o.split(' ').pop();
    if (!claimed.has(id)) err('UNCLAIMED_ID', `${o} is logged under a category no manifest suite claims — add it to a suite's ids, or fix that suite's idPattern`);
  }
}

// Scanned files must all be declared, or a new suite can be added and simply
// never appear in the inventory.
const scanned = new Set(Object.keys(ENTRYPOINTS).filter(f => existsSync(join(HERE, f))));
if (existsSync(join(HERE, SPEC_DIR))) {
  for (const f of readdirSync(join(HERE, SPEC_DIR))) {
    if (f.endsWith('.mjs')) scanned.add(`${SPEC_DIR}/${f}`);
  }
}
for (const f of scanned) {
  if (!suites.some(s => s.file === f)) err('ORPHAN_FILE', `${f} is never referenced by the manifest — add a suite for it`);
}

// Every category present in a file must be CLAIMED by some suite. Without this,
// a category the scanner recognises but no manifest suite names is scanned by
// nobody: the id-sync checks only run for suites that exist, so its tests are
// never counted, never registered and never reported. That is how the keyboard
// suite sat in e2e-full.mjs for a whole session with no manifest entry.
const claimedCats = new Set(suites.map(s => `${s.file}::${s.cat}`));
for (const f of scanned) {
  for (const cat of scanFile(f).byCat.keys()) {
    if (!claimedCats.has(`${f}::${cat}`)) {
      err('UNCATEGORISED_SUITE', `${f} logs under category ${cat}, which no manifest suite claims — its tests are counted by nothing. Add a suite for it.`);
    }
  }
}

// (5) retired files must stay gone.
for (const r of manifest.retired || []) {
  if (existsSync(join(HERE, r))) err('RETIRED_PRESENT', `${r} is retired but is back on disk`);
  if (existsSync(join(dirname(HERE), r))) err('RETIRED_PRESENT', `${r} is retired but is back at the repo root`);
}

// ---- features: does every shipped capability actually have coverage? --------
// The suite registry above can only enforce that coverage does not ROT. It says
// nothing about coverage existing in the first place: ship a feature with no
// tests and every check above still passes. This block closes that, and it is
// the only thing that makes "will my new feature be tested?" answerable.

const features = manifest.features || [];
const gaps = [];
const shipRoot = dirname(HERE);

if (!features.length) err('NO_FEATURES', 'the manifest declares no features — the "is this feature covered?" question cannot be answered');

for (const f of features) {
  if (!f.name) { err('FEATURE_NO_NAME', 'a features[] entry has no "name"'); continue; }
  if (!['shipped', 'planned'].includes(f.status)) {
    err('FEATURE_BAD_STATUS', `feature "${f.name}" has status "${f.status}"; expected "shipped" or "planned"`);
    continue;
  }
  if (f.spec && !existsSync(join(shipRoot, f.spec))) {
    err('FEATURE_SPEC_MISSING', `feature "${f.name}" names spec ${f.spec}, which does not exist`);
  }
  const covered = f.coveredBy || [];
  for (const ref of covered) {
    if (!seen.has(ref)) err('FEATURE_BAD_REF', `feature "${f.name}" points at suite "${ref}", which is not in the manifest`);
  }
  if (f.status === 'shipped' && !covered.length) {
    // The whole point of this block. A shipped feature with no tests must be
    // either covered or carry an explicit, reported reason.
    if (f.gap) gaps.push(f);
    else err('FEATURE_UNCOVERED', `feature "${f.name}" is shipped but has no covering suite and no recorded gap`);
  }
  if (f.status === 'planned' && covered.length) {
    err('FEATURE_PREMATURELY_COVERED', `feature "${f.name}" is planned, not implemented, but claims a covering suite — either it shipped or the suite is wrong`);
  }
}

// Non-test labels are suite footers ("Suite S") and skip paths ("drag skipped").
// Legitimate, but printed so a log() call that silently lost its id is visible.
const nonTest = [];
for (const f of scanned) nonTest.push(...scanFile(f).nonTestLabels);

if (UPDATE) {
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`manifest updated: ${touched} suite(s) had their ids rewritten from the code`);
  for (const f of syncFixes) console.log(`  re-synced: ${f}`);
}

// ---------------------------------------------------------------- report

const shared = suites.filter(s => s.file.startsWith(`${SPEC_DIR}/`));
const inline = suites.filter(s => !s.file.startsWith(`${SPEC_DIR}/`));

console.log('\nE2E COVERAGE');
console.log('======================================================');
for (const [file, phases] of Object.entries(ENTRYPOINTS)) {
  const n = suites.filter(s => s.file === file).reduce((t, s) => t + (s.ids || []).length, 0);
  console.log(`  ${file.padEnd(16)} ${phases.join(' + ').padEnd(12)} ${String(suites.filter(s => s.file === file).length).padStart(2)} suites  ${String(n).padStart(3)} tests`);
}
for (const s of shared) {
  console.log(`  ${s.file.padEnd(28)} shared       ${String((s.ids || []).length).padStart(2)} tests   [${(s.platforms || []).join(', ')}]  ${s.covers}`);
}
console.log('------------------------------------------------------');
console.log(`  ${inline.length} inline suites + ${shared.length} shared specs = ${suites.length} suites, ${idCount} tests`);
console.log(`  static counts only — a test logged from both arms of an if/else, or`);
console.log(`  from a platform branch, is one id but can emit two results at runtime.`);
console.log(`  The E2E summary is the authority on how many actually ran.`);
if (nonTest.length) console.log(`  ${nonTest.length} non-test log labels (suite footers / skips): ${[...new Set(nonTest)].join(', ')}`);
for (const n of notes) console.log(`  note: ${n}`);

const shipped = features.filter(f => f.status === 'shipped');
const planned = features.filter(f => f.status === 'planned');
console.log('------------------------------------------------------');
console.log(`  features: ${shipped.length} shipped, ${planned.length} planned, ${shipped.filter(f => (f.coveredBy || []).length).length} shipped features covered`);
if (gaps.length) {
  console.log(`  ${gaps.length} shipped feature(s) with a RECORDED coverage gap (not a failure, but not quiet):`);
  for (const g of gaps) console.log(`    - ${g.name}: ${g.gap}`);
}
for (const p of planned) console.log(`  planned, no coverage expected: ${p.name}${p.spec ? ` (${p.spec})` : ''}`);

if (findings.length) {
  console.log('------------------------------------------------------');
  console.log(`  ${findings.length} FINDING(S):`);
  for (const f of findings) console.log(`    ${f}`);
  console.log('======================================================');
  process.exit(1);
}

console.log('  OK — manifest, code and platform wiring agree.');
console.log('======================================================');
process.exit(0);
