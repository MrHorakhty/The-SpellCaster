// Shared profile-bundle spec (Suite I, I1-I17) - PROFILE_SYNC_SPEC.md step 8.
//
// Steps 3-6 shipped `src/profileBundle.js` (the `.spellcaster` format) and the
// Settings > Profiles UI on 2026-10-13, and the user hand-tested the feature on
// 2026-10-14 - including exporting on the web build and importing into the
// Android build. `node e2e/profileBundle.check.mjs` already drives the whole
// engine in node against a fake store (36 assertions). This spec is the half
// that file cannot reach: the REAL store on each platform (Tauri AppData files
// under Windows, localStorage data-URLs on web), the REAL `profileStorage` and
// `profileBundle` modules the app is running, and the REAL `grant_path` /
// `writeFile` / `readFile` IPC behind the UI.
//
// 🔴 WHY THERE IS NO NATIVE PICKER STUB HERE, MEASURED NOT GUESSED.
// The obvious approach is to wrap `window.__TAURI_INTERNALS__.invoke` and return
// a path for `plugin:dialog|save`. It cannot work, and on 2026-10-14 it was
// tried and measured:
//   * every property on `window.__TAURI_INTERNALS__` - `invoke`, `ipc`,
//     `postMessage`, `transformCallback` - is `writable:false, configurable:false`,
//     and so is `window.__TAURI_INTERNALS__` itself. Neither the method nor the
//     object can be replaced;
//   * the one writable seam found, `window.chrome.webview.postMessage`, also has
//     no effect, because Tauri's injected `ipc` captured that function in a
//     closure at init and calls the captured reference.
// So a real Win32 `#32770` dialog - which nothing over CDP can dismiss - is
// unavoidable for any test that clicks Export or Import. This spec therefore
// drives everything BELOW the picker: the same `grant_path` + `writeFile` +
// `readFile` sequence `handleExportProfile` performs, against a path the test
// names. The only link left to a human is the two-line handoff of the picker's
// answer, which the user's hand-test covers. Clicking those buttons here would
// open a dialog and wedge the run, so the spec never does.
//
// ID PREFIX I: `F` is taken by Suite F, and `I` was verified free in
// coverage.manifest.json before this suite existed. Run
// `node e2e/check-coverage.mjs --update` after adding ids.
//
// 🔴 THIS SPEC MUST NOT THROW. An exception here does not fail one test: it
// unwinds `main()`, which SKIPS the entrypoint's localStorage restore block and
// leaves the E2E fixture on disk in the user's real store. That happened on
// 2026-10-14 and the runner's backstop restore was defeated in turn (see
// e2e-snapshot.mjs). So `run()` is wrapped, every page result is dereferenced
// defensively, and a failed prerequisite FAILS the ids that depend on it
// rather than taking the suite down with it.

import { unzipSync, zipSync, strToU8 } from 'fflate';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PAGE_HELPERS } from '../lib/page.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// The shipped asset the fixture's bundled sound points at. Hashed from disk so
// the "the bundle does not carry shipped audio" assertion is real: see I5.
const BUNDLED_ASSET_PATH = join(HERE, '..', '..', 'public', 'assets', 'Longbow_4.mp3');

// ---- Node-side helpers ------------------------------------------------------

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const toBytes = (b64) => new Uint8Array(Buffer.from(b64, 'base64'));

// Structural JSON comparison that ignores key ORDER. The imported board is
// rebuilt object-by-object on the way through pruneUnresolvableSounds and
// commitKeys, so a raw string compare would be testing JS property order rather
// than the data. Values are still compared exactly.
function canon(value) {
  if (Array.isArray(value)) return '[' + value.map(canon).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canon(value[k])).join(',') + '}';
  }
  return JSON.stringify(value === undefined ? null : value);
}

const sameJson = (a, b) => canon(a) === canon(b);

// Every sound in the four REACHABLE container shapes. `groups[].sounds` is the
// vestigial array the app wipes on read (normalizeStoredData returns
// sounds: []), so it is deliberately not counted - asserting on it is the
// unpassable test both older specs warned about.
function countSounds(data) {
  let n = 0;
  for (const c of data.characters || []) n += (c.sounds || []).length;
  for (const c of data.environmentSounds || []) n += (c.sounds || []).length;
  for (const g of data.groups || []) {
    for (const c of g.categories || []) n += (c.sounds || []).length;
    for (const c of g.characters || []) n += (c.sounds || []).length;
  }
  return n;
}

// How many SOUNDS point at a given installed blob name. Counted per sound, not
// per occurrence of the string: rewriteSound writes the content-addressed name
// into `name`, `storedName` AND `url`, so a text search reports six hits for two
// sounds and the assertion would be measuring the wrong thing.
function soundsReferencing(data, storedName) {
  let n = 0;
  const tally = (sounds) => {
    for (const s of sounds || []) if ((s.files || []).some(f => f.storedName === storedName)) n++;
  };
  for (const c of data.characters || []) tally(c.sounds);
  for (const c of data.environmentSounds || []) tally(c.sounds);
  for (const g of data.groups || []) {
    for (const c of g.categories || []) tally(c.sounds);
    for (const c of g.characters || []) tally(c.sounds);
  }
  return n;
}

// ---- in-page helpers (wiped by every reload, so re-injected) ----------------

const HELPERS = `window.__bk = {};
window.__bk.b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); };
window.__bk.unb64 = (b64) => { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
// Vite dev serves the dependency's source under node_modules; the app's own
// import is rewritten to the same file, so this is the live module. Several
// paths are tried because the layout is a Vite implementation detail, not an
// API - a miss is reported rather than thrown, so a rename cannot kill the run.
window.__bk.mod = async (paths) => {
  let last = '';
  for (const p of paths) { try { return await import(p); } catch (e) { last = String(e && e.message); } }
  throw new Error('none of ' + paths.join(' / ') + ' could be imported (' + last + ')');
};
window.__bk.fs = () => window.__bk.mod([
  '/node_modules/@tauri-apps/plugin-fs/dist-js/index.js',
  '/node_modules/.vite/deps/@tauri-apps_plugin-fs.js'
]);
window.__bk.core = () => window.__bk.mod([
  '/node_modules/@tauri-apps/api/core.js',
  '/node_modules/.vite/deps/@tauri-apps_api_core.js'
]);
// The SAME module URLs the app imported, so this is the app's live module and not
// a second copy of it. Only the dev server serves /src/, which is why the web
// phase (vite preview on a built dist) runs I1 and I2 only - export/import is
// Tauri-only by design (PROFILE_SYNC_SPEC.md §7).
window.__bk.load = async () => {
  const B = await import('/src/profileBundle.js');
  const P = await import('/src/profileStorage.js');
  window.__bk.B = B; window.__bk.P = P;
  return 'loaded';
};
window.__bk.dump = (pid) => { const out = {}; for (const n of window.__keysFor(pid)) out[n] = localStorage.getItem('profile:' + pid + ':' + n); return out; };
// Delete a blob this spec itself uploaded, to reproduce an ORPHANED REFERENCE: a
// board that still points at a storedName whose file is gone. That is the state
// the user's hand-test hit on 2026-10-15, and it is the only way to reach the
// export refusal from here - the refactor under test is the MESSAGE.
//
// ⚠️ Only ever call this with a storedName this run uploaded. The Windows phase
// snapshots and restores uploads/, so a mistake is recoverable; on web it is a
// localStorage key. Deleting a name the suite did not create would be a user file.
window.__bk.deleteOwnBlob = async (pid, storedName) => {
  try {
    const fs = await window.__bk.fs();
    await fs.remove('uploads/' + pid + '/' + storedName, { baseDir: fs.BaseDirectory.AppData });
    return { ok: true, stillThere: !!(await fs.exists('uploads/' + pid + '/' + storedName, { baseDir: fs.BaseDirectory.AppData })) };
  } catch (err) {
    return { ok: false, raw: String(err && err.message ? err.message : err) };
  }
};
// exportProfile, but reporting a refusal instead of throwing it out of the page.
window.__bk.exportCatching = async (pid, dataVersion) => {
  try {
    const r = await window.__bk.exportProfile(pid, dataVersion);
    return { ok: true, sounds: r.manifest.counts.sounds };
  } catch (err) {
    return { ok: false, code: err && err.code, message: String(err && err.message) };
  }
};
window.__bk.profiles = () => { const i = window.__bk.P ? window.__bk.P.readProfileIndex() : JSON.parse(localStorage.getItem('spellcaster_profiles') || 'null'); return { active: i?.activeProfileId || null, count: (i?.profiles || []).length }; };
// Mirror of the app's own handleExportProfile input assembly: LIVE settings, and
// the board slices read back out of this profile's own storage.
window.__bk.exportProfile = async (pid, dataVersion) => {
  const B = window.__bk.B, P = window.__bk.P;
  const name = (P.readProfileIndex().profiles.find(p => p.id === pid) || {}).name;
  const read = k => P.readProfileValue(pid, k);
  const bg = read('backgroundSettings');
  const collected = B.collectProfileForExport({
    boxSize: parseFloat(read('boxSize') || '1'),
    backgroundSettings: bg ? JSON.parse(bg) : {},
    charSectionIcon: read('ttrpg_characters_icon') || '',
    envSectionIcon: read('ttrpg_environment_icon') || '',
    parse: read
  });
  const res = await B.exportBundle({ profileId: pid, profileName: name, data: collected.data, settings: collected.settings, appVersion: 'e2e', dataVersion });
  window.__bk.bytes = res.bytes;
  return { b64: window.__bk.b64(res.bytes), manifest: res.manifest, data: res.data, isUint8Array: res.bytes instanceof Uint8Array, isArray: Array.isArray(res.bytes) };
};
// Pass-through normalizer. The imported board is already in normalized shape -
// it came out of this same app's normalizer - so identity is the CORRECT value
// here, not a shortcut. What proves the shape is right is I12: a reload runs the
// app's real normalizeStoredData over the result and must change nothing.
//
// The store is wrapped rather than left to defaultBlobStore so that a failed
// blob write reports WHY. importBundle catches per-file write errors, logs them
// to the console (which this harness does not capture) and reports only the
// file name - so a real desktop failure arrives as "1 file(s) could not be
// written" with nothing to act on.
window.__bk.makeStore = (resolvePid) => {
  const B = window.__bk.B;
  const errs = [];
  const real = () => B.defaultBlobStore(resolvePid());
  return {
    errs,
    async read(n) { return real().read(n); },
    async list() { return real().list(); },
    async has(n) { return real().has(n); },
    async write(n, bytes) {
      try {
        return await real().write(n, bytes);
      } catch (err) {
        // A Tauri IPC rejection is not an Error: the JS invoke helper rejects with
        // the deserialised Rust error, which is a bare STRING. So err.message is
        // undefined and String(err) is the reason - printing err.message alone
        // reported "undefined" and cost a whole four-minute run to learn.
        errs.push({
          name: n,
          raw: String(err),
          message: err && err.message,
          ctor: bytes && bytes.constructor && bytes.constructor.name,
          len: bytes && bytes.length,
          byteOffset: bytes && bytes.byteOffset,
          bufferBytes: bytes && bytes.buffer && bytes.buffer.byteLength,
        });
        throw err;
      }
    },
  };
};
window.__bk.blobShape = (b64, path) => {
  try {
    const parsed = window.__bk.B.parseBundle(window.__bk.unb64(b64));
    const b = parsed.files.get(path);
    return b ? { ctor: b.constructor.name, len: b.length, byteOffset: b.byteOffset, bufferBytes: b.buffer.byteLength } : 'NO_FILE';
  } catch (err) { return 'ERR ' + String(err && err.message); }
};
window.__bk.importBundle = async (b64, mode, target, setActive) => {
  // The target profile is settled inside importBundle, so the store resolves it
  // lazily: a new import appends the profile to the index, a replace targets the
  // one it was given.
  const store = window.__bk.makeStore(() => {
    if (mode === 'replace') return target;
    const i = window.__bk.P.readProfileIndex();
    return i.profiles[i.profiles.length - 1].id;
  });
  try {
    const report = await window.__bk.B.importBundle(window.__bk.unb64(b64), {
      mode, targetProfileId: target, store, normalize: (k, v) => v, dataVersion: '3',
      setActive: setActive === false ? false : undefined,
    });
    return { ok: true, profileId: report.profileId, profileName: report.profileName, imported: report.imported, skipped: report.skipped, files: report.files, dropped: report.dropped, storeErrors: store.errs };
  } catch (err) {
    // storeErrors rides on the FAILURE path too. importBundle's own report names
    // the file and nothing else, and the underlying reason goes to a console this
    // harness does not capture - so without this a real failure arrives as
    // "1 file(s) could not be written" with nothing to act on.
    return { ok: false, code: err && err.code, message: String(err && err.message), storeErrors: store.errs };
  }
};
window.__bk.readBlob = async (pid, name) => {
  const bytes = await window.__bk.B.defaultBlobStore(pid).read(name);
  return bytes ? { len: bytes.length, b64: window.__bk.b64(bytes) } : null;
};
// The app's own export destination sequence, minus the dialog: grant the exact
// file (desktop), write the bytes, read them back. Replicates App.jsx
// handleExportProfile lines 1006-1019 exactly, which is the point - the
// §11 risk 8 Array trap and the corrupt-write check live in those lines.
// Desktop takes an absolute path, because that is what dialog.save() returns and
// what grant_path expects; Android cannot be handed a path at all, so it writes
// inside AppData - enough to put the bytes through the same IPC, and the parent
// directory is created first because writeFile will not do it (the desktop
// destination is a pre-existing temp file, which is also what a real save dialog
// hands back).
//
// A Tauri IPC rejection is not an Error - the JS invoke helper rejects with the
// deserialised Rust error, a bare STRING - so err.message is undefined. String(err)
// is the reason; err.message alone reported "undefined" and cost a run to learn.
window.__bk.parentOf = (p) => { const i = String(p).lastIndexOf('/'); return i > 0 ? p.slice(0, i) : ''; };
window.__bk.writeBundle = async (path, isDesktop) => {
  try {
    if (!window.__bk.bytes) return { ok: false, message: 'window.__bk.bytes is gone - a reload wiped it before the write' };
    const F = await window.__bk.fs();
    const opts = isDesktop ? undefined : { baseDir: F.BaseDirectory.AppData };
    if (!isDesktop) {
      const parent = window.__bk.parentOf(path);
      if (parent) await F.mkdir(parent, { baseDir: F.BaseDirectory.AppData, recursive: true });
    } else {
      const { invoke } = await window.__bk.core();
      await invoke('grant_path', { path });
    }
    await F.writeFile(path, window.__bk.B.assertUint8Array(window.__bk.bytes), opts);
    const back = await F.readFile(path, opts);
    return { ok: true, len: back.length, magic: back[0] + ',' + back[1], b64: window.__bk.b64(back) };
  } catch (err) {
    return { ok: false, message: String(err && err.message ? err.message : err) };
  }
};
window.__bk.readBundleFile = async (path, isDesktop) => {
  try {
    const F = await window.__bk.fs();
    if (isDesktop) { const { invoke } = await window.__bk.core(); await invoke('grant_path', { path }); }
    const opts = isDesktop ? undefined : { baseDir: F.BaseDirectory.AppData };
    const back = await F.readFile(path, opts);
    return { ok: true, len: back.length, b64: window.__bk.b64(back) };
  } catch (err) {
    return { ok: false, message: String(err && err.message ? err.message : err) };
  }
};
window.__bk.removeBundleFile = async (path, isDesktop) => {
  try {
    const F = await window.__bk.fs();
    const opts = isDesktop ? undefined : { baseDir: F.BaseDirectory.AppData };
    if (await F.exists(path, opts)) await F.removeFile(path, opts);
    return 'removed';
  } catch (err) { return 'ERR ' + String(err && err.message ? err.message : err); }
};
'ok'`;

const UI_HELPERS = `window.__ui = {
  openSettings: () => {
    const l = [...document.querySelectorAll('button[title="Settings"]')];
    const b = l.find(x => x.offsetParent !== null) || l[0];
    if (!b) return 'NO_SETTINGS_BTN';
    b.click(); return 'OK';
  },
  section: () => !!document.querySelector('[data-bundle-section]'),
  click: (sel) => { const b = document.querySelector(sel); if (!b) return 'NO:' + sel; b.click(); return 'OK'; },
  mode: (m) => {
    const b = document.querySelector('[data-import-mode="' + m + '"]');
    if (!b) return 'NO_MODE_BTN';
    b.click(); return 'OK';
  },
  pressed: (m) => document.querySelector('[data-import-mode="' + m + '"]')?.getAttribute('aria-pressed') || null
};`;

// ---- the fixture ------------------------------------------------------------
//
// One profile, four reachable container shapes, one REAL upload (minted through
// the sound modal, so the storedName and the bytes are the app's own), one sound
// that merely LOOKS uploaded but is not (no storedName -> bundled), and
// settings including a background image preview that must not travel.
const SEED = `(() => {
  const bundled = (id, name, type) => ({ id, name, type, icon:'Icon.png',
    files:[{ name:'Longbow_4.mp3', displayName:'Longbow_4.mp3' }],
    color:'#ff0000', glowColor:'#00ffcc', duration:0, fadeIn:0, fadeOut:0, loop:false, randomPlay:false, brightness:1, volume:1 });
  window.__pseed({
    ttrpg_characters: [
      { id:'bk_c1', name:'Hero', sounds:[ bundled('bk_s1','Shipped Bow','Ranged') ] },
      { id:'bk_c2', name:'Elf Sorcerer', sounds:[] }
    ],
    ttrpg_environment: [ { id:'bk_e1', category:'Dungeon', sounds:[ bundled('bk_es1','Ambient Drip','Ambient') ] } ],
    ttrpg_groups: [ { id:'bk_g1', name:'Tavern Pack', mode:'environment',
      categories:[ { id:'bk_gc1', category:'Ambience', sounds:[ bundled('bk_gs1','Tavern Song','Music') ] } ],
      characters:[ { id:'bk_gch1', name:'Barkeep', sounds:[ bundled('bk_gchs1','Round One','Tavern') ] } ] } ],
    ttrpg_themes: [],
    ttrpg_data_version: '3',
    boxSize: '1.4',
    backgroundSettings: { type:'color', theme:'Ocean', color:'#0b1220', imageFile:'bg.png', imagePreview:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' },
    ttrpg_characters_icon: 'Shield',
    ttrpg_environment_icon: 'Castle'
  });
  return 'seeded';
})()`;

const SEED_ONLY_CHARACTER = `(() => {
  window.__pseed({ ttrpg_characters: [{ id:'bk_c1', name:'Hero', sounds:[] }] });
  return 'stripped';
})()`;

// Give a second character a sound that SHARES the upload's storedName. That is
// exactly the shape move/copy leaves behind (a copy references the source's
// bytes rather than duplicating them), and it is the case a bundle gets wrong if
// it dedupes by reference count instead of by content.
const shareTheUpload = (newId) => `(() => {
  const pid = window.__pid();
  const list = JSON.parse(localStorage.getItem('profile:' + pid + ':ttrpg_characters') || '[]');
  let source = null;
  for (const c of list) for (const s of c.sounds || []) if ((s.files || []).some(f => f.storedName)) source = s;
  const other = list.find(c => !((c.sounds || []).some(s => (s.files || []).some(f => f.storedName))));
  if (!source || !other) return 'NO_SHARE_TARGET';
  other.sounds = (other.sounds || []).concat([Object.assign({}, source, { id: '${newId}', name: 'Uploaded Roar (copy)' })]);
  localStorage.setItem('profile:' + pid + ':ttrpg_characters', JSON.stringify(list));
  return 'shared';
})()`;

export const bundle = {
  title: 'SUITE I: PROFILE BUNDLES (EXPORT / IMPORT)',
  async run(ctx) {
    const { log, evalJs, sleep, reload, isTauri, driver, submitModal, upload, navigateTo, clickModalOpener } = ctx;
    const ok = (cond) => (cond ? 'PASS' : 'FAIL');
    const isDesktop = driver.isDesktop;

    // Anything skipped because the platform cannot express it is PRINTED, not
    // logged: a WARN would push the web phase off its exit-0 baseline, and a
    // silent omission would read as coverage.
    const skip = (ids, why) => console.log(`[BUNDLE] SKIP ${ids}: ${why}`);

    const rehydrate = async () => {
      await evalJs(PAGE_HELPERS);
      await evalJs(HELPERS);
      await evalJs(UI_HELPERS);
      // Every page load wipes window.__bk, including the module references. This
      // was missed once and every later id failed with "cannot read properties of
      // undefined" - a self-inflicted version of the trap this harness keeps
      // warning about with __setInput.
      if (isTauri) await evalJs(`window.__bk.load()`);
    };

    // A prerequisite that failed must FAIL the ids that depend on it, loudly and
    // by name - never by throwing, and never by silently passing.
    const bail = (ids, reason) => {
      for (const id of ids) log('BUNDLE', `${id}: not run - an earlier prerequisite failed`, 'FAIL', reason);
      console.log(`[BUNDLE] BAIL after: ${reason}`);
    };

    try {
      // ============================ fixture ============================
      await evalJs(`(() => {
        for (let i = localStorage.length - 1; i >= 0; i--) localStorage.removeItem(localStorage.key(i));
        return 'cleared';
      })()`);
      await reload();
      await rehydrate();

      const pid = await evalJs(`window.__pid()`);
      await evalJs(SEED);
      await reload();
      await rehydrate();

      // A REAL upload, through the sound modal, so the storedName and the bytes
      // are the app's own and not a string this spec invented.
      await navigateTo('Hero');
      await driver.enterEditMode();
      const openedModal = await clickModalOpener('Add Sound');
      await sleep(700);
      await evalJs(`(() => {
        const el = document.querySelector('input[name="name"]');
        if (!el) return 'NO_INPUT';
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, 'Uploaded Roar');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return 'OK';
      })()`);
      const uploaded = await upload();
      await sleep(900);
      const submitted = await submitModal('Add Sound');
      await sleep(1600);
      await driver.exitEditMode();

      const uploadInfo = await evalJs(`(() => {
        const list = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')) || '[]');
        const hero = list.find(c => c.name === 'Hero');
        const s = (hero?.sounds || []).find(x => x.name === 'Uploaded Roar');
        const ref = s && (s.files || [])[0];
        return s ? { id: s.id, storedName: ref && ref.storedName, displayName: ref && ref.displayName } : null;
      })()`);
      const storedName = uploadInfo?.storedName || '';

      // ---- I2: the provenance precondition is REAL --------------------------
      // If this fails, every bundle assertion after it is vacuous, so it is an id
      // in its own right rather than a silent precondition. On web the bytes are
      // a localStorage data URL; under Tauri they are a file in uploads/<pid>/.
      let probeBytes = 0;
      if (isTauri) {
        const probe = await evalJs(`window.__bk.readBlob(${JSON.stringify(pid)}, ${JSON.stringify(storedName)})`);
        probeBytes = probe?.len || 0;
      } else {
        probeBytes = await evalJs(`(localStorage.getItem(window.__pk('sound_file_' + ${JSON.stringify(storedName)})) || '').length`);
      }
      log('BUNDLE', 'I2: the fixture upload is a real upload - storedName plus bytes the profile store can read',
        ok(openedModal && submitted && uploadInfo?.storedName && probeBytes > 0),
        `modal=${openedModal} submit=${submitted} upload=${uploaded} storedName=${storedName} bytes=${probeBytes}`);

      // ---- I1: the platform gate -------------------------------------------
      // Export & Import renders under Tauri only, on purpose: web keeps audio as
      // base64 in localStorage and caps out around 5 MB, so a web export could
      // only ever be metadata (PROFILE_SYNC_SPEC.md §7). Both arms PASS - each
      // asserts the behaviour its own platform is supposed to have.
      await evalJs(`window.__ui.openSettings()`);
      await sleep(800);
      const sectionShown = await evalJs(`window.__ui.section()`);
      log('BUNDLE', 'I1: Export & Import is offered under Tauri and deliberately absent on web',
        ok(sectionShown === isTauri), `isTauri=${isTauri} sectionRendered=${sectionShown}`);

      if (!isTauri) {
        skip('I3-I22', 'the engine modules are served only by the Vite dev server and the web phase runs a built dist; export/import is Tauri-only by design (§7)');
        return;
      }

      if (!pid || !storedName || probeBytes === 0) {
        bail(['I4', 'I5', 'I6', 'I7', 'I8', 'I9', 'I10', 'I11', 'I12', 'I13', 'I14', 'I15', 'I16', 'I17', 'I18', 'I19', 'I20', 'I21', 'I22'],
          `the fixture did not materialise (pid=${pid} storedName=${storedName} bytes=${probeBytes})`);
        return;
      }

      // Second reference to the upload, so the dedupe has something to dedupe.
      await evalJs(shareTheUpload('bk_shared_copy'));
      await reload();
      await rehydrate();

      // ---- I3: "replace this profile" asks first, and declining is a real out -
      // The confirm is the only gate before the picker, so this is the one piece
      // of the UI's import path that can be driven without opening a native
      // dialog - which is also what makes it the proof that declining never
      // REACHES the dialog. If it had, a #32770 would be open and the click below
      // would be swallowed; `stillResponsive` is that check.
      await evalJs(`window.__ui.openSettings()`);
      await sleep(800);
      await evalJs(`window.__ui.mode('replace')`);
      await sleep(300);
      const modePressed = await evalJs(`window.__ui.pressed('replace')`);
      const beforeDecline = await evalJs(`JSON.stringify(window.__bk.dump(${JSON.stringify(pid)}))`);
      await evalJs(`window.__confirmCalls = 0; window.__origConfirm = window.confirm; window.confirm = () => { window.__confirmCalls++; return false; }`);
      await evalJs(`window.__ui.click('[data-profile-import]')`);
      await sleep(2500);
      const confirmCalls = await evalJs(`window.__confirmCalls`);
      const afterDecline = await evalJs(`JSON.stringify(window.__bk.dump(${JSON.stringify(pid)}))`);
      await evalJs(`window.__ui.mode('new')`);
      await sleep(300);
      const stillResponsive = await evalJs(`window.__ui.pressed('new')`);
      await evalJs(`window.confirm = window.__origConfirm`);

      log('BUNDLE', 'I3: "replace this profile" asks first; declining changes nothing and never reaches the picker',
        ok(modePressed === 'true' && confirmCalls === 1 && afterDecline === beforeDecline && stillResponsive === 'true'),
        `replacePressed=${modePressed} confirmCalls=${confirmCalls} boardUnchanged=${afterDecline === beforeDecline} newModeStillWorks=${stillResponsive}`);

      // ============================ export ============================
      const exported = await evalJs(`window.__bk.exportProfile(${JSON.stringify(pid)}, '3')`);
      const bytes = exported?.b64 ? toBytes(exported.b64) : null;
      const manifest = exported?.manifest || null;
      const payload = exported?.data || null;
      let entries = null;
      let parseError = null;
      try { entries = bytes ? unzipSync(bytes) : null; } catch (err) { parseError = String(err && err.message); }

      log('BUNDLE', 'I4: exportBundle hands back a Uint8Array, never an Array (§11 risk 8)',
        ok(exported?.isUint8Array === true && exported?.isArray === false && !!bytes && bytes[0] === 0x50 && bytes[1] === 0x4b),
        `isUint8Array=${exported?.isUint8Array} isArray=${exported?.isArray} magic=${bytes ? bytes[0] + ',' + bytes[1] : 'n/a'} len=${bytes?.length}`);

      if (!manifest || !payload || !entries) {
        bail(['I5', 'I6', 'I7', 'I8', 'I9', 'I10', 'I11', 'I12', 'I13', 'I14', 'I15', 'I16', 'I17'],
          `the export produced no usable bundle (manifest=${!!manifest} payload=${!!payload} zip=${!!entries} ${parseError || ''})`);
        return;
      }

      const entryNames = Object.keys(entries).sort();
      const audioEntries = entryNames.filter(n => n.startsWith('audio/'));
      // The bundled asset's BYTES must not be in the bundle, while its REFERENCE
      // must be: the reference is what makes the sound resolve on the receiving
      // device, and the bytes are already present in every install. Hashed here in
      // Node from the repo's own public/assets rather than fetched in the page -
      // the in-page fetch of /assets/... failed under Tauri on the first run, and
      // a digest that could not be computed silently satisfied "not in the bundle",
      // which is the vacuous-pass shape this suite is supposed to avoid.
      let bundledDigest = 'MISSING_ASSET';
      try {
        bundledDigest = sha256(new Uint8Array(readFileSync(BUNDLED_ASSET_PATH)));
      } catch (err) {
        bundledDigest = 'ERR ' + String(err && err.message);
      }
      const bundledBytesInBundle = manifest.files.some(f => f.sha256 === bundledDigest);
      const bundledRefKept = JSON.stringify(payload).includes('Longbow_4.mp3');

      log('BUNDLE', 'I5: the bundle is manifest.json + data.json + exactly one audio blob; the bundled asset travels as a reference, not as bytes',
        ok(entryNames.length === manifest.files.length + 2
          && entryNames.includes('manifest.json') && entryNames.includes('data.json')
          && audioEntries.length === 1 && manifest.files.length === 1
          && /^[0-9a-f]{64}$/.test(bundledDigest)
          && bundledBytesInBundle === false && bundledRefKept === true),
        `entries=${JSON.stringify(entryNames)} files=${manifest.files.length} sounds=${manifest.counts?.sounds} bundledAssetDigest=${String(bundledDigest).slice(0, 12)} bundledBytesInBundle=${bundledBytesInBundle} bundledRefKept=${bundledRefKept}`);

      let checksumsOk = true;
      let checksumDetail = '';
      for (const file of manifest.files) {
        const fileBytes = entries[file.path];
        const actual = fileBytes ? sha256(fileBytes) : 'missing';
        if (actual !== file.sha256) { checksumsOk = false; checksumDetail += ` ${file.path}:${actual}!=${file.sha256}`; }
      }
      log('BUNDLE', 'I6: every manifest checksum matches the bytes actually in the zip',
        ok(checksumsOk && manifest.files.length === 1),
        `files=${manifest.files.length} mismatch="${checksumDetail}"`);

      // All four reachable container shapes, and every uploaded reference
      // rewritten to its content-addressed name. The bundled sound must still
      // point at its original name - that is what makes it resolve on the
      // receiving device.
      const shapes = {
        characters: (payload.characters || []).length,
        envCategories: (payload.environmentSounds || []).length,
        groupCategories: (payload.groups || []).reduce((n, g) => n + (g.categories || []).length, 0),
        groupCharacters: (payload.groups || []).reduce((n, g) => n + (g.characters || []).length, 0),
      };
      const originalStillPresent = JSON.stringify(payload).includes(storedName);
      const contentAddressed = manifest.files.every(f => (f.path || '').includes('/') && (f.originalName || '').length > 0);
      log('BUNDLE', 'I7: the payload carries all four reachable container shapes and rewrites uploaded references to content-addressed names',
        ok(shapes.characters === 2 && shapes.envCategories === 1 && shapes.groupCategories === 1 && shapes.groupCharacters === 1
          && manifest.counts?.sounds === countSounds(payload)
          && originalStillPresent === false && contentAddressed === true && bundledRefKept === true),
        `shapes=${JSON.stringify(shapes)} sounds=${manifest.counts?.sounds}/${countSounds(payload)} originalStoredNameStillPresent=${originalStillPresent} contentAddressed=${contentAddressed}`);

      // ---- I8: one blob for two references -----------------------------------
      const audioName = audioEntries[0] ? audioEntries[0].slice(audioEntries[0].lastIndexOf('/') + 1) : null;
      const referrers = audioName ? soundsReferencing(payload, audioName) : 0;
      log('BUNDLE', 'I8: two sounds sharing one storedName yield ONE blob and both point at it',
        ok(referrers === 2 && manifest.files.length === 1 && audioEntries.length === 1),
        `blob=${audioName} soundsPointingAtIt=${referrers} files=${manifest.files.length}`);

      log('BUNDLE', 'I9: settings travel, and the custom background image is deliberately dropped (§5.2)',
        ok(payload.settings?.boxSize === 1.4
          && payload.settings?.background?.theme === 'Ocean'
          && payload.settings?.background?.color === '#0b1220'
          && payload.settings?.background?.type === 'color'
          && payload.settings?.sectionIcons?.characters === 'Shield'
          && payload.settings?.sectionIcons?.environment === 'Castle'
          && !JSON.stringify(payload.settings || {}).includes('iVBORw0KGgo')),
        JSON.stringify(payload.settings));

      // ============================ the real IPC write ============================
      // The app's exact destination sequence, minus the dialog: grant_path, then
      // writeFile, then readFile - and then Node reads the SAME file off its own
      // filesystem (Windows) or off the returned bytes (Android). The app's own
      // success line is not evidence; that is the rule the localStorage and
      // uploads restores were both fixed for.
      let tmpDir = null;
      let bundlePath = null;
      let written = null;
      if (isDesktop) {
        tmpDir = mkdtempSync(join(tmpdir(), 'spellcaster-e2e-'));
        bundlePath = join(tmpDir, 'board.spellcaster');
        // Pre-create it. A real save dialog returns a path to a file that does
        // not exist yet, and canonicalising a missing path is a scope-grant
        // hazard this suite should not be the first to discover.
        writeFileSync(bundlePath, Buffer.alloc(0));
      } else {
        bundlePath = 'e2e-bundle/board.spellcaster';
      }

      written = await evalJs(`window.__bk.writeBundle(${JSON.stringify(bundlePath)}, ${isDesktop})`);
      let roundTrip = null;
      if (written?.ok && written.b64) {
        try { roundTrip = unzipSync(toBytes(written.b64)); } catch { roundTrip = null; }
      }
      const writtenManifest = roundTrip ? JSON.parse(new TextDecoder().decode(roundTrip['manifest.json'])) : null;
      const writtenBlobMatches = !!(writtenManifest && writtenManifest.files.length === 1
        && sha256(roundTrip[writtenManifest.files[0].path]) === writtenManifest.files[0].sha256);
      // Independent evidence, Windows only: the same bytes as seen by Node's own
      // filesystem, not as handed back over CDP.
      let diskMatches = null;
      if (isDesktop && written?.ok) {
        try { diskMatches = sha256(new Uint8Array(readFileSync(bundlePath))) === sha256(toBytes(written.b64)); } catch { diskMatches = false; }
      }

      log('BUNDLE', 'I10: the app\'s real write path works - grant_path, writeFile(Uint8Array), readFile - and the bytes survive the round trip',
        ok(written?.ok === true && written.magic === '80,75' && written.len === bytes?.length
          && !!writtenManifest && writtenBlobMatches
          && writtenManifest.files[0].sha256 === manifest.files[0].sha256
          && (isDesktop ? diskMatches === true : true)),
        `path=${bundlePath} ok=${written?.ok} magic=${written?.magic} len=${written?.len}/${bytes?.length} manifestFiles=${writtenManifest?.files?.length} blobMatches=${writtenBlobMatches} sameBlobAsEngineExport=${writtenManifest?.files?.[0]?.sha256 === manifest.files[0].sha256} nodeDiskReadMatches=${diskMatches} err=${written?.message || ''}`);

      // ============================ import as a NEW profile ============================
      const bundleB64 = exported.b64;
      const dumpBefore = await evalJs(`JSON.stringify(window.__bk.dump(${JSON.stringify(pid)}))`);
      const profilesBefore = await evalJs(`window.__bk.profiles()`);
      // Diagnostic, and it is here because of what the first run showed: fflate can
      // hand back an entry as a VIEW into the input buffer rather than a fresh
      // allocation, and a typed array with a non-zero byteOffset is exactly the
      // shape the desktop IPC has historically mangled. Printed either way, so a
      // future failure is diagnosable from the log alone.
      const blobShape = await evalJs(`window.__bk.blobShape(${JSON.stringify(bundleB64)}, ${JSON.stringify(audioEntries[0])})`);

      const imported = await evalJs(`window.__bk.importBundle(${JSON.stringify(bundleB64)}, 'new', null)`);
      await sleep(2500);
      await rehydrate();

      const pid2 = imported?.profileId;
      const profilesAfter = await evalJs(`window.__bk.profiles()`);
      const dumpSource = await evalJs(`JSON.stringify(window.__bk.dump(${JSON.stringify(pid)}))`);
      const dumpTarget = pid2 ? JSON.parse(await evalJs(`JSON.stringify(window.__bk.dump(${JSON.stringify(pid2)}))`) || '{}') : null;
      const storedBoard = pid2 && dumpTarget ? {
        characters: JSON.parse(dumpTarget.ttrpg_characters || '[]'),
        environment: JSON.parse(dumpTarget.ttrpg_environment || '[]'),
        groups: JSON.parse(dumpTarget.ttrpg_groups || '[]'),
      } : null;

      log('BUNDLE', 'I11: "create a new profile" adds a profile, activates it, and leaves the source byte-identical',
        ok(imported?.ok === true && !!pid2 && pid2 !== pid
          && profilesAfter.count === profilesBefore.count + 1
          && profilesAfter.active === pid2
          && dumpSource === dumpBefore),
        `imported=${JSON.stringify(imported)} blobShape=${JSON.stringify(blobShape)} before=${JSON.stringify(profilesBefore)} after=${JSON.stringify(profilesAfter)} sourceUnchanged=${dumpSource === dumpBefore}`);

      // The import is only correct if the APP can read it back. A pass-through
      // normalizer is what commitKeys was handed, so the proof is the reload: the
      // app's own normalizeStoredData runs over the imported board and must not
      // change a byte. The no `_old` key assertion is the same property from the
      // other side - commitKeys stamps the version LAST precisely so the first
      // read does not snapshot the key it has just written.
      const preReload = pid2 ? await evalJs(`JSON.stringify(window.__bk.dump(${JSON.stringify(pid2)}))`) : null;
      await reload();
      await rehydrate();
      const postReload = pid2 ? await evalJs(`JSON.stringify(window.__bk.dump(${JSON.stringify(pid2)}))`) : null;
      const targetKeys = pid2 ? ((await evalJs(`window.__keysFor(${JSON.stringify(pid2)})`)) || []) : [];
      const oldKeys = targetKeys.filter(k => k.endsWith('_old'));
      const bg = dumpTarget ? JSON.parse(dumpTarget.backgroundSettings || '{}') : {};

      log('BUNDLE', 'I12: the imported board is the bundle payload, survives a reload unchanged, and leaves no <key>_old behind',
        ok(!!storedBoard && sameJson(storedBoard.characters, payload.characters)
          && sameJson(storedBoard.environment, payload.environmentSounds)
          && sameJson(storedBoard.groups, payload.groups)
          && preReload === postReload
          && oldKeys.length === 0
          && dumpTarget?.boxSize === '1.4'
          && bg.theme === 'Ocean'
          && dumpTarget?.ttrpg_characters_icon === 'Shield'
          && dumpTarget?.ttrpg_environment_icon === 'Castle'
          && dumpTarget?.ttrpg_data_version === '3'),
        `charsMatch=${!!storedBoard && sameJson(storedBoard.characters, payload.characters)} envMatch=${!!storedBoard && sameJson(storedBoard.environment, payload.environmentSounds)} groupsMatch=${!!storedBoard && sameJson(storedBoard.groups, payload.groups)} reloadStable=${preReload === postReload} oldKeys=${JSON.stringify(oldKeys)} keys=${JSON.stringify(targetKeys)}`);

      const blobBack = pid2 && audioName ? await evalJs(`window.__bk.readBlob(${JSON.stringify(pid2)}, ${JSON.stringify(audioName)})`) : null;
      log('BUNDLE', 'I13: the uploaded audio arrived in the new profile byte-identical',
        ok(!!blobBack && sha256(toBytes(blobBack.b64)) === manifest.files[0].sha256 && blobBack.len === manifest.files[0].bytes),
        `len=${blobBack?.len}/${manifest.files[0].bytes} shaMatch=${blobBack ? sha256(toBytes(blobBack.b64)) === manifest.files[0].sha256 : false}`);

      // ---- I14: the same import, sourced from the FILE on disk ---------------
      // I11 hands importBundle the bytes in memory; this hands it bytes read back
      // through the real fs IPC, which is the path the app takes after the picker.
      const fromFile = await evalJs(`window.__bk.readBundleFile(${JSON.stringify(bundlePath)}, ${isDesktop})`);
      const profilesBeforeFile = await evalJs(`window.__bk.profiles()`);
      const importedFile = fromFile?.ok
        ? await evalJs(`window.__bk.importBundle(${JSON.stringify(fromFile.b64)}, 'new', null)`)
        : { ok: false, message: `could not read ${bundlePath} back: ${fromFile?.message}` };
      await sleep(2500);
      await rehydrate();
      const pid3 = importedFile?.profileId;
      const afterFile = pid3 ? JSON.parse(await evalJs(`JSON.stringify(window.__bk.dump(${JSON.stringify(pid3)}))`) || '{}') : null;
      const fileChars = afterFile?.ttrpg_characters ? JSON.parse(afterFile.ttrpg_characters) : null;

      log('BUNDLE', 'I14: a bundle read back through the real fs IPC imports as a new profile with the same board',
        ok(importedFile?.ok === true && !!pid3 && pid3 !== pid2 && pid3 !== pid
          && fromFile.len === bytes?.length
          && !!fileChars && sameJson(fileChars, payload.characters)
          && afterFile?.boxSize === '1.4'
          && (await evalJs(`window.__bk.profiles()`)).count === profilesBeforeFile.count + 1),
        `readLen=${fromFile?.len}/${bytes?.length} readErr=${fromFile?.message || ''} imported=${JSON.stringify(importedFile)} boardMatches=${!!fileChars && sameJson(fileChars, payload.characters)} boxSize=${afterFile?.boxSize}`);

      await evalJs(`window.__bk.removeBundleFile(${JSON.stringify(bundlePath)}, ${isDesktop})`);
      if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });

      // ============================ replace active ============================
      // Strip the source profile down first, so "the board was replaced" is a
      // real observation rather than writing the same content back over itself.
      await evalJs(`window.__bk.P.setActiveProfile(${JSON.stringify(pid)})`);
      await sleep(1200);
      await rehydrate();
      await evalJs(SEED_ONLY_CHARACTER);
      await reload();
      await rehydrate();
      const stripped = await evalJs(`JSON.stringify(window.__bk.dump(${JSON.stringify(pid)}))`);
      const profilesBeforeReplace = await evalJs(`window.__bk.profiles()`);

      const replaced = await evalJs(`window.__bk.importBundle(${JSON.stringify(bundleB64)}, 'replace', ${JSON.stringify(pid)})`);
      await sleep(2000);
      await rehydrate();
      const readBack = await evalJs(`(() => {
        const dump = window.__bk.dump(${JSON.stringify(pid)});
        const backups = JSON.parse(localStorage.getItem('spellcaster_import_backups') || '[]');
        const latest = backups.length ? backups[backups.length - 1] : null;
        return {
          board: dump.ttrpg_characters ? JSON.parse(dump.ttrpg_characters) : null,
          backupCount: backups.length,
          snapshotOf: backups.map(b => b.profileId),
          snapshotKeys: latest ? Object.keys(latest.keys).sort() : [],
          snapshotCharacters: latest && latest.keys.ttrpg_characters ? JSON.parse(latest.keys.ttrpg_characters).map(c => c.name) : [],
          profiles: window.__bk.profiles()
        };
      })()`);

      log('BUNDLE', 'I15: replace swaps the board in place, leaves the profile count alone, and keeps the previous board in the snapshot',
        ok(replaced?.ok === true && !!readBack?.board && sameJson(readBack.board, payload.characters)
          && readBack.backupCount === 1
          && readBack.snapshotOf[0] === pid
          && readBack.snapshotCharacters.length === 1
          && readBack.snapshotCharacters[0] === 'Hero'
          && readBack.snapshotKeys.includes('ttrpg_characters')
          && readBack.profiles.count === profilesBeforeReplace.count),
        `imported=${JSON.stringify(replaced)} boardMatches=${!!readBack?.board && sameJson(readBack.board, payload.characters)} backups=${readBack?.backupCount} snapshotOf=${JSON.stringify(readBack?.snapshotOf)} snapshottedChars=${JSON.stringify(readBack?.snapshotCharacters)} profiles=${JSON.stringify(readBack?.profiles)} before=${JSON.stringify(profilesBeforeReplace)} strippedBoardHad=${stripped.includes('Hero')}`);

      // ============================ refusals ============================
      // Both throw inside parseBundle, which runs BEFORE the snapshot and before
      // any blob write, so the target must come out byte-identical. That ordering
      // IS the atomicity story (profileBundle.js rule 4), and this is its test.
      const snapshotCountBefore = await evalJs(`(JSON.parse(localStorage.getItem('spellcaster_import_backups') || '[]')).length`);
      const dumpBeforeRefusal = await evalJs(`JSON.stringify(window.__bk.dump(${JSON.stringify(pid)}))`);

      // Re-zip with one payload byte flipped: fflate recomputes the CRC, so the
      // archive is still a valid zip and the failure lands on the CHECKSUM rather
      // than on the unzip - which is the check worth testing.
      const corruptEntries = { ...entries };
      const flipped = new Uint8Array(corruptEntries[audioEntries[0]]);
      flipped[0] = flipped[0] ^ 0xff;
      corruptEntries[audioEntries[0]] = flipped;
      const corruptB64 = Buffer.from(zipSync(corruptEntries)).toString('base64');

      const corrupt = await evalJs(`window.__bk.importBundle(${JSON.stringify(corruptB64)}, 'replace', ${JSON.stringify(pid)})`);
      const dumpAfterCorrupt = await evalJs(`JSON.stringify(window.__bk.dump(${JSON.stringify(pid)}))`);
      const snapshotCountAfter = await evalJs(`(JSON.parse(localStorage.getItem('spellcaster_import_backups') || '[]')).length`);

      log('BUNDLE', 'I16: a bundle whose bytes do not match its manifest is refused, and the target is left byte-identical',
        ok(corrupt?.ok === false && corrupt?.code === 'corrupt-payload'
          && /Nothing was imported/.test(corrupt?.message || '')
          && dumpAfterCorrupt === dumpBeforeRefusal
          && snapshotCountAfter === snapshotCountBefore),
        `code=${corrupt?.code} message="${corrupt?.message}" boardUnchanged=${dumpAfterCorrupt === dumpBeforeRefusal} snapshots=${snapshotCountBefore}->${snapshotCountAfter}`);

      const futureEntries = { ...entries };
      const futureManifest = JSON.parse(new TextDecoder().decode(futureEntries['manifest.json']));
      futureManifest.formatVersion = 99;
      futureEntries['manifest.json'] = strToU8(JSON.stringify(futureManifest, null, 2));
      const futureB64 = Buffer.from(zipSync(futureEntries)).toString('base64');

      const future = await evalJs(`window.__bk.importBundle(${JSON.stringify(futureB64)}, 'replace', ${JSON.stringify(pid)})`);
      const dumpAfterFuture = await evalJs(`JSON.stringify(window.__bk.dump(${JSON.stringify(pid)}))`);

      log('BUNDLE', 'I17: a bundle from a newer format is refused, and the message names both versions',
        ok(future?.ok === false && future?.code === 'too-new'
          && /format 99/.test(future?.message || '')
          && /format 1\b/.test(future?.message || '')
          && dumpAfterFuture === dumpBeforeRefusal),
        `code=${future?.code} message="${future?.message}" boardUnchanged=${dumpAfterFuture === dumpBeforeRefusal}`);

      // ============================ the per-file report + the notice =========
      // I15 already imported this bundle into `pid`, so every blob is ALREADY
      // present there. That makes this the natural place for `skipped` to be real
      // rather than theoretical: the honest count for a re-import is "nothing to
      // write", and an implementation that rewrote all of it would say otherwise.
      const reimport = await evalJs(`window.__bk.importBundle(${JSON.stringify(exported.b64)}, 'replace', ${JSON.stringify(pid)})`);
      const manifestCount = exported.manifest.files.length;
      const statuses = (reimport?.files || []).map(f => f.status);
      const allLabelled = (reimport?.files || []).every(f => typeof f.label === 'string' && f.label.length > 0);

      log('BUNDLE', 'I18: the report lists every bundle file with a status, and a blob already present is SKIPPED',
        ok(reimport?.ok === true
          && reimport?.files?.length === manifestCount
          && allLabelled
          && statuses.every(s => s === 'imported' || s === 'skipped')
          && reimport?.imported + reimport?.skipped === manifestCount
          && reimport?.skipped === manifestCount
          && reimport?.imported === 0),
        `files=${reimport?.files?.length}/${manifestCount} skipped=${reimport?.skipped} imported=${reimport?.imported} statuses=${JSON.stringify([...new Set(statuses)])} labelled=${allLabelled}`);

      // The notice is parked by importBundle precisely because the UI that would
      // report the import is destroyed by the remount. So it is tied to that
      // remount: setActive:false - a programmatic import with nothing to show it -
      // parks NOTHING. That coupling is the design, and this is where it is worth
      // pinning, because "always park it" would leave a notice behind for a mount
      // that never comes, and the first real import after it would show a stale
      // summary. It also means the key cannot be observed from here...
      await evalJs(`window.__bk.importBundle(${JSON.stringify(exported.b64)}, 'replace', ${JSON.stringify(pid)}, false)`);
      const quiet = await evalJs(`(() => ({
        global: localStorage.getItem('spellcaster_import_notice'),
        scoped: localStorage.getItem('profile:' + ${JSON.stringify(pid)} + ':spellcaster_import_notice'),
      }))()`);

      log('BUNDLE', 'I19: an import that will not remount parks NO notice - so no stale summary can survive',
        ok(quiet?.global === null && quiet?.scoped === null),
        `global=${quiet?.global === null ? 'absent' : 'PRESENT'} scoped=${quiet?.scoped === null ? 'absent' : 'PRESENT'}`);

      // I20 is the "survives the remount" claim, and the honest test is that NO
      // reload happens: the real import remounts the tree synchronously, so by the
      // time this reads the page, the banner must already be on screen and the key
      // already consumed. An earlier version reloaded first and asserted the key
      // was still there - which failed, because the app had done exactly what it
      // was built to do.
      await evalJs(`window.__bk.importBundle(${JSON.stringify(exported.b64)}, 'replace', ${JSON.stringify(pid)})`);
      await sleep(1500);
      const shown = await evalJs(`(() => {
        const b = document.querySelector('[data-import-notice]');
        return {
          present: !!b,
          text: b ? b.textContent.replace(/\\s+/g, ' ').trim().slice(0, 240) : '',
          keyLeft: localStorage.getItem('spellcaster_import_notice'),
          // Global for a sharper reason than consistency: an import can CREATE the
          // profile the notice is about, so a scoped key would be unreadable by the
          // very mount it exists for. (profileBundle.check.mjs asserts the parked
          // payload directly; this proves no scoped twin is ever left behind.)
          scopedTwin: localStorage.getItem('profile:' + ${JSON.stringify(pid)} + ':spellcaster_import_notice'),
        };
      })()`);

      log('BUNDLE', 'I20: a real import remounts and the banner is already on screen, global key consumed',
        ok(shown?.present === true
          && /Replaced/.test(shown?.text || '')
          && new RegExp(`${manifestCount} file`).test(shown?.text || '')
          && /already present/.test(shown?.text || '')
          && shown?.keyLeft === null
          && shown?.scopedTwin === null),
        `banner=${shown?.present} keyLeft=${shown?.keyLeft} scopedTwin=${shown?.scopedTwin} text="${shown?.text}"`);

      // ---- I23: the banner has to be REACHABLE, not merely present ----
      //
      // I21 clicks the dismiss button with a synthetic `element.click()`, which
      // dispatches straight into the DOM. That proves the handler works and
      // proves nothing about whether a thumb can reach the button. On Android
      // this app's webview is edge to edge (targetSdk 36), so whatever is FIRST
      // in the app's flex column is drawn under the status bar, and the status
      // bar swallows touches. That is how the import banner ended up on screen
      // with a dismiss button nobody could press - the banner was present, the
      // click worked, and the user still could not close it.
      //
      // A synthetic touch would NOT catch it either: CDP delivers into the
      // webview and never passes through the Android system UI, so
      // `Input.dispatchTouchEvent` at the button's coordinates would succeed
      // against the unfixed layout too. The honest automated check is therefore
      // geometry, and it is measured against the inset rather than a hard-coded
      // status-bar height, which differs per device.
      //
      // `env()` has no JS API, so it is read through a probe element. On web the
      // inset is 0 and this assertion is near-vacuous by construction; the
      // Android arm is the one that carries it, and the user's hand-test is
      // still the final word on real touch.
      const geo = await evalJs(`(() => {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;padding-top:env(safe-area-inset-top);visibility:hidden;pointer-events:none';
        document.body.appendChild(probe);
        const safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
        probe.remove();
        const b = document.querySelector('[data-import-notice]');
        const btn = b && b.querySelector('button[aria-label="Dismiss import summary"]');
        const r = btn ? btn.getBoundingClientRect() : null;
        const br = b ? b.getBoundingClientRect() : null;
        const vv = window.visualViewport;
        return {
          safeTop,
          innerH: window.innerHeight,
          innerW: window.innerWidth,
          vvH: vv ? Math.round(vv.height) : null,
          btn: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) } : null,
          banner: br ? { top: Math.round(br.top), bottom: Math.round(br.bottom) } : null,
        };
      })()`);

      log('BUNDLE', 'I23: the dismiss button sits inside the screen a thumb can reach, clear of the status bar',
        ok(geo?.btn !== null
          && geo.btn.top >= geo.safeTop - 1
          && geo.btn.bottom <= geo.innerH + 1
          && geo.btn.left >= -1
          && geo.btn.right <= geo.innerW + 1),
        `safeTop=${geo?.safeTop} btn=${JSON.stringify(geo?.btn)} banner=${JSON.stringify(geo?.banner)} layout=${geo?.innerW}x${geo?.innerH} visual=${geo?.vvH}`);

      // Dismissal only clears local state; the key is already gone, so the notice
      // cannot come back on a later mount. That is the "one-shot" claim, and it is
      // checked by actually reloading rather than by asserting the key is absent.
      //
      // The click and the read must NOT be in one expression: the click is a React
      // state update, so reading the DOM in the same tick still sees the banner -
      // which is what the first version of this did, and it reported STILL_THERE
      // for a dismissal that had in fact worked.
      const clicked = await evalJs(`(() => {
        const b = document.querySelector('[data-import-notice] button[aria-label="Dismiss import summary"]');
        if (!b) return 'NO_DISMISS_BTN';
        b.click(); return 'OK';
      })()`);
      await sleep(600);
      const goneNow = await evalJs(`!!document.querySelector('[data-import-notice]')`);
      await reload();
      await sleep(1200);
      await rehydrate();
      const afterAgain = await evalJs(`!!document.querySelector('[data-import-notice]')`);

      log('BUNDLE', 'I21: the notice is one-shot - dismissed, and gone again after a reload',
        ok(clicked === 'OK' && goneNow === false && afterAgain === false),
        `click=${clicked} stillShowing=${goneNow} bannerAfterReload=${afterAgain}`);

      // ---- I22: the orphaned-reference refusal, which the HAND-TEST found ----
      //
      // Delete a file the board currently points at, leaving a reference with
      // nothing behind it - exactly what the user hit on 2026-10-15. The refusal
      // itself was already correct and already asserted; what was wrong, and what
      // no test had ever looked at, is that it named a storedName
      // (`sound_9wy7vtpo_e2e_silence.wav`) instead of the sound. The user could
      // not tell which card to open and had to delete sounds one at a time.
      //
      // ⚠️ The storedName is read from the board NOW, not the one this spec
      // uploaded. The imports above rewrote every reference to a content-addressed
      // name, so by this point the original upload is no longer referenced at all -
      // deleting it changes nothing and the export correctly succeeds. The first
      // version of this test did exactly that and failed for the right reason.
      const liveRef = await evalJs(`(() => {
        const board = JSON.parse(localStorage.getItem('profile:' + ${JSON.stringify(pid)} + ':ttrpg_characters') || '[]');
        for (const c of board) {
          for (const s of c.sounds || []) {
            if (s.name === 'Uploaded Roar') {
              const ref = (s.files || [])[0];
              return ref && ref.storedName ? { storedName: ref.storedName, container: c.name } : null;
            }
          }
        }
        return null;
      })()`);

      if (!liveRef?.storedName) {
        log('BUNDLE', 'I22: a board pointing at a deleted file refuses to export, naming the SOUND and its container',
          'FAIL', `no live reference to 'Uploaded Roar' in ${pid} - the earlier ids must have rewritten the board`);
      } else {
        const dropped = await evalJs(`window.__bk.deleteOwnBlob(${JSON.stringify(pid)}, ${JSON.stringify(liveRef.storedName)})`);
        const refused = await evalJs(`window.__bk.exportCatching(${JSON.stringify(pid)}, '3')`);
        const msg = refused?.message || '';

        log('BUNDLE', 'I22: a board pointing at a deleted file refuses to export, naming the SOUND and its container',
          ok(dropped?.ok === true
            && dropped?.stillThere === false
            && refused?.ok === false
            && refused?.code === 'missing-blobs'
            && /Uploaded Roar/.test(msg)
            && new RegExp(liveRef.container.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(msg)
            && !msg.includes(liveRef.storedName)
            && /upload the audio again/i.test(msg)),
          `deleted=${JSON.stringify(dropped)} code=${refused?.code} container=${liveRef.container} message="${msg}"`);
      }
    } catch (err) {
      // Never let this spec unwind main(): that skips the entrypoint's
      // localStorage restore and leaves the fixture in the user's real store.
      log('BUNDLE', 'I0: the bundle spec threw and was contained', 'FAIL',
        `caught ${err && err.message}; the run continues and the store is still restored`);
      console.log(`[BUNDLE] STACK ${err && err.stack}`);
    }
  },
};
