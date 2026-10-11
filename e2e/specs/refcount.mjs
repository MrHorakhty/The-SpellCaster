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

import { PAGE_HELPERS } from '../lib/page.mjs';

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
  localStorage.setItem('ttrpg_characters', JSON.stringify([{
    id:'c1', name:'Human Paladin', sounds:[{
      id:'guard_s1', name:'Guard Test', type:'Test', icon:'',
      files:[{name:'guard_test.mp3', displayName:'Guard Test.mp3', storedName:'guard_test.mp3'}],
      color:'#ff0000', duration:0, fadeIn:0, fadeOut:0, loop:false, randomPlay:false,
      brightness:1, glowEnabled:false, glowProminence:0.5
    }]
  }]));
  localStorage.setItem('ttrpg_environment', JSON.stringify([]));
  localStorage.setItem('ttrpg_groups', JSON.stringify([]));
  localStorage.setItem('ttrpg_themes', JSON.stringify([]));
  localStorage.setItem('ttrpg_data_version', '3');
  // Create the actual key the app would have written, so the guard has something to protect.
  localStorage.setItem('sound_file_guard_test.mp3', 'data:text/plain;base64,Z3VhcmRfZGF0YQ==');
  return 'seeded';
})()`;

const ORPHAN_SEED = `(() => {
  localStorage.setItem('ttrpg_characters', JSON.stringify([{
    id:'c3', name:'Lone Character', sounds:[{
      id:'neg_s1', name:'Orphan Test', type:'Test', icon:'',
      files:[{name:'orphan_test.mp3', displayName:'Orphan Test.mp3', storedName:'orphan_test.mp3'}],
      color:'#0000ff', duration:0, fadeIn:0, fadeOut:0, loop:false, randomPlay:false,
      brightness:1, glowEnabled:false, glowProminence:0.5
    }]
  }]));
  localStorage.setItem('sound_file_orphan_test.mp3', 'data:text/plain;base64,b3JwaGFuX2RhdGE=');
  localStorage.setItem('ttrpg_environment', JSON.stringify([]));
  localStorage.setItem('ttrpg_groups', JSON.stringify([]));
  localStorage.setItem('ttrpg_data_version', '3');
  return 'seeded';
})()`;

export const refcount = {
  title: 'SUITE G: FILE REFCOUNT GUARD',
  async run(ctx) {
    const { log, evalJs, sleep, reload, isTauri, driver } = ctx;

    const rehydrate = async () => { await evalJs(PAGE_HELPERS); await evalJs(MC_HELPERS); };

    await evalJs(GUARD_SEED);
    await reload();
    await rehydrate();

    // A copy needs a second character to land in.
    await evalJs(`(() => {
      const c = JSON.parse(localStorage.getItem('ttrpg_characters') || '[]');
      c.push({ id:'c2', name:'Elf Sorcerer', sounds:[] });
      localStorage.setItem('ttrpg_characters', JSON.stringify(c));
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
      const l = JSON.parse(localStorage.getItem('ttrpg_characters') || '[]');
      const copy = l.find(c => c.name === 'Elf Sorcerer')?.sounds?.find(s => s.name === 'Guard Test (copy)');
      const orig = l.find(c => c.name === 'Human Paladin')?.sounds?.find(s => s.name === 'Guard Test');
      return {
        copyExists: !!copy,
        sharedFile: !!copy && !!orig && copy.files?.[0]?.storedName === orig.files?.[0]?.storedName,
        fileKeyExists: !!localStorage.getItem('sound_file_guard_test.mp3')
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
      const l = JSON.parse(localStorage.getItem('ttrpg_characters') || '[]');
      const copy = l.find(c => c.name === 'Elf Sorcerer')?.sounds?.find(s => s.name === 'Guard Test (copy)');
      return {
        paladinGone: !l.find(c => c.name === 'Human Paladin'),
        copyExists: !!copy,
        fileKeyExists: !!localStorage.getItem('sound_file_guard_test.mp3'),
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
      await rehydrate();
      await driver.enterEditMode();
      await ctx.deleteCharacter('Lone Character');
      const guardNegative = await evalJs(`(() => ({
        fileKeyExists: !!localStorage.getItem('sound_file_orphan_test.mp3'),
        chars: JSON.parse(localStorage.getItem('ttrpg_characters') || '[]').length
      }))()`);
      log('GUARD', 'G5: unreferenced file IS removed',
        guardNegative?.fileKeyExists === false && guardNegative?.chars === 0 ? 'PASS' : 'FAIL', JSON.stringify(guardNegative));
    } else {
      const where = driver.isDesktop ? 'Windows' : 'Android';
      log('GUARD', 'G5: skipped on ' + where, 'WARN',
        'Tauri keeps uploads as physical files, not localStorage keys; the negative localStorage case is not applicable');
    }

    await driver.exitEditMode();
  }
};