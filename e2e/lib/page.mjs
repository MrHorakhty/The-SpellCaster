// Shared in-page expressions for the E2E suites.
//
// Every entrypoint used to carry its own copy of the localStorage seed, the
// page-level helper injection, the audio spy and the capture/restore logic.
// These were identical across platforms (and had to stay identical or the
// suites diverged), so they live here once. Keep them in sync with the app:

// ---- localStorage seed (characters / environment / groups / themes) ---------
//
// PROFILE-AWARE SEEDING. Since profiles shipped, every board key is stored as
// `profile:<id>:<key>` (src/profileStorage.js). The suites still talk in the
// bare key names - 'ttrpg_characters' and friends - and __pk() maps one to the
// other by looking the active profile up in the index. Two reasons this is a
// page helper rather than a Node-side string substitution:
//
//   1. The profile id is random per install, so the harness cannot know it. It
//      has to be resolved IN the page, and re-resolved every time - the id
//      changes when a suite switches profile.
//   2. Seeding a bare key would silently do nothing. The app reads scoped keys,
//      so a stale-looking-but-unread seed produces a test that passes while
//      exercising an empty board - the same failure shape as the `__setInput`
//      trap below, and much harder to read.
//
// ⚠️ If you add a key the app persists, add it to PK_KEYS. The bare name is
// what the suites pass; the prefix is what the app reads.

export const PK_KEYS = [
  'ttrpg_characters',
  'ttrpg_environment',
  'ttrpg_groups',
  'ttrpg_data_version',
  'ttrpg_characters_icon',
  'ttrpg_environment_icon',
  'ttrpg_themes',
  'boxSize',
  'backgroundSettings',
]

// The id expression is inlined rather than captured, so it always reads the
// CURRENT active profile. Returns '' when there is no profile yet, which makes
// __pk produce a key the app will never read - loud, not silent.
export const PROFILE_HELPER = `(() => {
  // The active profile id, creating the profile if the app has not booted yet.
  //
  // SELF-HEALING ON PURPOSE. A suite may seed before the app has created its
  // first profile (a fresh run restores the snapshot, then seeds, and only then
  // reloads the app). If __pk resolved to nothing in that window the seed would
  // land on bare keys the app never reads, and the run would go green while
  // testing an empty board - the same silent shape as the __setInput trap. So
  // the harness creates the profile itself, with a fixed id so a failing run is
  // easy to read. The app accepts an existing index untouched.
  window.__pid = () => {
    try {
      const idx = JSON.parse(localStorage.getItem('spellcaster_profiles') || 'null');
      if (idx && idx.activeProfileId && Array.isArray(idx.profiles) && idx.profiles.length) return idx.activeProfileId;
      localStorage.setItem('spellcaster_profiles', JSON.stringify({
        version: 1, activeProfileId: 'p_e2e', profiles: [{ id: 'p_e2e', name: 'E2E Board' }]
      }));
      return 'p_e2e';
    } catch { return ''; }
  };
  window.__pk = (key) => {
    const pid = window.__pid();
    return pid ? 'profile:' + pid + ':' + key : key;
  };
  // Seed helper: writes every key through __pk so a suite never has to think
  // about scoping. Values may be objects (JSON-encoded) or raw strings.
  window.__pseed = (obj) => {
    const out = [];
    for (const [k, v] of Object.entries(obj)) {
      const value = typeof v === 'string' ? v : JSON.stringify(v);
      localStorage.setItem(window.__pk(k), value);
      out.push(k);
    }
    return out.join(',');
  };
  // Every non-audio key for THE ACTIVE PROFILE, as BARE names, sorted. This is what
  // the "the feature added no new storage key" assertions compare (P13, P14a, P31a,
  // O10): they care about WHICH keys exist, not how they are scoped, so the profile
  // prefix is stripped back off. Global device-level keys (the profile index, the
  // one-time audio sweep flag) are kept - the expected-key lists name them explicitly,
  // so dropping them here would silently weaken the assertion.
  //
  // ⚠️ A key belonging to ANOTHER profile is now skipped rather than passed through
  // with its full scoped name. It used to fall through the prefix test untouched and
  // be returned as the full scoped name profile:p_xxxx:ttrpg_characters_old, which is not a bare name
  // and matched no entry in any KNOWN_KEYS list - so a stale profile left behind by
  // an earlier run failed these assertions on Windows while web and Android (clean
  // stores) passed. Four tests, one cause, and the failure had nothing to do with the
  // code under test. Use __keysFor(pid) when you really do mean another profile.
  //
  // ⚠️ This function USED TO skip the '<knownKey>_old' backups, added and removed
  // on the same day, 2026-10-14. It was symptom-treatment: readProfileData writes
  // those backups deliberately, and a profile left unversioned in the user's store
  // made the app perform that migration mid-run, which P14a/P31a read as "the
  // feature added a key". The harness no longer leaves such a store behind - every
  // run now ends with the store verified byte-identical to its pre-run state FROM
  // DISK - so the skip is gone and the guard is back at full strictness. If a
  // '_old' key turns up here again, that means the store is dirty, which is a
  // finding and not noise. 💡 Lesson: fix the environment before relaxing the
  // assertion, or the test can no longer see the thing it was written for.
  // ⚠️ NOTE for whoever edits this: this whole block lives inside a JS template
  // literal, so a BACKTICK in a comment terminates the string and Node tries to
  // evaluate the rest as code. That has now bitten this file twice.
  window.__bareKeys = () => {
    const pre = 'profile:' + window.__pid() + ':';
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (!k) continue;
      if (k.startsWith('profile:') && !k.startsWith(pre)) continue;
      const name = k.startsWith(pre) ? k.slice(pre.length) : k;
      if (name.startsWith('sound_file_')) continue;
      out.push(name);
    }
    return out.sort();
  };
  // Every key belonging to ONE profile, as bare names, sorted. Used to prove a
  // deleted profile left nothing behind - __bareKeys() only covers whichever
  // profile is active, which is rarely the one you are checking.
  window.__keysFor = (pid) => {
    const pre = 'profile:' + pid + ':';
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (k.startsWith(pre)) out.push(k.slice(pre.length));
    }
    return out.sort();
  };
  return 'ok';
})();`;

export const SEED = `(() => {
  const snd = (id,name,type,color,opts) => ({ id, name, type, icon:'Icon.png', files:[{name:name.toLowerCase().replace(/\\s+/g,'_')+'.mp3', displayName:name+'.mp3'}], color, duration:0, randomPlay:false, ...opts });
  localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([
    { id:'c1', name:'Human Paladin', sounds:[
      snd('s1','Smite','Holy','#ff0000',{loop:true, fadeIn:0.5, fadeOut:0.5, glowEnabled:true, glowProminence:0.7, files:[{name:'Tavern_Music.mp3',displayName:'Tavern_Music.mp3'}]}),
      snd('s2','Shield Bash','Melee','#3b82f6',{loop:false, randomPlay:true, files:[{name:'shield1.mp3',displayName:'Shield1.mp3'},{name:'shield2.mp3',displayName:'Shield2.mp3'}]}),
      snd('s3','Healing Light','Magic','#22c55e',{loop:true, fadeIn:1.5, files:[{name:'heal.mp3',displayName:'Heal.mp3'}]})
    ]},
    { id:'c2', name:'Elf Sorcerer', sounds:[] }
  ]));
localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([
    { id:'e1', category:'Dungeon', sounds:[snd('e1s1','Dripping','Ambient','#84cc16',{loop:true, files:[{name:'drip.mp3',displayName:'Drip.mp3'}]})] },
    { id:'e2', category:'Forest', sounds:[] }
  ]));
  localStorage.setItem(window.__pk('ttrpg_groups'), JSON.stringify([
    { id:'g1', name:'Tavern Pack', mode:'environment', categories:[{id:'gc1', category:'Ambience', sounds:[snd('gs1','Tavern Song','Music','#d97706',{loop:true, files:[{name:'tavern.mp3',displayName:'Tavern.mp3'}]})]}], characters:[] },
    { id:'g2', name:'Hero Pack', mode:'characters', categories:[], characters:[{id:'gch1', name:'Fighter', sounds:[]}] }
  ]));
  localStorage.setItem(window.__pk('ttrpg_themes'), JSON.stringify([]));
  localStorage.setItem(window.__pk('ttrpg_data_version'), '3');
  localStorage.removeItem(window.__pk('backgroundSettings'));
  localStorage.removeItem(window.__pk('boxSize'));
  // Clear this profile's web audio. Scoped by prefix - an unprefixed sweep would
  // either miss everything or, worse, hit another profile's audio.
  for (let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i); if(k && k.startsWith('profile:'+window.__pid()+':sound_file_')) localStorage.removeItem(k);}
  return 'seeded';
})();`;

// ---- window-level helper injection (wiped by every reload) ------------------
//
// PROFILE_HELPER is prepended so __pk/__pseed exist wherever the other helpers
// do. ctx.reload re-injects this whole block after every navigation, which is
// what stops the profile helpers from becoming the next __setInput trap.

export const PAGE_HELPERS = PROFILE_HELPER + `
(() => {
  window.__clickText = (t) => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===t); if(!b) return 'NO:'+t; b.click(); return 'OK'; };
  window.__findText = (t) => [...document.querySelectorAll('button')].find(x=>x.textContent.trim()===t);
  window.__setInput = (name, val) => { const el=document.querySelector('input[name="'+name+'"]'); if(!el) return 'NO:'+name; const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(el, val); el.dispatchEvent(new Event('input',{bubbles:true})); return 'OK'; };
  window.__uploadFile = (sel, path) => (async () => { const doc=await (globalThis.__cdp||{}).eval?null:null; return 'need cdp'; })();
  return 'ok';
})();`;

// ---- audio spy: record every element that is asked to play -------------------

export const INSTRUMENT_AUDIO = `(() => {
  window.__e2eAudio = [];
  const op = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function(...a){ window.__e2eAudio.push(this); return op.apply(this, a); };
  return 'instrumented';
})()`;

// ---- SAVE_RESTORE capture / restore -----------------------------------------

export const CAPTURE_LS = `(() => { const o = {}; for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); o[k]=localStorage.getItem(k);} return JSON.stringify(o); })()`;

export function restoreLs(captured) {
  const o = JSON.stringify(captured ?? {});
  return `(() => { const o = ${o}; localStorage.clear(); for (const k in o) localStorage.setItem(k, o[k]); return 'restored'; })()`;
}

// ---- waiting for the board ---------------------------------------------------
//
// A spec that seeds the store and reloads cannot assume the app came up with
// it. Two things can go wrong, and both have bitten this suite:
//
//   - the reload is SLOW. The Android WebView takes seconds to re-render, and
//     a spec that sleeps a fixed time and then measures can be looking at a
//     page that has not drawn yet - zero cards, and every assertion after it
//     fails for a reason that has nothing to do with the thing under test.
//   - the reload does not happen at all. The project's own notes call
//     `Page.reload` unreliable on that AVD, and a page that did not reload is
//     still showing the PREVIOUS board - which, if the previous suite emptied
//     it, is an empty board.
//
// So: wait for the cards to appear, and if they never do, seed and reload
// once more. Waiting for the thing you are about to assert on is the whole
// difference between a flaky suite and a broken one.
export async function awaitBoard(ctx, { min = 1, timeoutMs = 15000, seed = null, settleMs = 1200 } = {}) {
    const { evalJs, sleep, reload } = ctx;
    const count = async () => {
        const n = await evalJs(`document.querySelectorAll('[data-sound-card]').length`);
        return typeof n === 'number' ? n : 0;
    };
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const cards = await count();
        if (cards >= min) return cards;
        await sleep(400);
    }
    if (seed) {
        await evalJs(seed);
        await reload();
        await sleep(settleMs);
        return count();
    }
    return 0;
}

// ---- modal submit ------------------------------------------------------------
// Submit the bg-lime-600 submit button whose text matches (and is not disabled).
export function submitModalExpr(btnText) {
  return `(() => {
    const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='${btnText}' && x.type==='submit' && /bg-lime-600/.test(x.className));
    if(!b) return 'NO_SUBMIT:${btnText}';
    if(b.disabled) return 'DISABLED';
    b.click();
    return 'OK';
  })()`;
}

// ---- storage key inventory (P14 in the volume spec) ---------------------------

// The keys the app is allowed to have persisted. Used by the "this feature added
// no new localStorage key" assertions (P14a, P31a) to detect an unexpected key.
// 'spellcaster_profiles' is the profile index and is deliberately NOT scoped -
// it is how a profile is found in the first place. __bareKeys() strips the
// profile prefix off before this comparison, so the list stays in bare names.
// 'spellcaster_import_backups' joined it on 2026-10-14: the pre-import snapshot
// that makes "replace active" recoverable (profileBundle.js snapshotProfile).
// It is global for the same reason the index is - the point is to read it back
// when the profile it describes no longer holds what it said it did. Without it
// here, any Windows run whose store already held one failed P14a and P31a for a
// key the import feature legitimately owns.
// 'spellcaster_import_notice' joined it on 2026-10-15 (step 7): the one-shot
// import summary, parked by importBundle because the remount destroys the modal
// that would report it, and read-and-removed on the next mount. Also global, and
// also deliberately absent from a suite's expected key set unless an import ran.
export const KNOWN_KEYS = [
  'backgroundSettings', 'boxSize', 'ttrpg_characters', 'ttrpg_characters_icon',
  'ttrpg_data_version', 'ttrpg_environment', 'ttrpg_environment_icon',
  'ttrpg_groups', 'ttrpg_themes', 'localStorageMigrationCompleted',
  'spellcaster_profiles', 'spellcaster_import_backups', 'spellcaster_import_notice'
];