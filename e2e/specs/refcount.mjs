// Shared file-reference-count guard spec (Suite G, G1-G5).
//
// The safety-critical one. A move/copy COPY shares the source's audio file
// reference rather than duplicating bytes, so every destructive file cleanup in
// the app is guarded by isFileReferencedElsewhere (App.jsx). If that guard ever
// regresses, deleting a container silently deletes the file a copy in another
// container still points at - and the app has five container shapes, two of
// which are reachable only through a group (App.jsx:1812 allSoundContainers).
// That is app logic, identical on every platform, so the guard belongs in a
// shared spec rather than a desktop-only suite.
//
// The only platform divergence is HOW a character container is deleted:
// desktop clicks the sidebar row's delete badge, mobile clicks the drawer's.
// That is ctx.deleteCharacter.
//
// G5 is a NEGATIVE test and is inherently browser-only: it asserts that a
// localStorage sound_file_* key disappears when its last owner is deleted. Under
// Tauri the audio is a real file in the app's uploads dir, not a localStorage
// key, so seeding the key proves nothing there. Windows already skips it with a
// WARN and it logs one on Android for the same reason; Android then reports
// 1 WARN / exit 1 exactly like the Windows phase does today.

import { PAGE_HELPERS, awaitBoard } from '../lib/page.mjs';

// Re-injected after every reload - the picker helpers live on window.
const MC_HELPERS = `(() => {
  window.__mcOpen = (cardName) => {
    const c = [...document.querySelectorAll('[data-sound-card]')].find(c => c.textContent.includes(cardName));
    if (!c) return 'NO_CARD';
    const b = c.parentElement?.querySelector('button[title="Move or Copy Sound"]');
    if (!b) return 'NO_BTN';
    b.click(); return 'OK';
  };
  window.__mcRow = (section, name) => {
    const secs = [...document.querySelectorAll('p')].filter(p => (p.className||'').includes('uppercase') && (p.className||'').includes('font-semibold'));
    const sec = secs.find(p => p.textContent.trim() === section);
    if (!sec) return null;
    const rows = [...(sec.parentElement?.children||[])].filter(el => el.tagName === 'DIV');
    return rows.find(r => { const span = r.querySelector('span'); return span && span.firstChild && span.firstChild.textContent.trim() === name; }) || null;
  };
  window.__mcClick = (section, name, verb) => {
    const row = window.__mcRow(section, name);
    if (!row) return 'NO_ROW';
    const b = row.querySelector('button[title="' + verb + ' to ' + name + '"]');
    if (!b) return 'NO_BTN';
    b.click(); return 'OK';
  };
  return 'ok';
})()`;

const GUARD_SEED = `(() => {
  localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([{
    id:'c1', name:'Human Paladin', sounds:[{
      id:'guard_s1', name:'Guard Test', type:'Test', icon:'',
      files:[{name:'guard_test.mp3', displayName:'Guard Test.mp3', storedName:'guard_test.mp3'}],
      color:'#ff0000', duration:0, fadeIn:0, fadeOut:0, loop:false, randomPlay:false,
      brightness:1, glowEnabled:false, glowProminence:0.5
    }]
  }]));
  localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([]));
  localStorage.setItem(window.__pk('ttrpg_groups'), JSON.stringify([]));
  localStorage.setItem(window.__pk('ttrpg_themes'), JSON.stringify([]));
  localStorage.setItem(window.__pk('ttrpg_data_version'), '3');
  // Create the actual key the app would have written, so the guard has something
  // to protect. Web audio is profile-scoped like every other key.
  localStorage.setItem(window.__pk('sound_file_guard_test.mp3'), 'data:text/plain;base64,Z3VhcmRfZGF0YQ==');
  return 'seeded';
})()`;

const ORPHAN_SEED = `(() => {
  localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([{
    id:'c3', name:'Lone Character', sounds:[{
      id:'neg_s1', name:'Orphan Test', type:'Test', icon:'',
      files:[{name:'orphan_test.mp3', displayName:'Orphan Test.mp3', storedName:'orphan_test.mp3'}],
      color:'#0000ff', duration:0, fadeIn:0, fadeOut:0, loop:false, randomPlay:false,
      brightness:1, glowEnabled:false, glowProminence:0.5
    }]
  }]));
  localStorage.setItem(window.__pk('sound_file_orphan_test.mp3'), 'data:text/plain;base64,b3JwaGFuX2RhdGE=');
  localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([]));
  localStorage.setItem(window.__pk('ttrpg_groups'), JSON.stringify([]));
  localStorage.setItem(window.__pk('ttrpg_data_version'), '3');
  return 'seeded';
})()`;

// The two-sound fixture: TWO sounds sharing ONE storedName - which is what the
// copy feature produces when you copy a sound inside the same character. The
// first sound also owns a file of its own, because a sound with no file at all
// cannot be saved. The storedNames are REAL uploaded files (see G6), because
// under Tauri the audio is a physical file and a localStorage key would prove
// nothing there.
const sharedSeed = (sharedName, ownName) => `(() => {
  localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([{
    id:'c1', name:'Human Paladin', sounds:[
      { id:'share_s1', name:'Share Test', type:'Test', icon:'',
        files:[
          {name:'${sharedName}', displayName:'Shared Test.mp3', storedName:'${sharedName}'},
          {name:'${ownName}', displayName:'Own Test.mp3', storedName:'${ownName}'}
        ],
        color:'#ff0000', duration:0, fadeIn:0, fadeOut:0, loop:false, randomPlay:false,
        brightness:1, glowEnabled:false, glowProminence:0.5 },
      { id:'share_s2', name:'Share Test Two', type:'Test', icon:'',
        files:[{name:'${sharedName}', displayName:'Shared Test.mp3', storedName:'${sharedName}'}],
        color:'#00ff00', duration:0, fadeIn:0, fadeOut:0, loop:false, randomPlay:false,
        brightness:1, glowEnabled:false, glowProminence:0.5 }
    ]
  }]));
  localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([]));
  localStorage.setItem(window.__pk('ttrpg_groups'), JSON.stringify([]));
  localStorage.setItem(window.__pk('ttrpg_themes'), JSON.stringify([]));
  localStorage.setItem(window.__pk('ttrpg_data_version'), '3');
  return 'seeded';
})()`;

export const refcount = {
  title: 'SUITE G: FILE REFCOUNT GUARD',
  async run(ctx) {
    const { log, evalJs, sleep, reload, isTauri, driver, submitModal, upload } = ctx;

    const rehydrate = async () => { await evalJs(PAGE_HELPERS); await evalJs(MC_HELPERS); };

    await evalJs(GUARD_SEED);
    await reload();
    await awaitBoard(ctx, { min: 1, seed: GUARD_SEED });
    await rehydrate();

    // A copy needs a second character to land in.
    await evalJs(`(() => {
      const c = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')) || '[]');
      c.push({ id:'c2', name:'Elf Sorcerer', sounds:[] });
      localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify(c));
      return 'added';
    })()`);
    await reload();
    await rehydrate();

    await driver.enterEditMode();

    // G1/G2: the copy shares the storedName rather than minting a new file.
    const openPicker = await evalJs(`window.__mcOpen('Guard Test')`);
    await sleep(400);
    const clickCopy = await evalJs(`window.__mcClick('Characters','Elf Sorcerer','Copy')`);
    await sleep(700);

    const guardAfterCopy = await evalJs(`(() => {
      const l = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')) || '[]');
      const copy = l.find(c => c.name === 'Elf Sorcerer')?.sounds?.find(s => s.name === 'Guard Test (copy)');
      const orig = l.find(c => c.name === 'Human Paladin')?.sounds?.find(s => s.name === 'Guard Test');
      return {
        copyExists: !!copy,
        sharedFile: !!copy && !!orig && copy.files?.[0]?.storedName === orig.files?.[0]?.storedName,
        fileKeyExists: !!localStorage.getItem(window.__pk('sound_file_guard_test.mp3'))
      };
    })()`);
    log('GUARD', 'G1: copy shares storedName', guardAfterCopy?.sharedFile ? 'PASS' : 'FAIL',
      'open=' + (openPicker?.__error || openPicker) + ' click=' + (clickCopy?.__error || clickCopy) + ' ' + JSON.stringify(guardAfterCopy));
    log('GUARD', 'G2: file key exists after copy', guardAfterCopy?.fileKeyExists ? 'PASS' : 'FAIL', '');

    // G3/G4: delete the container that owns the ORIGINAL file reference. The
    // unguarded path sweeps every file the container referenced, which would
    // leave the copy pointing at a deleted file.
    await ctx.deleteCharacter('Human Paladin');

    const guardAfterDelete = await evalJs(`(() => {
      const l = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')) || '[]');
      const copy = l.find(c => c.name === 'Elf Sorcerer')?.sounds?.find(s => s.name === 'Guard Test (copy)');
      return {
        paladinGone: !l.find(c => c.name === 'Human Paladin'),
        copyExists: !!copy,
        fileKeyExists: !!localStorage.getItem(window.__pk('sound_file_guard_test.mp3')),
        copyFile: copy?.files?.[0]?.storedName
      };
    })()`);
    log('GUARD', 'G3: source character deleted', guardAfterDelete?.paladinGone ? 'PASS' : 'FAIL', '');
    log('GUARD', 'G4: copy still has file key after container delete',
      guardAfterDelete?.fileKeyExists && guardAfterDelete?.copyExists ? 'PASS' : 'FAIL', JSON.stringify(guardAfterDelete));

    if (!isTauri) {
      // G5: the negative case - a file whose ONLY owner was the deleted
      // container must actually go, or the guard is just leaking storage.
      await evalJs(ORPHAN_SEED);
      await reload();
      await awaitBoard(ctx, { min: 1, seed: ORPHAN_SEED });
      await rehydrate();
      await driver.enterEditMode();
      await ctx.deleteCharacter('Lone Character');
      const guardNegative = await evalJs(`(() => ({
        fileKeyExists: !!localStorage.getItem(window.__pk('sound_file_orphan_test.mp3')),
        chars: JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')) || '[]').length
      }))()`);
      log('GUARD', 'G5: unreferenced file IS removed',
        guardNegative?.fileKeyExists === false && guardNegative?.chars === 0 ? 'PASS' : 'FAIL', JSON.stringify(guardNegative));
    } else {
      const where = driver.isDesktop ? 'Windows' : 'Android';
      log('GUARD', 'G5: skipped on ' + where, 'WARN',
        'Tauri keeps uploads as physical files, not localStorage keys; the negative localStorage case is not applicable');
    }

    // ---- G6: removing a file from ONE of two sounds that share it -------
    // The user's report: "I removed some audio and now the export says the
    // files are not present". The bytes were deleted while a SIBLING sound in
    // the same container still pointed at them, because the reference check
    // excluded the whole CONTAINER rather than the one sound being edited.
    // The result was a silent sound and a profile bundle that refused to
    // export.
    //
    // The fixture uses REAL uploaded files, not a seeded localStorage key:
    // under Tauri the audio is a physical file, and a key would prove nothing
    // there - which is exactly where the user hit it.
    // The board needs a character before the edit bar offers "Add Sound" - the
    // G5 negative case above deleted the last one, and an empty board renders
    // an empty state instead of the edit bar.
    await evalJs(`(() => {
      localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([{ id:'c1', name:'Human Paladin', sounds:[
        { id:'warm_s1', name:'Warm Up', type:'Test', icon:'', files:[{name:'Tavern_Music.mp3', displayName:'Tavern_Music.mp3'}],
          color:'#84cc16', duration:0, fadeIn:0, fadeOut:0, loop:false, randomPlay:false, brightness:1 }
      ] }]));
      return 'seeded';
    })()`);
    await reload();
    await awaitBoard(ctx, { min: 1 });
    await rehydrate();
    await driver.enterEditMode();
    // "Add Sound" lives in the DRAWER on the phone and in the edit bar on the
    // desktop, so open the drawer where there is one and look in both places.
    if (typeof ctx.openDrawer === 'function') await ctx.openDrawer();
    await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b = (d ? [...d.querySelectorAll('button')] : []).find(x => x.textContent.trim() === 'Add Sound')
             || [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Add Sound');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(700);
    await upload(2);
    await sleep(800);
    await evalJs(`window.__setInput('name','Upload Probe')`);
    await submitModal('Add Sound');
    await sleep(1400);
    const uploadedNames = await evalJs(`(() => {
      const l = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')) || '[]');
      for (const c of l) for (const s of (c.sounds || [])) if (s.name === 'Upload Probe') return (s.files || []).map(f => f.storedName).filter(Boolean);
      return [];
    })()`);
    const sharedName = uploadedNames[0] || null;
    const ownName = uploadedNames[1] || null;
    log('GUARD', 'G6-setup: one real upload gives two stored files to share',
      uploadedNames.length === 2 ? 'PASS' : 'FAIL', JSON.stringify(uploadedNames));

    await evalJs(sharedSeed(sharedName || 'shared_test.mp3', ownName || 'own_test.mp3'));
    await reload();
    await awaitBoard(ctx, { min: 2, seed: sharedSeed(sharedName || 'shared_test.mp3', ownName || 'own_test.mp3') });
    await rehydrate();
    await driver.enterEditMode();
    await evalJs(`(() => {
      const c = document.querySelector('[data-sound-card][data-sound-id="share_s1"]');
      const b = c?.parentElement?.querySelector('button[title="Edit Sound"]');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(800);
    await evalJs(`(() => {
      const row = document.querySelector('[data-fade-row]');
      const rm = row?.querySelector('button[title="Remove file"]');
      if (rm) rm.click();
      return 'OK';
    })()`);
    await sleep(300);
    await submitModal('Save Changes');
    await sleep(900);
    const g6 = await evalJs(`(() => {
      const l = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')) || '[]');
      const paladin = l.find(c => c.name === 'Human Paladin');
      const edited = paladin?.sounds?.find(s => s.id === 'share_s1');
      const sibling = paladin?.sounds?.find(s => s.id === 'share_s2');
      return {
        editedFiles: (edited?.files || []).map(f => f.storedName),
        siblingFiles: (sibling?.files || []).map(f => f.storedName),
        fileKeyExists: !!localStorage.getItem(window.__pk('sound_file_' + ${JSON.stringify(sharedName)}))
      };
    })()`);
    const g6ok = g6 && Array.isArray(g6.editedFiles) && g6.editedFiles.length === 1
      && g6.editedFiles[0] === ownName
      && Array.isArray(g6.siblingFiles) && g6.siblingFiles.length === 1
      && g6.siblingFiles[0] === sharedName;
    log('GUARD', 'G6: removing a file from one of two sounds that share it keeps the bytes the sibling uses',
      g6ok ? 'PASS' : 'FAIL', JSON.stringify(g6));
    if (!isTauri) {
      log('GUARD', 'G6b: the shared file key still exists after the removal',
        g6?.fileKeyExists === true ? 'PASS' : 'FAIL', `key=${g6?.fileKeyExists}`);
    } else {
      log('GUARD', 'G6b: skipped on ' + (driver.isDesktop ? 'Windows' : 'Android'), 'WARN',
        'Tauri keeps uploads as physical files, not localStorage keys; the key check is not applicable');
    }

    // ---- G6c: on EVERY platform, the sibling still RESOLVES its audio ----
    // A sound whose bytes are gone falls back to /assets/<name>; a sound whose
    // bytes are there does not. That difference is visible on every platform,
    // so the regression is guarded where it actually happened - and it is the
    // state the user's export error was describing.
    await driver.exitEditMode();
    await evalJs(`(() => {
      if (!window.__origAudio) {
        window.__audios = [];
        window.__origAudio = window.Audio;
        window.Audio = function(...a) { const el = new window.__origAudio(...a); window.__audios.push(el); return el; };
        window.Audio.prototype = window.__origAudio.prototype;
      }
      return 'OK';
    })()`);
    const siblingCard = await driver.centeredCard('[data-sound-card][data-sound-id="share_s2"]');
    if (siblingCard) await driver.trustedTap(siblingCard.x, siblingCard.y);
    await sleep(1400);
    const g6c = await evalJs(`(() => {
      const a = (window.__audios||[]).filter(x => x._soundId === 'share_s2')[0];
      return a ? { src: a.src } : null;
    })()`);
    log('GUARD', 'G6c: the sibling sound still resolves its own audio, not the /assets fallback',
      g6c && typeof g6c.src === 'string' && !g6c.src.includes('/assets/') ? 'PASS' : 'FAIL', JSON.stringify(g6c));
    await driver.enterEditMode();

    // ---- G7: removing a file and CLOSING the modal keeps the bytes -------
    // The bytes used to be deleted the moment "Remove" was clicked, before
    // anything was saved - so closing the modal without saving left the sound
    // pointing at a file that no longer existed. The bytes are now released
    // when the change is committed, not when the row is removed.
    await evalJs(sharedSeed(sharedName || 'shared_test.mp3', ownName || 'own_test.mp3'));
    await reload();
    await awaitBoard(ctx, { min: 2, seed: sharedSeed(sharedName || 'shared_test.mp3', ownName || 'own_test.mp3') });
    await rehydrate();
    await driver.enterEditMode();
    await evalJs(`(() => {
      const c = document.querySelector('[data-sound-card][data-sound-id="share_s1"]');
      const b = c?.parentElement?.querySelector('button[title="Edit Sound"]');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(800);
    await evalJs(`(() => {
      const row = document.querySelector('[data-fade-row]');
      const rm = row?.querySelector('button[title="Remove file"]');
      if (rm) rm.click();
      return 'OK';
    })()`);
    await sleep(300);
    await evalJs(`(() => {
      const b = document.querySelector('[data-sound-modal-close]');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(700);
    const g7 = await evalJs(`(() => {
      const l = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')) || '[]');
      const paladin = l.find(c => c.name === 'Human Paladin');
      const edited = paladin?.sounds?.find(s => s.id === 'share_s1');
      return {
        editedFiles: (edited?.files || []).map(f => f.storedName),
        fileKeyExists: !!localStorage.getItem(window.__pk('sound_file_' + ${JSON.stringify(sharedName)}))
      };
    })()`);
    const g7ok = g7 && Array.isArray(g7.editedFiles) && g7.editedFiles.length === 2
      && g7.editedFiles.includes(sharedName);
    log('GUARD', 'G7: removing a file and closing without saving keeps the reference',
      g7ok ? 'PASS' : 'FAIL', JSON.stringify(g7));
    if (!isTauri) {
      log('GUARD', 'G7b: the file key still exists after the removal was abandoned',
        g7?.fileKeyExists === true ? 'PASS' : 'FAIL', `key=${g7?.fileKeyExists}`);
    } else {
      log('GUARD', 'G7b: skipped on ' + (driver.isDesktop ? 'Windows' : 'Android'), 'WARN',
        'Tauri keeps uploads as physical files, not localStorage keys; the key check is not applicable');
    }

    await driver.exitEditMode();
  }
};