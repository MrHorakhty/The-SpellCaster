// Shared "Reset to starter sounds" spec (Suite O, O1-O10).
//
// Covers restoreDefaults (App.jsx:2959 -> mergeShippedDefaults, App.jsx:349).
// This shipped as bde7483 and was uncovered for the whole life of the project —
// deferred twice on the grounds that it "wipes the fixture every later suite
// reads". That reasoning was only half right: it rewrites the board, but it does
// not DESTROY user content, so a self-seeding spec that runs LAST is perfectly
// safe. This is that spec.
//
// The feature is a MERGE, not a wipe, and every assertion below pins one clause
// of that contract. The contract, in the app's own words (App.jsx:342-348):
//   - shipped entries come FIRST, in shipped order
//   - each shipped entry is reset to its shipped state (name + sounds)
//   - the user's OWN sounds are kept, AFTER the shipped ones
//   - user-created entries follow, in their existing order
//   - running it twice changes nothing
// and from the settings-modal copy the user actually reads (App.jsx:6652):
//   - "your own characters, categories and groups are never touched"
//
// Two traps this is built around, both from reading mergeShippedDefaults:
//
//   1. Environment categories have NO id — `category` IS the key (App.jsx:343).
//      So renaming a default category breaks the name anchor, and the function
//      falls back to matching a stored entry that still carries one of the
//      default's sound ids (App.jsx:371-373). O6 exists to exercise exactly that
//      fallback, because a test that only ever renamed nothing would never see
//      it — and without it, renaming a default category duplicates every default
//      sound.
//   2. A sound is "user content" only if its id is not in ANY default's sound
//      list (allShippedSoundIds, App.jsx:355). A shipped sound the user dragged
//      into a different character is therefore restored to its own home rather
//      than being treated as the user's. O4 pins that a genuinely user id
//      survives; the restore-side of the rule is pinned by the sound counts.
//
// The fixture uses real shipped ids from src/data.json (char_1..char_3,
// s_1..s_11, env_1..env_7) because the merge matches on them.
//
// O11-O14 came later (step 7, 2026-10-15) and are the profile-scoping proof: the
// merge must land in the ACTIVE profile and leave every other profile's keys
// byte-identical. Nothing needed changing in the app for it - `activeProfileId`
// is fixed per mount - but it had never been asserted. They run LAST because the
// profile switch remounts the tree, and O14 exists because a test that CREATES a
// profile must delete it: "Other Board" outlived the run on Android and broke
// four unrelated suites on the next one.

const byId = (list, id) => (list || []).find(x => x.id === id);
const names = list => (list || []).map(x => x.name);
// Environment entries have no `name` - `category` IS the key (App.jsx:343), so a
// shared `names()` over them prints [null, null] and hides which one failed.
const cats = list => (list || []).map(x => x.category);

export const resetDefaults = {
  title: 'SUITE O: RESET TO STARTER SOUNDS',
  async run(ctx) {
    const { log, evalJs, sleep, reload } = ctx;
    // Same helper bundle.mjs uses. Every other id in this spec predates it and
    // writes the ternary out longhand; O14 uses this, and a spec that calls `ok`
    // without defining it dies with a ReferenceError that kills the whole run -
    // eslint cannot see it, because the reference is inside a spec object.
    const ok = (cond) => (cond ? 'PASS' : 'FAIL');

    // A board that has been edited in every way the merge distinguishes:
    //   - char_2 renamed, one shipped sound dropped, one user sound added, a
    //     user icon set
    //   - a user-created character
    //   - an environment category renamed so the name anchor is broken, carrying
    //     one shipped env sound (so the id fallback has something to find)
    //   - a group, which restoreDefaults must never touch
    const seed = `(() => {
      const snd = (id, name) => ({ id, name, type:'Test', icon:'', files:[{name:'Longbow_4.mp3', displayName:'Longbow_4.mp3'}],
        color:'#ff0000', duration:0, fadeIn:0, fadeOut:0, loop:false, randomPlay:false, brightness:1 });
      localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([
        { id:'char_2', name:'Renamed Paladin', icon:'PaladinIcon.png', sounds:[ snd('s_6','Shield Bash'), snd('mine_1','My Custom Spell') ] },
        { id:'zz_custom', name:'My Hero', icon:'', sounds:[ snd('mine_2','Only Mine') ] }
      ]));
      localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([
        { id:'', category:'Renamed Category', icon:'', sounds:[ snd('env_5','Wind Howl'), snd('mine_3','My Ambience') ] }
      ]));
      localStorage.setItem(window.__pk('ttrpg_groups'), JSON.stringify([
        { id:'g1', name:'Untouched Group', mode:'environment', categories:[{ id:'gc1', category:'Untouched Category', sounds:[ snd('mine_4','Mine In A Group') ] }], characters:[] }
      ]));
      localStorage.setItem(window.__pk('ttrpg_themes'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_data_version'), '3');
      localStorage.removeItem(window.__pk('backgroundSettings'));
      localStorage.removeItem(window.__pk('boxSize'));
      for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k.startsWith('profile:'+window.__pid()+':sound_file_')) localStorage.removeItem(k);}
      return 'seeded';
    })()`;

    // Both headers carry a title="Settings" button (desktop App.jsx:4777, mobile
    // App.jsx:4768), so this is the one call that works on either platform.
    const openSettings = `(() => {
      const l = [...document.querySelectorAll('button[title="Settings"]')];
      const b = l.find(x => x.offsetParent !== null) || l[0];
      if (!b) return 'NO_SETTINGS_BTN';
      b.click(); return 'OK';
    })()`;

    // "Restore defaults" text appears TWICE once the confirm dialog is up: the
    // dark settings button and the red confirm button. Before the dialog opens
    // only the settings one exists, so the first match is correct at open time
    // and the red one is selected explicitly afterwards.
    const clickRestore = `(() => {
      const l = [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === 'Restore defaults');
      if (!l.length) return 'NO_RESTORE_BTN';
      l[0].click(); return 'OK';
    })()`;

    const confirmRestore = `(() => {
      const b = [...document.querySelectorAll('button')]
        .find(x => x.textContent.trim() === 'Restore defaults' && /bg-red-600/.test(x.className));
      if (!b) return 'NO_CONFIRM_BTN';
      b.click(); return 'OK';
    })()`;

    const stored = `(() => ({
      characters: JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')) || '[]'),
      environment: JSON.parse(localStorage.getItem(window.__pk('ttrpg_environment')) || '[]'),
      groups: JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups')) || '[]'),
      version: localStorage.getItem(window.__pk('ttrpg_data_version')),
      oldKeys: window.__bareKeys().filter(k => k.endsWith('_old'))
    }))()`;

    await evalJs(seed);
    await reload();
    await sleep(800);

    // ---- O1: the entry point CONFIRMS, it does not act ----------------------
    await evalJs(openSettings);
    await sleep(700);
    const o1open = await evalJs(clickRestore);
    await sleep(500);
    const o1 = await evalJs(`(() => {
      const s = ${stored};
      return {
        dialog: [...document.querySelectorAll('h2')].some(h => h.textContent.trim() === 'Restore Defaults'
                 && h.closest('.fixed')),
        stillRenamed: s.characters.some(c => c.name === 'Renamed Paladin')
      };
    })()`);
    log('RESET','O1: the button opens a confirmation and changes nothing yet',
      o1open === 'OK' && o1?.dialog===true && o1?.stillRenamed===true?'PASS':'FAIL',
      `click=${o1open} ${JSON.stringify(o1)}`);

    // ---- O2: Cancel is a real out ------------------------------------------
    await evalJs(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Cancel'
        && x.closest('.fixed'));
      if (!b) return 'NO_CANCEL'; b.click(); return 'OK';
    })()`);
    await sleep(500);
    const o2 = await evalJs(`(() => {
      const s = ${stored};
      return { dialogOpen: [...document.querySelectorAll('h2')].some(h => h.textContent.trim() === 'Restore Defaults' && h.closest('.fixed')),
               stillRenamed: s.characters.some(c => c.name === 'Renamed Paladin') };
    })()`);
    log('RESET','O2: Cancel closes the dialog and leaves the board alone',
      o2?.dialogOpen===false && o2?.stillRenamed===true?'PASS':'FAIL',JSON.stringify(o2));

    // ---- do the real thing --------------------------------------------------
    await evalJs(openSettings);
    await sleep(700);
    await evalJs(clickRestore);
    await sleep(400);
    await evalJs(confirmRestore);
    await sleep(1200);

    const after = await evalJs(stored);
    const chars = after?.characters || [];
    const env = after?.environment || [];
    const paladin = byId(chars, 'char_2');
    const effects = env.find(e => e.category === 'Environmental Effects');

    // ---- O3: shipped first, in shipped order -------------------------------
    log('RESET','O3: shipped characters come first in shipped order',
      JSON.stringify(names(chars).slice(0,3)) === JSON.stringify(['Elf Sorcerer','Human Paladin','Wood Elf Ranger'])
        ? 'PASS':'FAIL', JSON.stringify(names(chars)));

    // ---- O4: a renamed default is renamed back ------------------------------
    log('RESET','O4: a renamed shipped character is renamed back',
      paladin?.name === 'Human Paladin' ? 'PASS':'FAIL', `name=${paladin?.name}`);

    // ---- O5: the user's own sounds survive, after the shipped ones ---------
    const paladinSounds = (paladin?.sounds || []).map(s => s.id);
    log('RESET','O5: shipped sounds restored in shipped order, user sounds kept after',
      JSON.stringify(paladinSounds) === JSON.stringify(['s_5','s_6','s_7','mine_1']) ? 'PASS':'FAIL',
      JSON.stringify(paladinSounds));

    // ---- O6: a user-created entry survives, after the shipped ones ----------
    log('RESET','O6: a user-created character is kept, after the shipped ones',
      chars.length === 4 && chars[3]?.name === 'My Hero' ? 'PASS':'FAIL',
      `count=${chars.length} last=${chars[chars.length-1]?.name}`);

    // ---- O7: environment falls back to sound ids when the name anchor breaks -
    // The stored category is "Renamed Category", so the exact-name match fails
    // and the id fallback (App.jsx:371-373) has to find it via env_5. If that
    // fallback broke, "Environmental Effects" would be re-added alongside the
    // renamed copy and every shipped env sound would appear twice.
    log('RESET','O7: a renamed default category is restored via the sound-id fallback',
      Boolean(effects) && JSON.stringify((effects?.sounds||[]).map(s => s.id)) === JSON.stringify(['env_4','env_5','env_6','env_7','mine_3'])
        ? 'PASS':'FAIL',
      `categories=${JSON.stringify(cats(env))} effectsSounds=${JSON.stringify((effects?.sounds||[]).map(s => s.id))}`);

    // ---- O8: groups are never touched (the modal says so out loud) ----------
    const g = (after?.groups || [])[0];
    log('RESET','O8: groups are left completely untouched',
      g?.name === 'Untouched Group' && (g?.categories?.[0]?.category) === 'Untouched Category'
        && (g?.categories?.[0]?.sounds || []).map(s => s.id).join(',') === 'mine_4' ? 'PASS':'FAIL',
      JSON.stringify(g?.categories?.[0]?.sounds?.map(s => s.id)));

    // ---- O9: the icon survives, because data.json ships none ---------------
    // mergeShippedDefaults keeps `existing.icon` deliberately (App.jsx:385-387):
    // there is nothing to restore and clearing it would discard a user choice.
    log('RESET','O9: a user-set icon on a shipped character is preserved',
      paladin?.icon === 'PaladinIcon.png' ? 'PASS':'FAIL', `icon=${paladin?.icon}`);

    // ---- O10: idempotent, and no storage-version churn ----------------------
    // The function's own comment promises "running it twice changes nothing".
    await evalJs(openSettings);
    await sleep(700);
    await evalJs(clickRestore);
    await sleep(400);
    await evalJs(confirmRestore);
    await sleep(1200);
    const twice = await evalJs(stored);
    const same = JSON.stringify(twice?.characters) === JSON.stringify(after?.characters)
      && JSON.stringify(twice?.environment) === JSON.stringify(after?.environment);
    log('RESET','O10: running it twice changes nothing, DATA_VERSION untouched, no *_old keys',
      same && twice?.version === '3' && (twice?.oldKeys?.length || 0) === 0 ? 'PASS':'FAIL',
      `identical=${same} version=${twice?.version} oldKeys=${JSON.stringify(twice?.oldKeys)}`);

    // ---- O11-O13: it acts on the ACTIVE PROFILE ONLY ------------------------
    //
    // Spec §9.2 asked for Restore Defaults to be "profile-scoped", which was
    // written PRE-profiles and is, it turns out, already satisfied by construction:
    // restoreDefaults only calls setState, and `activeProfileId` is fixed for the
    // lifetime of a mount (App.jsx:4270-4274 - the remount-on-switch decision).
    // So nothing needed changing. What was missing is any assertion at all, and an
    // unasserted property is a property that can regress silently - which is the
    // whole reason this lives here rather than in a comment.
    //
    // LAST in the spec, deliberately: creating and switching profiles remounts the
    // tree, so nothing after this can rely on the fixture this spec seeded.
    const boardOf = (pid) => `(() => {
      const g = (k) => localStorage.getItem('profile:' + ${JSON.stringify(pid)} + ':' + k);
      return JSON.stringify({ characters: g('ttrpg_characters'), environment: g('ttrpg_environment'), groups: g('ttrpg_groups') });
    })()`;
    const indexOf = () => `(() => {
      const i = JSON.parse(localStorage.getItem('spellcaster_profiles') || 'null');
      const list = i?.profiles || [];
      return { active: i?.activeProfileId || null, names: list.map(p => p.name), last: list.length ? list[list.length - 1].id : null };
    })()`;

    // The profile this spec seeded - whatever was ACTIVE on entry. Read before the
    // create, because the create is what changes it. (Not `profiles[0]`: an earlier
    // suite may have left more than one profile behind, and the seeded board is on
    // the active one.)
    const homeId = (await evalJs(indexOf()))?.active || null;

    // Creating a profile ALREADY switches to it and remounts
    // (handleCreateProfile -> handleSwitchProfile, App.jsx:892-899), and the
    // remount takes the Settings modal with it. So there is nothing left to click:
    // the switch WAS the create. O11 asserts exactly that rather than driving a
    // button that is correctly not there any more.
    await evalJs(openSettings);
    await sleep(700);
    const madeB = await evalJs(`(() => {
      const el = document.querySelector('[data-profile-new-name]');
      if (!el) return 'NO_INPUT';
      const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      s.call(el, 'Other Board');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const b = document.querySelector('[data-profile-create]');
      if (!b) return 'NO_CREATE';
      b.click(); return 'OK';
    })()`);
    await sleep(1200);

    const idx = await evalJs(indexOf());
    const otherId = idx?.active || null;

    await evalJs(openSettings);
    await sleep(800);
    const rowShown = await evalJs(`(() => {
      const row = [...document.querySelectorAll('[data-profile-row]')].find(r => r.textContent.includes('Other Board'));
      return row ? (row.getAttribute('data-profile-active') || 'false') : 'NO_ROW';
    })()`);
    // __pid() is what every seeding helper resolves through, so if it does not
    // agree with the index the next seed would land on the wrong profile - which
    // is the exact confusion this section exists to rule out.
    const pidNow = await evalJs(`window.__pid()`);

    log('RESET','O11: creating a profile switches to it and remounts (the scoping test needs two)',
      madeB === 'OK' && otherId && otherId !== homeId && otherId === idx?.last && rowShown === 'true' && pidNow === otherId ? 'PASS':'FAIL',
      `created=${madeB} home=${homeId} active=${otherId} last=${idx?.last} names=${JSON.stringify(idx?.names)} rowActive=${rowShown} __pid=${pidNow}`);

    if (!otherId || otherId === homeId || pidNow !== otherId) {
      log('RESET','O12: Restore Defaults leaves the INACTIVE profile byte-identical','FAIL',`no second profile is active (active=${otherId} __pid=${pidNow})`);
      log('RESET','O13: Restore Defaults merges into the ACTIVE profile','FAIL',`no second profile is active (active=${otherId} __pid=${pidNow})`);
      return;
    }

    // Captured AFTER the create and its remount, deliberately: handleSwitchProfile
    // flushes the outgoing profile on the way through, and a capture taken before
    // that would be comparing against bytes the app was always going to rewrite.
    const homeBefore = await evalJs(boardOf(homeId));

    // Profile B is empty, so "merged into B" is unambiguous: the shipped defaults
    // must appear in B and only in B. Seed one renamed shipped character first, so
    // this is the same merge as O3-O10 rather than a first-run fallback - and its
    // rename being reverted is the O4 contract applied to a second profile.
    await evalJs(`(() => {
      localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([
        { id:'char_2', name:'B Renamed Paladin', icon:'', sounds:[] }
      ]));
      localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_groups'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_data_version'), '3');
      return 'seeded-b';
    })()`);
    await reload();
    await sleep(1000);

    const bSeeded = await evalJs(`(() => {
      const g = (k) => JSON.parse(localStorage.getItem('profile:' + ${JSON.stringify(otherId)} + ':' + k) || 'null');
      const a = (k) => JSON.parse(localStorage.getItem('profile:' + ${JSON.stringify(homeId)} + ':' + k) || 'null');
      return { bNames: (g('ttrpg_characters') || []).map(c => c.name), aNames: (a('ttrpg_characters') || []).map(c => c.name) };
    })()`);

    await evalJs(openSettings);
    await sleep(700);
    const o13click = await evalJs(clickRestore);
    await sleep(400);
    const o13confirm = await evalJs(confirmRestore);
    await sleep(1200);

    const o12 = await evalJs(`(() => ({
      home: (() => {
        const g = (k) => localStorage.getItem('profile:' + ${JSON.stringify(homeId)} + ':' + k);
        return JSON.stringify({ characters: g('ttrpg_characters'), environment: g('ttrpg_environment'), groups: g('ttrpg_groups') });
      })(),
      active: (JSON.parse(localStorage.getItem('spellcaster_profiles') || 'null')?.activeProfileId || null),
    }))()`);

    log('RESET','O12: Restore Defaults leaves the INACTIVE profile byte-identical',
      o12?.home === homeBefore ? 'PASS':'FAIL',
      `unchanged=${o12?.home === homeBefore} active=${o12?.active} (expected ${otherId})`);

    const bChars = await evalJs(`JSON.parse(localStorage.getItem('profile:' + ${JSON.stringify(otherId)} + ':ttrpg_characters') || '[]')`);
    const bNames = names(bChars);
    log('RESET','O13: the merge landed in the ACTIVE profile - B got the shipped defaults, A kept its own',
      o13click === 'OK' && o13confirm === 'OK'
        && JSON.stringify(bNames.slice(0,3)) === JSON.stringify(['Elf Sorcerer','Human Paladin','Wood Elf Ranger'])
        && bNames.includes('B Renamed Paladin') === false
        && o12?.home === homeBefore ? 'PASS':'FAIL',
      `B=${JSON.stringify(bNames.slice(0,5))} seeded=${JSON.stringify(bSeeded?.bNames)} A=${JSON.stringify(bSeeded?.aNames)} AUnchanged=${o12?.home === homeBefore}`);

    // ---- O14: leave the store as we found it ---------------------------------
    //
    // Without this, "Other Board" survived the run as the ACTIVE profile. On
    // Windows the localStorage restore hid it; on Android, whose phase keeps its
    // snapshots in %TEMP% and restores less rigorously, it persisted - and the
    // NEXT run's first read of it wrote `ttrpg_characters_old`, failing Q9, P13,
    // P14a and M21 four suites away from the spec that caused it.
    //
    // 💡 That is the 2026-10-11 lesson wearing a different hat: the cost was not in
    // the suite that broke something, it was in the one that left the state behind.
    // A test that creates a profile must delete it, not rely on someone else's
    // snapshot to clean up.
    // Rows are selected by `data-profile-row`, never by name: more than one
    // profile can be called "My Board" (the Android store had three), and
    // `find(textContent.includes(...))` would return whichever came first - not
    // necessarily the one this spec started on.
    await evalJs(openSettings);
    await sleep(800);
    const backHome = await evalJs(`(() => {
      const row = document.querySelector('[data-profile-row="' + ${JSON.stringify(homeId)} + '"]');
      const b = row && row.querySelector('[data-profile-switch]');
      if (!b) return 'NO_SWITCH_BACK';
      b.click(); return 'OK';
    })()`);
    await sleep(1400);
    await evalJs(openSettings);
    await sleep(800);
    // `window.confirm = () => true` goes in the SAME expression as the click, and
    // is deliberately never restored. handleDeleteProfile awaits a file count
    // before it asks, so a stub installed afterwards arrives too late - and a real
    // native confirm BLOCKS the page, which would wedge the run rather than fail
    // it. This is Suite F's pattern (profiles.mjs:296) and it is the one that
    // works; the first version of this clicked first and stubbed 600ms later.
    const deleted = await evalJs(`(() => {
      window.confirm = () => true;
      const row = document.querySelector('[data-profile-row="' + ${JSON.stringify(otherId)} + '"]');
      if (!row) return 'ALREADY_GONE';
      const b = row.querySelector('[data-profile-delete]');
      if (!b) return 'NO_DELETE_BTN';
      b.click(); return 'CLICKED';
    })()`);
    await sleep(1400);

    const afterCleanup = await evalJs(`(() => {
      const i = JSON.parse(localStorage.getItem('spellcaster_profiles') || 'null');
      const names = (i?.profiles || []).map(p => p.name);
      return {
        active: i?.activeProfileId || null,
        names,
        otherKeys: window.__keysFor(${JSON.stringify(otherId)}),
      };
    })()`);

    log('RESET','O14: the profile this spec created is deleted again - the store is left as found',
      ok(backHome === 'OK' && deleted === 'CLICKED'
        && afterCleanup?.active === homeId
        && !(afterCleanup?.names || []).includes('Other Board')
        && (afterCleanup?.otherKeys || []).length === 0),
      `switchBack=${backHome} delete=${deleted} active=${afterCleanup?.active} (expected ${homeId}) names=${JSON.stringify(afterCleanup?.names)} leftoverKeys=${JSON.stringify(afterCleanup?.otherKeys)}`);
  }
};