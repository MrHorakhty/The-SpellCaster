// e2e-snapshot.mjs - crash-safe localStorage AND uploads snapshot/restore for the
// E2E harness.
//
// The suites already snapshot localStorage at start and restore it at the end
// (SAVE_RESTORE=1), but that restore only runs if the suite survives: when a run
// crashes the app or is killed, the E2E seed data is left behind in the app. This
// script is called by the runner instead, so the snapshot is taken before the suite
// starts and restored from the runner's finally block regardless of how node exits.
//
// ⚠️ UPLOADS WERE MISSING HERE, AND THAT COST THE USER REAL DATA (2026-10-11).
// localStorage was protected; the Tauri uploads/ directory was not. A Windows run
// therefore wrote into the real install's audio folder - and when profiles landed,
// the one-time uploads MIGRATION MOVED the user's 112 files into a profile
// subdirectory, which their already-installed older app could not find. The claim
// "test data never clobbers real characters/sounds" was true for localStorage and
// false for uploads. `save-uploads` / `restore-uploads` close that gap.
//
// Note the installed app and the dev build share ONE AppData directory: Tauri
// resolves AppData to %APPDATA%\<identifier> and both use the same identifier, so
// a test run is writing into the real install's data, not a sandbox.
//
// Usage (CDP_PORT / LABEL env, same as the other suites):
//   node e2e-snapshot.mjs save           <file>   # localStorage, via CDP
//   node e2e-snapshot.mjs restore        <file>   # localStorage, via CDP
//   node e2e-snapshot.mjs save-uploads   <dir>    # plain filesystem, NO CDP
//   node e2e-snapshot.mjs restore-uploads <dir>   # plain filesystem, NO CDP
//
// Exit codes: 0 ok, 3 app/CDP unreachable, 4 bad usage or unusable snapshot,
//             5 restore applied but the store did not match it afterwards (the app
//               rewrote storage on boot - treat the restore as NOT done).
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, rmSync, cpSync, renameSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEBUG_PORT = process.env.CDP_PORT || 9225;
const LABEL = process.env.LABEL || 'SNAP';
const [mode, file] = process.argv.slice(2);

const log = (...a) => console.log(`[${LABEL}]`, ...a);

const LS_MODES = ['save', 'restore'];
const FS_MODES = ['save-uploads', 'restore-uploads'];

if (![...LS_MODES, ...FS_MODES].includes(mode) || !file) {
  console.error(`[${LABEL}] usage: node e2e-snapshot.mjs save|restore <file>`);
  console.error(`[${LABEL}]        or: node e2e-snapshot.mjs save-uploads|restore-uploads <dir>`);
  process.exit(4);
}

// --- filesystem modes: uploads/ -------------------------------------------
//
// These deliberately run BEFORE any CDP connection. The uploads directory is an
// ordinary folder, and it has to be restorable when the app is already dead -
// which is exactly when a crashed run needs it most.
if (FS_MODES.includes(mode)) {
  // Derived from tauri.conf.json rather than hard-coded, so a bundle identifier
  // change cannot silently point the snapshot at the wrong folder.
  let identifier;
  try {
    identifier = JSON.parse(readFileSync(join(ROOT, 'src-tauri', 'tauri.conf.json'), 'utf8')).identifier;
  } catch (err) {
    console.error(`[${LABEL}] FAILED: could not read the bundle identifier: ${err.message}`);
    process.exit(4);
  }
  const appData = process.env.APPDATA || process.env.HOME;
  const uploads = join(appData, identifier, 'uploads');

  if (mode === 'save-uploads') {
    if (!existsSync(uploads)) {
      log(`no uploads directory at ${uploads} - nothing to protect`);
      process.exit(0);
    }
    try {
      rmSync(file, { recursive: true, force: true });
      mkdirSync(dirname(file), { recursive: true });
      cpSync(uploads, file, { recursive: true });
      const n = countFiles(file);
      log(`saved ${n} upload file(s) -> ${file}`);
      process.exit(0);
    } catch (err) {
      console.error(`[${LABEL}] FAILED: could not snapshot uploads: ${err.message}`);
      process.exit(4);
    }
  }

  // restore-uploads
  if (!existsSync(file)) {
    console.error(`[${LABEL}] FAILED: uploads snapshot ${file} does not exist - live files left untouched.`);
    process.exit(4);
  }
  if (countFiles(file) === 0) {
    console.error(`[${LABEL}] FAILED: uploads snapshot is empty - live files left untouched.`);
    process.exit(4);
  }
  // Put the live folder aside first so a failure can put it back, rather than
  // deleting the user's audio and discovering the copy was bad afterwards.
  const aside = `${uploads}.__restore_backup`;
  try {
    rmSync(aside, { recursive: true, force: true });
    if (existsSync(uploads)) renameSync(uploads, aside);
  } catch (err) {
    console.error(`[${LABEL}] FAILED: could not set the live uploads aside: ${err.message}`);
    process.exit(4);
  }
  try {
    cpSync(file, uploads, { recursive: true });
  } catch (err) {
    try { if (existsSync(aside)) renameSync(aside, uploads); } catch { /* reported below */ }
    console.error(`[${LABEL}] FAILED: could not restore uploads (${err.message}); the previous folder was put back.`);
    process.exit(4);
  }
  rmSync(aside, { recursive: true, force: true });
  log(`restored ${countFiles(uploads)} upload file(s) from ${file}`);
  process.exit(0);
}

function countFiles(dir) {
  let total = 0;
  const walk = d => {
    let entries;
    try { entries = readdirSync(d); } catch { return; }
    for (const e of entries) {
      const p = join(d, e);
      try { if (statSync(p).isDirectory()) walk(p); else total++; } catch { /* racing delete */ }
    }
  };
  walk(dir);
  return total;
}

async function connect() {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error(`no page target on :${DEBUG_PORT}`);
  return page.webSocketDebuggerUrl;
}

const wsUrl = await connect().catch(err => {
  console.error(`[${LABEL}] FAILED: app not reachable on :${DEBUG_PORT} (${err.message}). ` +
    `If the suite crashed the app, the snapshot was NOT restored - rerun this script once the app is up.`);
  process.exit(3);
});

const ws = new WebSocket(wsUrl);
let seq = 0;
const pending = new Map();
let closed = false;

ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
ws.addEventListener('close', () => { closed = true; });

const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  if (closed) return reject(new Error('socket closed'));
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
  setTimeout(() => { if (pending.delete(id)) reject(new Error(`${method} timed out`)); }, 20000);
});

await new Promise(r => ws.addEventListener('open', r));

const evalJs = async expression => {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text || 'evaluate failed');
  return r.result?.result?.value;
};

if (mode === 'save') {
  const dump = await evalJs(
    `JSON.stringify(Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).map(k=>[k,localStorage.getItem(k)])))`
  );
  if (!dump || dump === '{}') {
    console.error(`[${LABEL}] FAILED: app storage is empty - refusing to write an empty snapshot.`);
    process.exit(4);
  }
  writeFileSync(file, dump);
  const keys = Object.keys(JSON.parse(dump)).length;
  log(`saved ${keys} localStorage keys (${statSync(file).size} bytes) -> ${file}`);
  ws.close();
  process.exit(0);
}

// restore - never clear storage unless we actually have data to put back
if (!existsSync(file)) {
  console.error(`[${LABEL}] FAILED: snapshot ${file} does not exist - storage left untouched.`);
  process.exit(4);
}
const raw = readFileSync(file, 'utf8');
let data;
try { data = JSON.parse(raw); } catch { data = null; }
if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
  console.error(`[${LABEL}] FAILED: snapshot ${file} is empty or corrupt - storage left untouched.`);
  process.exit(4);
}

const applied = await evalJs(`(() => {
  const o = ${JSON.stringify(data)};
  localStorage.clear();
  for (const k of Object.keys(o)) localStorage.setItem(k, o[k]);
  return Object.keys(o).length;
})()`);
log(`restored ${applied} localStorage keys from ${file}`);

// 🔴 PROVE THE RELOAD HAPPENED. This line used to be
// `await cdp('Page.reload', ...).catch(() => {})` followed by an unconditional
// "page reloaded so the app re-reads storage" - and the swallow meant a failed
// reload was reported as a successful one. The verify below then passes anyway,
// because it re-reads `localStorage`, which IS correct even when the page never
// navigated. That combination is theatre: with no reload the app keeps the board
// it loaded at boot in React state, the next state change re-persists it over
// the restore, and the "restored and verified" run leaves the fixture on disk.
//
// Observed 2026-10-14: a suite that CRASHED before its own restore left exactly
// that state behind - the in-page store matched the snapshot, and the live
// WebView2 store held the test fixture instead.
//
// So: stamp a marker, reload, and require the marker to be gone. A reload that
// did not happen is a hard failure, not a warning.
await evalJs(`(() => { window.__restoreMarker = 'pre-reload'; return 'stamped'; })()`);
let reloadError = null;
try {
  await cdp('Page.reload', { ignoreCache: true });
} catch (err) {
  reloadError = err && err.message;
}
await new Promise(r => setTimeout(r, 3000));
const markerGone = await evalJs(`typeof window.__restoreMarker === 'undefined'`).catch(() => false);

if (reloadError || markerGone !== true) {
  console.error(`[${LABEL}] FAILED: the page did not reload, so the app is still holding the pre-restore board in memory and will write it back over this restore.`);
  if (reloadError) console.error(`[${LABEL}]        Page.reload error: ${reloadError}`);
  if (markerGone !== true) console.error(`[${LABEL}]        the pre-reload marker survived, i.e. no navigation occurred`);
  console.error(`[${LABEL}]        Snapshot kept at: ${file}`);
  console.error(`[${LABEL}]        Recover with: close the app by hand, then rerun this script.`);
  ws.close();
  process.exit(6);
}
log('page reloaded (marker gone) so the app re-reads storage');

// ⚠️ VERIFY, because "restored N keys" used to be a claim nobody checked and it was
// wrong. On 2026-10-11 the 22:15 Windows run reported "restored 7 localStorage keys",
// reloaded, and was then hard-killed seconds later. WebView2 commits localStorage to
// its backing store ASYNCHRONOUSLY, so the restore never reached disk: the next run's
// snapshot 11 minutes later held a *different* profile (Suite F's "My Board",
// p_9a1ed119) where the user's real one (p_09b2806c) had been. The board was lost
// that way, not by any single test.
//
// So re-read the store and compare key-by-key against the snapshot. This proves the
// in-page state; it cannot prove the on-disk flush, which is why the runner also
// settles before killing (e2e-full.ps1) and why a mismatch is a hard failure rather
// than a warning - a silently unrestored store is the failure mode that costs data.
const check = await evalJs(`(() => {
  const o = ${JSON.stringify(data)};
  const now = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) now[k] = localStorage.getItem(k); }
  const missing = Object.keys(o).filter(k => !(k in now));
  const extra = Object.keys(now).filter(k => !(k in o));
  const changed = Object.keys(o).filter(k => k in now && now[k] !== o[k]);
  return { total: Object.keys(now).length, want: Object.keys(o).length, missing, extra, changed };
})()`);

if (check.missing.length || check.extra.length || check.changed.length) {
  console.error(`[${LABEL}] FAILED: the store does not match the snapshot after reload.`);
  if (check.missing.length) console.error(`[${LABEL}]        missing: ${check.missing.join(', ')}`);
  if (check.extra.length)  console.error(`[${LABEL}]        extra:   ${check.extra.join(', ')}`);
  if (check.changed.length) console.error(`[${LABEL}]        changed: ${check.changed.join(', ')}`);
  console.error(`[${LABEL}]        The app rewrote storage on boot. Treat the restore as NOT done.`);
  console.error(`[${LABEL}]        Snapshot kept at: ${file}`);
  ws.close();
  process.exit(5);
}
log(`verified: ${check.total} keys match the snapshot exactly`);
ws.close();
process.exit(0);
