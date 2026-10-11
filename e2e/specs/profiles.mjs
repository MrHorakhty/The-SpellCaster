// Shared Profiles spec (Suite F, F1-F12).
//
// This is step 1 of PROFILE_SYNC_SPEC.md: the storage adapter, the profile
// index, the first-run migration, and a profile switch. It does NOT cover
// export/import - that is the bundle format, a later step.
//
// THE HEADLINE ASSERTION IS F6. The three auto-save effects (App.jsx) stringify a
// WHOLE slice into localStorage on every state change, undebounced, with no write
// choke point. A switch that swapped state in place would leave a window in
// which those effects hold profile A's characters and profile B's key prefix -
// silently writing A's board into B. The chosen design (spec §0.3 decision 2) is
// a FULL REMOUNT, which removes the window by construction: the new profile is
// the first-load state, so prefix and state cannot disagree.
//
// So the test is not "does the board look right after switching" - it is
// "are both profiles BYTE-IDENTICAL to before", because a visual check passes
// even when the storage underneath has been crossed over.
//
// Everything here is storage + DOM driven and needs no native dialog, so it runs
// identically on web, Windows and Android.
//
// Id prefix F: verified free when this suite was written (P1-P34 are volume and
// priming, Q is mobile priming). run `node e2e/check-coverage.mjs --update` after
// adding ids.

const HELPERS = `(() => {
  // The Settings button. Both headers carry title="Settings" (desktop and
  // mobile), so finding by title is the one call that works on either.
  window.__openSettings = () => {
    const l = [...document.querySelectorAll('button[title="Settings"]')];
    const b = l.find(x => x.offsetParent !== null) || l[0];
    if (!b) return 'NO_SETTINGS_BTN';
    b.click(); return 'OK';
  };
  window.__closeSettings = () => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Close Settings');
    if (!b) return 'NO_CLOSE';
    b.click(); return 'OK';
  };
  window.__profiles = () => {
    const idx = JSON.parse(localStorage.getItem('spellcaster_profiles') || 'null');
    return { active: idx?.activeProfileId || null, profiles: (idx?.profiles || []).map(p => ({ id: p.id, name: p.name })) };
  };
  window.__boardOf = (pid) => {
    const v = localStorage.getItem('profile:' + pid + ':ttrpg_characters');
    return v === null ? null : JSON.parse(v);
  };
  window.__charNames = (pid) => (window.__boardOf(pid) || []).map(c => c.name);
  window.__newProfile = (name) => {
    const el = document.querySelector('[data-profile-new-name]');
    if (!el) return 'NO_INPUT';
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    s.call(el, name);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const b = document.querySelector('[data-profile-create]');
    if (!b) return 'NO_CREATE';
    b.click(); return 'OK';
  };
  window.__switchTo = (name) => {
    const row = [...document.querySelectorAll('[data-profile-row]')]
      .find(r => r.textContent.includes(name));
    if (!row) return 'NO_ROW';
    const b = row.querySelector('[data-profile-switch]');
    if (!b) return 'NO_SWITCH_BTN';
    b.click(); return 'OK';
  };
  window.__deleteProfile = (name) => {
    const row = [...document.querySelectorAll('[data-profile-row]')]
      .find(r => r.textContent.includes(name));
    if (!row) return 'NO_ROW';
    const b = row.querySelector('[data-profile-delete]');
    if (!b) return 'NO_DELETE_BTN';
    b.click(); return 'OK';
  };
})()`;

const REHYDRATE = async (ctx) => {
  await ctx.evalJs(HELPERS);
};

// Add a character through the real UI. This is deliberately NOT a storage poke:
// the whole point of F6a/F9 is that the undebounced auto-save effects run, so
// the edit has to go through the app.
//
// The button lives somewhere different per platform, and rather than
// platform-flag this (ctx carries isTauri, not which platform), it TRIES the
// desktop path and FALLS BACK to the mobile one. Desktop has "Add Character" in
// the edit bar; mobile only exposes it in the drawer, under the Characters tab,
// so the first attempt returns NO: there and the second path takes over. That is
// also what caught this: the mobile run failed F6b/F9/F10/F11 purely because the
// edit never happened, and every one of them was asserting on its consequence.
async function addCharacter(ctx, name) {
  const { evalJs, sleep, submitModal, driver, openDrawer, closeDrawer } = ctx;
  await driver.enterEditMode();

  let opened = await evalJs(`window.__clickText('Add Character')`);
  let viaDrawer = false;
  if (opened !== 'OK') {
    viaDrawer = true;
    if (typeof openDrawer === 'function') {
      await openDrawer();
      await sleep(400);
    }
    await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      if (!d) return 'NO_DRAWER';
      const tab = [...d.querySelectorAll('button')].find(x => x.textContent.trim() === 'Characters');
      if (tab) tab.click();
      return 'OK';
    })()`);
    await sleep(400);
    opened = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      if (!d) return 'NO_DRAWER';
      const b = [...d.querySelectorAll('button')].find(x => x.textContent.trim() === 'Add Character');
      if (!b) return 'NO_ADD_CHAR_BTN';
      b.click(); return 'OK';
    })()`);
  }
  await sleep(500);
  const named = await evalJs(`window.__setInput('name', ${JSON.stringify(name)})`);
  const submitted = await submitModal('Add Character');
  await sleep(900);
  if (viaDrawer && typeof closeDrawer === 'function') {
    await closeDrawer();
    await sleep(300);
  }
  await driver.exitEditMode();
  return `open=${opened} name=${named} submit=${submitted}${viaDrawer ? ' (drawer)' : ''}`;
}

export const profiles = {
  title: 'SUITE F: PROFILES (STORAGE, MIGRATION, SWITCH)',
  async run(ctx) {
    const { log, evalJs, sleep, reload } = ctx;

    // ---- F0: the first-run migration adopts pre-profile data ----------------
    // Seed the LEGACY unprefixed shape, exactly as the pre-profiles release
    // stored it, with no profile index present. ensureProfileStore() must adopt
    // it into a default profile rather than dropping it on the floor.
    // PROFILE-GUARD-OFF: F1 seeds the PRE-profiles storage shape on purpose - bare
    // unprefixed keys and no profile index - because adopting exactly that is
    // what the first-run migration is being asked to do.
    await evalJs(`(() => {
      for (let i = localStorage.length - 1; i >= 0; i--) localStorage.removeItem(localStorage.key(i));
      localStorage.setItem('ttrpg_characters', JSON.stringify([
        { id:'legacy_c1', name:'Legacy Paladin', sounds:[
          { id:'legacy_s1', name:'Legacy Smite', type:'Holy', icon:'', files:[{name:'Longbow_4.mp3', displayName:'Longbow_4.mp3'}],
            color:'#ff0000', duration:0, fadeIn:0, fadeOut:0, loop:false, randomPlay:false, brightness:1, volume:1 }
        ]},
        { id:'legacy_c2', name:'Legacy Wizard', sounds:[] }
      ]));
      localStorage.setItem('ttrpg_environment', JSON.stringify([{ id:'', category:'Legacy Dungeon', icon:'', sounds:[] }]));
      localStorage.setItem('ttrpg_groups', JSON.stringify([]));
      localStorage.setItem('ttrpg_data_version', '3');
      localStorage.setItem('boxSize', '1.25');
      localStorage.setItem('backgroundSettings', JSON.stringify({ type:'color', theme:'Forest', color:'#0b1220' }));
      localStorage.setItem('ttrpg_characters_icon', 'Shield');
      return 'seeded';
    })()`);
    // PROFILE-GUARD-ON
    await reload();
    await REHYDRATE(ctx);
    await sleep(600);

    // PROFILE-GUARD-OFF: the one assertion that MUST read the bare legacy key - it
    // is the check that the first-run migration MOVED the data rather than
    // copying it and leaving the original behind.
    const f0 = await evalJs(`(() => {
      const p = window.__profiles();
      const a = p.active ? window.__boardOf(p.active) : null;
      return {
        profiles: p.profiles.length,
        active: p.active,
        adoptedNames: (a || []).map(c => c.name),
        legacyKeyGone: localStorage.getItem('ttrpg_characters') === null,
        boxSize: p.active ? localStorage.getItem('profile:' + p.active + ':boxSize') : null,
        icon: p.active ? localStorage.getItem('profile:' + p.active + ':ttrpg_characters_icon') : null,
        indexIsGlobal: !!localStorage.getItem('spellcaster_profiles')
      };
    })()`);
    // PROFILE-GUARD-ON
    log('PROFILE', 'F1: first run adopts pre-profile data into a default profile',
      f0?.profiles === 1 && f0?.adoptedNames?.includes('Legacy Paladin') && f0?.adoptedNames?.includes('Legacy Wizard') && f0?.legacyKeyGone
        ? 'PASS' : 'FAIL', JSON.stringify(f0));
    log('PROFILE', 'F2: per-profile keys carry the profile prefix (boxSize + section icon follow)',
      f0?.boxSize === '1.25' && f0?.icon === 'Shield' ? 'PASS' : 'FAIL', `boxSize=${f0?.boxSize} icon=${f0?.icon}`);
    log('PROFILE', 'F3: the profile index is itself NOT prefixed',
      f0?.indexIsGlobal && f0?.active && !f0.active.startsWith('profile:') ? 'PASS' : 'FAIL', `active=${f0?.active}`);

    // ---- create a second profile -------------------------------------------
    const idA = f0?.active;
    await evalJs(`window.__openSettings()`);
    await sleep(700);
    const madeB = await evalJs(`window.__newProfile('Board Two')`);
    await sleep(1500);            // creating also switches, which remounts
    await REHYDRATE(ctx);
    await sleep(400);

    const afterB = await evalJs(`(() => {
      const p = window.__profiles();
      return {
        count: p.profiles.length,
        names: p.profiles.map(x => x.name),
        active: p.active,
        activeNames: p.active ? window.__charNames(p.active) : [],
        aNames: ${JSON.stringify(idA)} ? window.__charNames(${JSON.stringify(idA)}) : []
      };
    })()`);
    const idB = afterB?.active;
    log('PROFILE', 'F4: creating a profile switches to it',
      madeB === 'OK' && afterB?.count === 2 && idB && idB !== idA ? 'PASS' : 'FAIL',
      `make=${madeB} ${JSON.stringify(afterB)}`);
    log('PROFILE', 'F5: the new profile does NOT inherit the old board (no bleed)',
      Array.isArray(afterB?.activeNames) && afterB.activeNames.length >= 0
        && !(afterB?.activeNames || []).includes('Legacy Paladin')
        && (afterB?.aNames || []).includes('Legacy Paladin')
        ? 'PASS' : 'FAIL', `B=${JSON.stringify(afterB?.activeNames)} A=${JSON.stringify(afterB?.aNames)}`);

    // ---- THE HEADLINE: A -> B -> A leaves BOTH byte-identical ---------------
    const aBefore = await evalJs(`JSON.stringify(window.__boardOf(${JSON.stringify(idA)}))`);
    const bBefore = await evalJs(`JSON.stringify(window.__boardOf(${JSON.stringify(idB)}))`);

    // Editing B through the real UI, so the undebounced auto-save effects fire
    // exactly as they would for a user. This follows the same sequence Suite C
    // uses: edit mode on, "Add Character", set the name field, submit.
    const addedToB = await addCharacter(ctx, 'B Only Hero');

    const bEdited = await evalJs(`JSON.stringify(window.__boardOf(${JSON.stringify(idB)}))`);
    const aAfterEdit = await evalJs(`JSON.stringify(window.__boardOf(${JSON.stringify(idA)}))`);
    log('PROFILE', 'F6a: editing profile B leaves profile A byte-identical',
      aAfterEdit === aBefore ? 'PASS' : 'FAIL',
      `add=${addedToB} A unchanged=${aAfterEdit === aBefore}`);
    log('PROFILE', 'F6b: the edit landed in B',
      bEdited !== bBefore && (bEdited || '').includes('B Only Hero') ? 'PASS' : 'FAIL', '');

    // Switch back to A.
    await evalJs(`window.__openSettings()`);
    await sleep(700);
    const switchedBack = await evalJs(`window.__switchTo('My Board')`);
    await sleep(1500);
    await REHYDRATE(ctx);
    await sleep(400);

    const aAfterSwitch = await evalJs(`JSON.stringify(window.__boardOf(${JSON.stringify(idA)}))`);
    const bAfterSwitch = await evalJs(`JSON.stringify(window.__boardOf(${JSON.stringify(idB)}))`);
    const nowActive = await evalJs(`window.__profiles().active`);
    log('PROFILE', 'F7: A -> B -> A returns to A with A byte-identical',
      switchedBack === 'OK' && nowActive === idA && aAfterSwitch === aBefore ? 'PASS' : 'FAIL',
      `switch=${switchedBack} active=${nowActive} A identical=${aAfterSwitch === aBefore}`);
    log('PROFILE', 'F8: B is byte-identical after the round trip (nothing leaked into it either)',
      bAfterSwitch === bEdited ? 'PASS' : 'FAIL', '');

    // ---- edit immediately after switching (the path a remount does not cover)
    const addedToA = await addCharacter(ctx, 'A After Switch');
    await sleep(800);
    await reload();
    await REHYDRATE(ctx);

    const afterReload = await evalJs(`(() => ({
      a: window.__charNames(${JSON.stringify(idA)}),
      b: window.__charNames(${JSON.stringify(idB)}),
      active: window.__profiles().active
    }))()`);
    log('PROFILE', 'F9: edit immediately after switching persists to A, and only A',
      (afterReload?.a || []).includes('A After Switch')
        && !(afterReload?.b || []).includes('A After Switch')
        && !(afterReload?.a || []).includes('B Only Hero')
        && afterReload?.active === idA
        ? 'PASS' : 'FAIL', JSON.stringify(afterReload));

    // ---- DATA_VERSION skew MIGRATES, it does not reset ----------------------
    await evalJs(`(() => {
      localStorage.setItem('profile:' + window.__profiles().active + ':ttrpg_data_version', '1');
      return 'set';
    })()`);
    await reload();
    await REHYDRATE(ctx);
    await sleep(500);
    const migrated = await evalJs(`(() => ({
      names: window.__charNames(window.__profiles().active),
      version: localStorage.getItem('profile:' + window.__profiles().active + ':ttrpg_data_version')
    }))()`);
    log('PROFILE', 'F10: a DATA_VERSION mismatch MIGRATES the board, it does not reset it',
      (migrated?.names || []).includes('A After Switch') && migrated?.version === '3'
        ? 'PASS' : 'FAIL', JSON.stringify(migrated));

    // ---- deleting a profile removes ONLY its own keys --------------------------
    // Order matters and was wrong the first time round: the "last profile cannot
    // be deleted" check needs to be DOWN to one profile, so the scoped delete
    // has to happen first. (With two profiles present, BOTH rows correctly offer
    // a delete button - that is the `profiles.length > 1` condition in the UI.)
    await evalJs(`window.__openSettings()`);
    await sleep(700);
    const delB = await evalJs(`(() => {
      window.confirm = () => true;   // no native dialog in a headless run
      const row = [...document.querySelectorAll('[data-profile-row]')].find(r => r.textContent.includes('Board Two'));
      if (!row) return 'NO_ROW';
      const b = row.querySelector('[data-profile-delete]');
      if (!b) return 'NO_DELETE_BTN';
      b.click(); return 'OK';
    })()`);
    await sleep(1800);
    await REHYDRATE(ctx);
    await evalJs(`window.__openSettings()`);
    await sleep(700);
    const afterDeleteB = await evalJs(`(() => {
      const p = window.__profiles();
      return {
        names: p.profiles.map(x => x.name),
        bKeyCount: window.__keysFor(${JSON.stringify(idB)}).length,
        aNames: window.__charNames(${JSON.stringify(idA)}),
        deleteButtons: document.querySelectorAll('[data-profile-delete]').length,
        rows: document.querySelectorAll('[data-profile-row]').length
      };
    })()`);
    log('PROFILE', 'F11: deleting a profile removes only its own keys',
      delB === 'OK' && !(afterDeleteB?.names || []).includes('Board Two')
        && afterDeleteB?.bKeyCount === 0
        && (afterDeleteB?.aNames || []).includes('A After Switch')
        ? 'PASS' : 'FAIL', JSON.stringify(afterDeleteB));
    log('PROFILE', 'F12: with one profile left there is no way to delete it',
      afterDeleteB?.rows === 1 && afterDeleteB?.deleteButtons === 0 ? 'PASS' : 'FAIL',
      `rows=${afterDeleteB?.rows} deleteButtons=${afterDeleteB?.deleteButtons}`);
  },
};
