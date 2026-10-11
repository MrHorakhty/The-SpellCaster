// Mobile E2E suite — tests mobile-specific UI of The SpellCaster.
// Covers: rail navigation, drawer open/close, drawer tab switching, sound grid
// rendering, edit mode via grid button, add/edit/delete sound via drawer,
// character CRUD via drawer, group CRUD via drawer, empty states, settings,
// sound priming via touch press-and-hold (Suite Q, Input.dispatchTouchEvent),
// and move/copy into every container shape (Suite M).
//
// Nine suites are SHARED specs in ./specs, run from here AND from e2e-full.mjs:
//   volume         P1-P16   per-sound volume + persistence
//   indicators     U1-U7    card indicators (replaces the old inline Suite R)
//   sliders        B1-B4    box-size slider + reload persistence
//   soundIntoGroup H1-H2    adding a sound into a group category (drawer nav)
//   dragReorder    X1-X2    drag-to-reorder via a real touch drag
//   refcount       G1-G5    file-reference guard on container deletion
//   platformGate   W1-W6    the isMobile gate picks the right chrome
//   scroll         R1-R10   single-view scroll containment
//   playback       Z1-Z10   live playback: fade, live master, loop, Stop All
// Shared CDP/report/seed/page plumbing lives in ./lib, the platform divergence
// (gestures, edit-mode toggle, drawer navigation, file upload) is absorbed by
// ./lib/driver.mjs and the ctx helpers below.
// Env: CDP_PORT, LABEL, SAVE_RESTORE ('1'), EXPECT_TAURI ('1')
// Note: the uploaded WAV is generated in-page (see uploadWav) - this suite never
// touches e2e_silence.wav on disk, which the desktop suite (e2e-full) still
// needs for CDP DOM.setFileInputFiles.
import { connect, sleep } from './lib/cdp.mjs';
import { createReport } from './lib/report.mjs';
import { CAPTURE_LS, INSTRUMENT_AUDIO, PAGE_HELPERS, SEED, restoreLs, submitModalExpr } from './lib/page.mjs';
import { makeDriver } from './lib/driver.mjs';
import { runSpecs } from './lib/spec-runner.mjs';
import { volume } from './specs/volume.mjs';
import { indicators } from './specs/indicators.mjs';
import { sliders } from './specs/sliders.mjs';
import { soundIntoGroup } from './specs/soundintogroup.mjs';
import { dragReorder } from './specs/drag.mjs';
import { refcount } from './specs/refcount.mjs';
import { platformGate } from './specs/platform.mjs';
import { scroll } from './specs/scroll.mjs';
import { playback } from './specs/playback.mjs';

const DEBUG_PORT = process.env.CDP_PORT || 9224;
const LABEL = process.env.LABEL || 'MOBILE';
const SAVE_RESTORE = process.env.SAVE_RESTORE === '1';
const EXPECT_TAURI = process.env.EXPECT_TAURI === '1';

async function main() {
  const { cdp, cdpInput, evalJs, close } = await connect({ port: DEBUG_PORT, label: LABEL, fatalExit: 3 });
  const driver = makeDriver({ platform: 'mobile', cdp, cdpInput, evalJs, sleep });

  const report = createReport(LABEL, 'MOBILE E2E SUMMARY');
  const { log, run } = report;

  let capturedLS = null;
  if (SAVE_RESTORE) {
    const cap = await evalJs(CAPTURE_LS);
    if (cap && cap.length < 3000000) { capturedLS = JSON.parse(cap); console.log(`[${LABEL}] captured ${Object.keys(capturedLS).length} localStorage keys`); }
    else console.log(`[${LABEL}] WARNING: localStorage capture too large / failed (${(cap||'').length}b) -- no restore`);
  }

  // Seed: same as e2e-full.mjs
  await evalJs(SEED);
  console.log(`[${LABEL}] SEED applied`);
  await cdp('Page.reload', { ignoreCache: true });
  await sleep(3500);

  // Instrument playback
  await run('PLAY', 'D0: instrument audio', () => evalJs(INSTRUMENT_AUDIO));

  // Set up page-level helpers
  await run('NAV', 'helpers', () => evalJs(PAGE_HELPERS));

  // Helper: upload WAV. NOTE: do NOT use CDP DOM.setFileInputFiles here - the Android
  // WebView rejects it as a bad IPC message ("Terminating renderer for bad IPC message,
  // reason 2") which kills the renderer and then the whole app, so the run dies silently.
  // Build the WAV in the page and hand it to the input via DataTransfer instead.
  async function uploadWav() {
    return evalJs(`(() => {
      const input = document.querySelector('input[type="file"][accept*=".mp3"]') || document.querySelector('input[type="file"]');
      if (!input) return 'NO_INPUT';
      const rate = 8000, seconds = 2, dataLen = rate * seconds;
      const buf = new ArrayBuffer(44 + dataLen); const v = new DataView(buf);
      const w = (o,s) => { for (let i=0;i<s.length;i++) v.setUint8(o+i, s.charCodeAt(i)); };
      w(0,'RIFF'); v.setUint32(4, 36+dataLen, true); w(8,'WAVE'); w(12,'fmt ');
      v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
      v.setUint32(24,rate,true); v.setUint32(28,rate,true); v.setUint16(32,1,true);
      v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,dataLen,true);
      const file = new File([buf], 'e2e_silence.wav', { type: 'audio/wav' });
      const dt = new DataTransfer(); dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return 'OK files=' + input.files.length;
    })()`);
  }

  // Helper: submit modal (bg-lime-600 submit button)
  async function submitModal(btnText) {
    return evalJs(submitModalExpr(btnText));
  }

  // Helper: open drawer
  async function openDrawer() {
    await evalJs(`document.querySelector('button[title="Open navigation"]')?.click()`);
    await sleep(500);
  }

  // Helper: close drawer
  async function closeDrawer() {
    await evalJs(`document.querySelector('button[aria-label="Close navigation"]')?.click()`);
    await sleep(400);
  }

  // Helper: toggle mobile edit mode via the grid-header button
  async function toggleMobileEditMode(on) {
    if (on) await driver.enterEditMode(); else await driver.exitEditMode();
  }

  async function waitForReload(ms = 3500) { await sleep(ms); }

  // Context handed to shared specs (e2e/specs/*). reload() re-seeds the DOM:
  // the page wipes window helpers on every load, so specs re-inject what they
  // need themselves. Everything that navigates or opens a modal goes THROUGH the
  // drawer here - there is no sidebar, so a spec cannot click a leaf directly.
  const ctx = {
    label: LABEL,
    log, run,
    evalJs,
    sleep,
    driver,
    isTauri: EXPECT_TAURI,
    submitModal: (t) => evalJs(submitModalExpr(t)),
    upload: () => uploadWav(),
    closeDrawer,
    openDrawer,
    navigateTo: async (text) => {
      await openDrawer();
      const r = await evalJs(`(() => {
        const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
        if (!d) return 'NO_DRAWER';
        const bs = [...d.querySelectorAll('button')];
        const b = bs.find(x => x.textContent.trim() === '${text}') || bs.find(x => x.textContent.trim().endsWith('${text}'));
        if (!b) return 'NO_BUTTON:${text}';
        b.click(); return 'OK';
      })()`);
      await sleep(400);
      await closeDrawer();
      return r;
    },
    clickModalOpener: async (label) => {
      await openDrawer();
      return evalJs(`(() => {
        const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
        if (!d) return 'NO_DRAWER';
        const b = [...d.querySelectorAll('button')].find(x => x.textContent.trim() === '${label}');
        if (!b) return 'NO_BUTTON:${label}';
        b.click(); return 'OK';
      })()`);
    },
    deleteCharacter: async (name) => {
      await openDrawer();
      const r = await evalJs(`(() => {
        const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
        if (!d) return 'NO_DRAWER';
        const b = [...d.querySelectorAll('button[title^="Delete Character"]')].find(x => x.closest('div')?.textContent.includes('${name}'));
        if (!b) return 'NO_DELETE_BUTTON';
        b.click(); return 'OK';
      })()`);
      await sleep(500);
      await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
      await sleep(1000);
      await closeDrawer();
      return r;
    },
    reload: async () => { await cdp('Page.reload', { ignoreCache: true }); await sleep(3500); }
  };

  // ================================================================
  //  S: SEED INTEGRITY
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE S: SEED INTEGRITY ===`);
  const suiteS = await evalJs(`(() => {
    const r = [];
    const log = (cat,n,s,d) => r.push({cat,n,s,d:d||''});
    const chars = JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    const env = JSON.parse(localStorage.getItem('ttrpg_environment')||'[]');
    const groups = JSON.parse(localStorage.getItem('ttrpg_groups')||'[]');
    log('SEED','S1: 2 characters',chars.length===2?'PASS':'FAIL','count='+chars.length);
    log('SEED','S2: Human Paladin exists',chars.some(c=>c.name==='Human Paladin')?'PASS':'FAIL');
    log('SEED','S3: 3 sounds on Paladin',chars.find(c=>c.name==='Human Paladin')?.sounds?.length===3?'PASS':'FAIL','count='+(chars.find(c=>c.name==='Human Paladin')?.sounds?.length));
    log('SEED','S4: 2 env categories',env.length===2?'PASS':'FAIL','count='+env.length);
    log('SEED','S5: Dungeon exists',env.some(e=>e.category==='Dungeon')?'PASS':'FAIL');
    log('SEED','S6: 2 groups',groups.length===2?'PASS':'FAIL','count='+groups.length);
    log('SEED','S7: Tavern Pack mode=environment',groups.find(g=>g.name==='Tavern Pack')?.mode==='environment'?'PASS':'FAIL');
    log('SEED','S8: Hero Pack mode=characters',groups.find(g=>g.name==='Hero Pack')?.mode==='characters'?'PASS':'FAIL');
    log('SEED','S9: data_version=3',localStorage.getItem('ttrpg_data_version')==='3'?'PASS':'FAIL');
    log('SEED','S10: cards rendered',document.querySelectorAll('[data-sound-card]').length>=3?'PASS':'FAIL','cards='+document.querySelectorAll('[data-sound-card]').length);
    return r;
  })()`);
  if (suiteS?.__error) log('SEED','Suite S','FAIL',suiteS.__error); else for (const r of suiteS) log(r.cat,r.n,r.s,r.d);

  // ================================================================
  //  M: MOBILE LAYOUT
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE M: MOBILE LAYOUT ===`);
  const suiteM = await evalJs(`(() => {
    const r = [];
    const log = (cat,n,s,d) => r.push({cat,n,s,d:d||''});
    const rail = document.querySelector('div.w-14.bg-dark-800');
    log('MOBILE','M1: rail present',!!rail?'PASS':'FAIL');
    const hamburger = document.querySelector('button[title="Open navigation"]');
    log('MOBILE','M2: hamburger button',!!hamburger?'PASS':'FAIL');
    const editBtn = document.querySelector('button[title="Enter Edit Mode"], button[title="Exit Edit Mode"]');
    log('MOBILE','M3: edit toggle on grid',!!editBtn?'PASS':'FAIL');
    const charsTab = document.querySelector('button[title="Characters"]');
    const envTab = document.querySelector('button[title="Environment"]');
    log('MOBILE','M4: rail has Characters tab',!!charsTab?'PASS':'FAIL');
    log('MOBILE','M5: rail has Environment tab',!!envTab?'PASS':'FAIL');
    const grid = document.querySelector('div.grid.gap-3');
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns : '';
    log('MOBILE','M6: grid present',!!grid?'PASS':'FAIL');
    const w = window.innerWidth;
    log('MOBILE','M7: viewport <= 480px',w<=480?'PASS':'FAIL',w+'px');
    return r;
  })()`);
  if (suiteM?.__error) log('MOBILE','Suite M','FAIL',suiteM.__error); else for (const r of suiteM) log(r.cat,r.n,r.s,r.d);

  // ================================================================
  //  N: DRAWER NAVIGATION
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE N: DRAWER NAVIGATION ===`);
  await openDrawer();
  const drawerVisible = await evalJs(`!!document.querySelector('[role="dialog"][aria-label="Navigation"]')`);
  log('DRAWER','N1: drawer opened',drawerVisible?'PASS':'FAIL');

  const drawerTabs = await evalJs(`(() => {
    const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
    if (!d) return [];
    return [...d.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>t.length>0 && t.length<30);
  })()`);
  log('DRAWER','N2: has Characters tab',drawerTabs?.includes('Characters')?'PASS':'FAIL',JSON.stringify(drawerTabs?.slice(0,6)));

  // Switch to Environment via drawer
  await evalJs(`(() => { const d=document.querySelector('[role="dialog"][aria-label="Navigation"]'); const b=[...d.querySelectorAll('button')].find(x=>x.textContent.trim()==='Environment'); if(b) b.click(); return 'OK'; })()`);
  await sleep(400);
  const envCategories = await evalJs(`(() => {
    const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
    return [...d.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>t.length>0 && t.length<30);
  })()`);
  log('DRAWER','N3: Environment tab shows categories',envCategories?.some(t=>t.includes('Dungeon'))?'PASS':'FAIL',JSON.stringify(envCategories?.slice(0,6)));

  // Select Dungeon category
  await evalJs(`(() => { const d=document.querySelector('[role="dialog"][aria-label="Navigation"]'); const b=[...d.querySelectorAll('button')].find(x=>x.textContent.trim()==='Dungeon'); if(b) b.click(); return 'OK'; })()`);
  await sleep(400);
  const headingText = await evalJs(`document.querySelector('h2')?.textContent?.trim() || ''`);
  log('DRAWER','N4: heading shows Dungeon',headingText.includes('Dungeon')?'PASS':'FAIL',headingText);

  // Switch back to Characters via drawer
  await evalJs(`(() => { const d=document.querySelector('[role="dialog"][aria-label="Navigation"]'); const b=[...d.querySelectorAll('button')].find(x=>x.textContent.trim()==='Characters'); if(b) b.click(); return 'OK'; })()`);
  await sleep(400);
  const charHeading = await evalJs(`document.querySelector('h2')?.textContent?.trim() || ''`);
  log('DRAWER','N5: Characters tab switches heading',charHeading.includes('Human Paladin')||charHeading.includes('Elf Sorcerer')?'PASS':'FAIL',charHeading);

  // Close drawer via transparent backdrop
  await evalJs(`document.querySelector('.fixed.inset-0.z-40')?.click()`);
  await sleep(400);
  const drawerGone = await evalJs(`!document.querySelector('[role="dialog"][aria-label="Navigation"]')`);
  log('DRAWER','N6: backdrop closes drawer',drawerGone?'PASS':'FAIL');

  // ================================================================
  //  U: CARD INDICATORS (shared spec - see e2e/specs/indicators.mjs)
  // ================================================================
  // Replaces the old inline Suite R ("sound grid"): R1-R6 were U1, U2, U3, U4
  // and U6 restated, and the shared spec adds the two checks the mobile suite
  // never had - U5 (multi-file icon) and U7 (total loop-icon count).
  await runSpecs(ctx, [indicators]);

  // ================================================================
  //  E: MOBILE EDIT MODE (via grid-header button)
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE E: MOBILE EDIT MODE ===`);
  await toggleMobileEditMode(true);
  const editModeOn = await evalJs(`!!document.querySelector('button[title="Exit Edit Mode"]')`);
  log('EDIT','E1: edit mode activated',editModeOn?'PASS':'FAIL');

  const editBtns = await evalJs(`(() => {
    const cards = [...document.querySelectorAll('[data-sound-card]')];
    const inCard = (c,t) => !!(c?.parentElement?.querySelector('button[title="'+t+'"]'));
    return {
      editCount: cards.filter(c=>inCard(c,'Edit Sound')).length,
      delCount: cards.filter(c=>inCard(c,'Delete Sound')).length,
      total: cards.length
    };
  })()`);
  log('EDIT','E2: Edit Sound buttons visible',editBtns?.editCount===editBtns?.total?'PASS':'FAIL',editBtns?.editCount+'/'+editBtns?.total);
  log('EDIT','E3: Delete Sound buttons visible',editBtns?.delCount===editBtns?.total?'PASS':'FAIL',editBtns?.delCount+'/'+editBtns?.total);

  // Drawer shows Add buttons in edit mode
  await openDrawer();
  const addBtnsInDrawer = await evalJs(`(() => {
    const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
    if (!d) return [];
    return [...d.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>t.startsWith('Add'));
  })()`);
  log('EDIT','E4: drawer has Add buttons in edit mode',addBtnsInDrawer?.length>=2?'PASS':'FAIL',JSON.stringify(addBtnsInDrawer));
  await closeDrawer();

  await toggleMobileEditMode(false);
  const editModeOff = await evalJs(`!!document.querySelector('button[title="Enter Edit Mode"]')`);
  log('EDIT','E5: edit mode deactivated',editModeOff?'PASS':'FAIL');

  // ================================================================
  //  A: ADD SOUND (via drawer in edit mode)
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE A: ADD SOUND ===`);
  await toggleMobileEditMode(true);
  await openDrawer();
  const addSoundClick = await evalJs(`(() => {
    const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
    const b = [...d.querySelectorAll('button')].find(x=>x.textContent.trim()==='Add Sound');
    if(!b) return 'NO';
    b.click(); return 'OK';
  })()`);
  await sleep(600);
  log('SOUND','A1: Add Sound modal opened',addSoundClick==='OK'?'PASS':'FAIL',addSoundClick);

  if (addSoundClick === 'OK') {
    await evalJs(`window.__setInput('name','Divine Light'); window.__setInput('type','Blessing'); window.__setInput('color','#a855f7');`);
    const uploaded = await uploadWav();
    log('SOUND','A2: WAV uploaded',String(uploaded).startsWith('OK')?'PASS':'FAIL',uploaded);
    await sleep(500);
    const addResult = await submitModal('Add Sound');
    log('SOUND','A3: Add Sound submitted',addResult==='OK'?'PASS':'FAIL',addResult);
    await sleep(1000);
    const afterAdd = await evalJs(`(() => {
      const cards = document.querySelectorAll('[data-sound-card]').length;
      const chars = JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
      const pal = chars.find(c=>c.name==='Human Paladin');
      return { cards, soundCount: pal?.sounds?.length||0, firstName: pal?.sounds?.[pal.sounds.length-1]?.name||'' };
    })()`);
    log('SOUND','A4: card count increased',afterAdd?.cards===4?'PASS':'FAIL','cards='+afterAdd?.cards);
    log('SOUND','A5: storage sound count',afterAdd?.soundCount===4?'PASS':'FAIL','count='+afterAdd?.soundCount);
    log('SOUND','A6: new sound name',afterAdd?.firstName==='Divine Light'?'PASS':'FAIL',afterAdd?.firstName);
  }
  await closeDrawer();
  await toggleMobileEditMode(false);

  // ================================================================
  //  J: EDIT SOUND (via per-card edit button in edit mode)
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE J: EDIT SOUND ===`);
  await toggleMobileEditMode(true);
  const editBtnClick = await evalJs(`(() => {
    const c=[...document.querySelectorAll('[data-sound-card]')].find(c=>c.textContent.includes('Smite'));
    if(!c) return 'NO_CARD';
    const b=c.parentElement?.querySelector('button[title="Edit Sound"]');
    if(!b) return 'NO_BTN';
    b.click(); return 'OK';
  })()`);
  await sleep(600);
  log('SOUND','J1: edit modal opened',editBtnClick==='OK'?'PASS':'FAIL',editBtnClick);

  if (editBtnClick === 'OK') {
    const prefilled = await evalJs(`(() => {
      const name=document.querySelector('input[name="name"]');
      const color=document.querySelector('input[name="color"]');
      return { name:name?.value, color:color?.value };
    })()`);
    log('SOUND','J2: name prefilled',prefilled?.name==='Smite'?'PASS':'FAIL',prefilled?.name);
    log('SOUND','J3: color prefilled',prefilled?.color==='#ff0000'?'PASS':'FAIL',prefilled?.color);

    await evalJs(`window.__setInput('name','Divine Smite'); window.__setInput('color','#00ff00');`);
    const saveResult = await submitModal('Save Changes');
    log('SOUND','J4: Save Changes submitted',saveResult==='OK'?'PASS':'FAIL',saveResult);
    await sleep(800);
    const afterEdit = await evalJs(`(() => {
      const chars = JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
      const pal = chars.find(c=>c.name==='Human Paladin');
      const smite = pal?.sounds?.find(s=>s.id==='s1');
      return { name: smite?.name, color: smite?.color };
    })()`);
    log('SOUND','J5: name updated',afterEdit?.name==='Divine Smite'?'PASS':'FAIL',afterEdit?.name);
    log('SOUND','J6: color updated',afterEdit?.color==='#00ff00'?'PASS':'FAIL',afterEdit?.color);
  }
  await toggleMobileEditMode(false);

  // ================================================================
  //  C: CHARACTER CRUD (via drawer in edit mode)
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE C: CHARACTER CRUD ===`);
  await toggleMobileEditMode(true);
  await openDrawer();
  // Switch to Characters tab
  await evalJs(`(() => { const d=document.querySelector('[role="dialog"][aria-label="Navigation"]'); const b=[...d.querySelectorAll('button')].find(x=>x.textContent.trim()==='Characters'); if(b) b.click(); return 'OK'; })()`);
  await sleep(300);
  const addCharClick = await evalJs(`(() => {
    const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
    const b = [...d.querySelectorAll('button')].find(x=>x.textContent.trim()==='Add Character');
    if(!b) return 'NO';
    b.click(); return 'OK';
  })()`);
  await sleep(500);
  log('CHAR','C1: Add Character modal opened',addCharClick==='OK'?'PASS':'FAIL',addCharClick);

  if (addCharClick === 'OK') {
    await evalJs(`window.__setInput('name','Rogue')`);
    const charSubmit = await submitModal('Add Character');
    await sleep(800);
    const charAdded = await evalJs(`(() => {
      const chars=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const sidebar = d ? [...d.querySelectorAll('button')].some(b=>b.textContent.trim()==='Rogue') : false;
      return { has:chars.some(c=>c.name==='Rogue'), sidebar };
    })()`);
    log('CHAR','C2: character added',charAdded?.has?'PASS':'FAIL',JSON.stringify(charAdded));

    // Rename character: on mobile there is no per-row Edit button - you tap the
    // character/category name in the sound-grid header while in edit mode. Adding a
    // character auto-selects it (addCharacter -> setActiveTab), so the header shows 'Rogue'.
    await closeDrawer();
    const editCharClick = await evalJs(`(() => {
      const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Rogue');
      if(!h) return 'NO_HEADER_NAME';
      if(!/text-lime-400/.test(h.className)) return 'NOT_EDITABLE';
      h.click(); return 'OK';
    })()`);
    await sleep(500);
    log('CHAR','C3: edit modal opened',editCharClick==='OK'?'PASS':'FAIL',editCharClick);

    if (editCharClick === 'OK') {
      await evalJs(`window.__setInput('name','Rogue (Stealth)')`);
      await submitModal('Save Changes');
      await sleep(800);
      const charEdited = await evalJs(`(() => {
        const chars=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
        return { hasRogue:chars.some(c=>c.name==='Rogue'), hasNew:chars.some(c=>c.name==='Rogue (Stealth)') };
      })()`);
      log('CHAR','C4: rename succeeded',charEdited?.hasNew&&!charEdited?.hasRogue?'PASS':'FAIL',JSON.stringify(charEdited));
    } else {
      log('CHAR','C4: rename succeeded','FAIL','blocked: '+editCharClick);
    }

    // Delete character via the drawer's delete badge
    await openDrawer();
    const delCharClick = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b=[...d.querySelectorAll('button[title^="Delete Character"]')].find(b=>b.closest('div')?.textContent.includes('Rogue'));
      if(!b) return 'NO_DEL_BTN';
      b.click(); return 'OK';
    })()`);
    await sleep(500);
    log('CHAR','C5: delete confirm opened',delCharClick==='OK'?'PASS':'FAIL',delCharClick);

    if (delCharClick === 'OK') {
      const confirmText = await evalJs(`document.querySelector('[class*="fixed"][class*="z-50"]')?.textContent || ''`);
      log('CHAR','C6: confirm mentions Rogue',confirmText.includes('Rogue')?'PASS':'FAIL',confirmText.slice(0,80));
      await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
      await sleep(800);
      const charDeleted = await evalJs(`JSON.parse(localStorage.getItem('ttrpg_characters')||'[]').some(c=>c.name.includes('Rogue'))`);
      log('CHAR','C7: Rogue deleted',charDeleted===false?'PASS':'FAIL','still_exists='+charDeleted);
    }
  }
  await closeDrawer();
  await toggleMobileEditMode(false);

  // ================================================================
  //  K: CATEGORY CRUD (via drawer in edit mode, Environment tab)
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE K: CATEGORY CRUD ===`);
  await toggleMobileEditMode(true);
  await openDrawer();
  await evalJs(`(() => { const d=document.querySelector('[role="dialog"][aria-label="Navigation"]'); const b=[...d.querySelectorAll('button')].find(x=>x.textContent.trim()==='Environment'); if(b) b.click(); return 'OK'; })()`);
  await sleep(300);
  // Select Forest
  await evalJs(`(() => { const d=document.querySelector('[role="dialog"][aria-label="Navigation"]'); const b=[...d.querySelectorAll('button')].find(x=>x.textContent.trim().endsWith('Forest')); if(b) b.click(); return 'OK'; })()`);
  await sleep(300);

  const addCatClick = await evalJs(`(() => {
    const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
    const b = [...d.querySelectorAll('button')].find(x=>x.textContent.trim()==='Add Category');
    if(!b) return 'NO';
    b.click(); return 'OK';
  })()`);
  await sleep(500);
  log('ENV','K1: Add Category modal opened',addCatClick==='OK'?'PASS':'FAIL',addCatClick);

  if (addCatClick === 'OK') {
    await evalJs(`window.__setInput('name','Cave')`);
    await submitModal('Add Category');
    await sleep(800);
    const catAdded = await evalJs(`(() => {
      const env=JSON.parse(localStorage.getItem('ttrpg_environment')||'[]');
      return env.some(e=>e.category==='Cave');
    })()`);
    log('ENV','K2: category added',catAdded===true?'PASS':'FAIL');

    // Edit category: the mobile drawer has no per-row Edit button - tap the name in the
    // sound-grid header while in edit mode (drawer must be closed first).
    await closeDrawer();
    const editCatClick = await evalJs(`(() => {
      const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Cave');
      if(!h) return 'NO_HEADER_NAME';
      if(!/text-lime-400/.test(h.className)) return 'NOT_EDITABLE';
      h.click(); return 'OK';
    })()`);
    await sleep(500);
    if (editCatClick === 'OK') {
      await evalJs(`window.__setInput('name','Crystal Cave')`);
      await submitModal('Save Changes');
      await sleep(800);
      const catEdited = await evalJs(`(() => {
        const env=JSON.parse(localStorage.getItem('ttrpg_environment')||'[]');
        return { hasCave:env.some(e=>e.category==='Cave'), hasCrystal:env.some(e=>e.category==='Crystal Cave') };
      })()`);
      log('ENV','K3: rename succeeded',catEdited?.hasCrystal&&!catEdited?.hasCave?'PASS':'FAIL',JSON.stringify(catEdited));
    } else {
      log('ENV','K3: rename succeeded','FAIL','blocked: '+editCatClick);
    }
    await openDrawer();

    // Delete category via the drawer's delete badge (edit mode)
    const delCatClick = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b=[...d.querySelectorAll('button[title^="Delete Category"]')].find(b=>b.closest('div')?.textContent.includes('Crystal'));
      if(!b) return 'NO';
      b.click(); return 'OK';
    })()`);
    await sleep(500);
    if (delCatClick === 'OK') {
      const catConfirmText = await evalJs(`document.querySelector('[class*="fixed"][class*="z-50"]')?.textContent || ''`);
      log('ENV','K4: confirm mentions Crystal Cave',catConfirmText.includes('Crystal')?'PASS':'FAIL');
      await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
      await sleep(800);
      const catDeleted = await evalJs(`JSON.parse(localStorage.getItem('ttrpg_environment')||'[]').some(e=>e.category.includes('Crystal'))`);
      log('ENV','K5: Crystal Cave deleted',catDeleted===false?'PASS':'FAIL');
    } else {
      log('ENV','K5: Crystal Cave deleted','FAIL','blocked: '+delCatClick);
    }
  }
  await closeDrawer();
  await toggleMobileEditMode(false);

  // ================================================================
  //  G: GROUP CRUD (via drawer in edit mode)
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE G: GROUP CRUD ===`);
  await toggleMobileEditMode(true);
  // Open drawer and add group via the rail "+" button
  await openDrawer();
  // Switch to Groups tab via rail (first click a group tab)
  await evalJs(`(() => {
    const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
    const b = [...d.querySelectorAll('button')].find(x=>x.textContent.trim().endsWith('Tavern Pack'));
    if(b) b.click();
    return 'OK';
  })()`);
  await sleep(300);

  const addGrpClick = await evalJs(`(() => {
    const b = document.querySelector('button[title="Add New Group"]');
    if (!b) return 'NO:Add New Group';
    b.click(); return 'OK';
  })()`);
  await sleep(500);
  log('GRP','G1: Add Group modal opened',addGrpClick==='OK'?'PASS':'FAIL',addGrpClick);

  if (addGrpClick === 'OK') {
    await evalJs(`window.__setInput('name','Dragon Lore')`);
    await submitModal('Add Group');
    await sleep(800);
    const grpAdded = await evalJs(`(() => {
      const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]');
      return { has:g.some(x=>x.name==='Dragon Lore'), mode:g.find(x=>x.name==='Dragon Lore')?.mode };
    })()`);
    log('GRP','G2: group added',grpAdded?.has?'PASS':'FAIL',JSON.stringify(grpAdded));
    log('GRP','G3: mode defaults to environment',grpAdded?.mode==='environment'?'PASS':'FAIL',grpAdded?.mode);

    // Resolve the new group once by id, so a later rename (or a failed rename) can never
    // cascade into every following check the way a hard-coded name did.
    const grpId = await evalJs(`(() => { const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Dragon Lore'); return g?.id || ''; })()`);
    const G = `JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.id===${JSON.stringify(grpId)})`;

    // Click into Dragon Lore in drawer
    await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b = [...d.querySelectorAll('button')].find(x=>x.textContent.trim().endsWith('Dragon Lore'));
      if(b) b.click(); return 'OK';
    })()`);
    await sleep(400);

    // Rename group: neither the mobile rail nor the drawer has an "Edit Group" button -
    // a group is renamed by tapping its name in the sound-grid header while in edit mode
    // (same affordance as characters/categories). The drawer must be closed first because
    // the header tap is ignored while the drawer is open.
    await closeDrawer();
    const editGrpClick = await evalJs(`(() => {
      const g=${G}; const name=g?.name||'';
      const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim().endsWith(name));
      if(!h) return 'NO_HEADER_NAME:'+name;
      if(!/text-lime-400/.test(h.className)) return 'NOT_EDITABLE';
      h.click(); return 'OK';
    })()`);
    await sleep(500);
    log('GRP','G4: edit group modal opened',editGrpClick==='OK'?'PASS':'FAIL',editGrpClick);

    if (editGrpClick === 'OK') {
      await evalJs(`window.__setInput('name','Dragon Lore Reborn')`);
      await submitModal('Save Changes');
      await sleep(800);
      const grpEdited = await evalJs(`(() => {
        const g=${G};
        return { name:g?.name, renamed:g?.name==='Dragon Lore Reborn' };
      })()`);
      log('GRP','G5: group renamed',grpEdited?.renamed?'PASS':'FAIL',JSON.stringify(grpEdited));
    } else {
      log('GRP','G5: group renamed','FAIL','blocked: '+editGrpClick);
    }
    await openDrawer();

    // Mode toggle: env → characters
    const toggleClick = await evalJs(`(() => {
      const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Character Pack');
      if(b) { b.click(); return 'OK'; }
      return 'NO';
    })()`);
    await sleep(500);
    const conv1 = await evalJs(`(() => {
      const g=${G};
      return { mode:g?.mode, cats:g?.categories?.length, chars:g?.characters?.length };
    })()`);
    log('GRP','G6: mode=characters after toggle',conv1?.mode==='characters'?'PASS':'FAIL',JSON.stringify(conv1));

    // Toggle back
    await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Environment Pack'); if(b) b.click(); return 'OK'; })()`);
    await sleep(500);
    const conv2 = await evalJs(`(() => {
      const g=${G};
      return { mode:g?.mode, cats:g?.categories?.length };
    })()`);
    log('GRP','G7: mode=environment after toggle back',conv2?.mode==='environment'?'PASS':'FAIL',JSON.stringify(conv2));

    // Add category into group
    const addGrpCat = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b = [...d.querySelectorAll('button')].find(x=>x.textContent.trim()==='Add Category');
      if(b) { b.click(); return 'OK'; }
      return 'NO';
    })()`);
    await sleep(500);
    if (addGrpCat === 'OK') {
      await evalJs(`window.__setInput('name','Rumors')`);
      await submitModal('Add Category');
      await sleep(800);
    }
    const grpCatAdded = await evalJs(`(() => {
      const g=${G};
      return g?.categories?.some(c=>c.category==='Rumors');
    })()`);
    log('GRP','G8: group category added',grpCatAdded===true?'PASS':'FAIL');

    // Delete group category
    const delGrpCat = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b=[...d.querySelectorAll('button[title^="Delete Category"]')].find(b=>b.closest('div')?.textContent.includes('Rumors'));
      if(!b) return 'NO';
      b.click(); return 'OK';
    })()`);
    await sleep(400);
    if (delGrpCat === 'OK') {
      await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
      await sleep(700);
    }
    const grpCatDeleted = await evalJs(`(() => {
      const g=${G};
      return g?.categories?.some(c=>c.category==='Rumors');
    })()`);
    log('GRP','G9: group category deleted',grpCatDeleted===false?'PASS':'FAIL');

    // Add character into group (switch to characters mode first)
    await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Character Pack'); if(b) b.click(); return 'OK'; })()`);
    await sleep(400);
    const addGrpChar = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b = [...d.querySelectorAll('button')].find(x=>x.textContent.trim()==='Add Character');
      if(b) { b.click(); return 'OK'; }
      return 'NO';
    })()`);
    await sleep(500);
    if (addGrpChar === 'OK') {
      await evalJs(`window.__setInput('name','Bard')`);
      await submitModal('Add Character');
      await sleep(800);
    }
    const grpCharAdded = await evalJs(`(() => {
      const g=${G};
      return g?.characters?.some(c=>c.name==='Bard');
    })()`);
    log('GRP','G10: group character added',grpCharAdded===true?'PASS':'FAIL');

    // Delete group character
    const delGrpChar = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b=[...d.querySelectorAll('button[title^="Delete Character"]')].find(b=>b.closest('div')?.textContent.includes('Bard'));
      if(!b) return 'NO';
      b.click(); return 'OK';
    })()`);
    await sleep(400);
    if (delGrpChar === 'OK') {
      await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
      await sleep(700);
    }
    const grpCharDeleted = await evalJs(`(() => {
      const g=${G};
      return g?.characters?.some(c=>c.name==='Bard');
    })()`);
    log('GRP','G11: group character deleted',grpCharDeleted===false?'PASS':'FAIL');

    // Delete group
    const delGrpClick = await evalJs(`(() => {
      const g=${G}; const name=g?.name||'';
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b=[...d.querySelectorAll('button[title^="Delete Group"]')].find(b=>b.getAttribute('title')==='Delete Group: '+name);
      if(!b) return 'NO';
      b.click(); return 'OK';
    })()`);
    await sleep(400);
    if (delGrpClick === 'OK') {
      await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
      await sleep(700);
    }
    const grpDeleted = await evalJs(`!!${G}`);
    log('GRP','G12: group deleted',grpDeleted===false?'PASS':'FAIL','still_exists='+grpDeleted);
  }
  await closeDrawer();
  await toggleMobileEditMode(false);

  // ================================================================
  //  V: EMPTY STATES
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE V: EMPTY STATES ===`);
  await evalJs(`(() => {
    localStorage.setItem('ttrpg_characters', JSON.stringify([]));
    localStorage.setItem('ttrpg_environment', JSON.stringify([]));
    return 'emptied';
  })()`);
  await cdp('Page.reload', { ignoreCache: true });
  await waitForReload();
  // The mobile empty states live INSIDE the drawer, so it has to be open to see them.
  await openDrawer();
  const emptyTexts = await evalJs(`(() => {
    const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
    if (!d) return [];
    const texts = [...d.querySelectorAll('p,div,span')].map(e=>e.textContent.trim()).filter(t=>t.includes('No ') && (t.includes('open Edit Mode') || t.includes('toggle Edit Mode')));
    return texts.slice(0,3);
  })()`);
  log('STATE','V1: empty-state text present',emptyTexts?.length>=1?'PASS':'FAIL',JSON.stringify(emptyTexts));
  await closeDrawer();
  // Restore seed
  await evalJs(`(() => {
    const snd = (id,name,type,color,opts) => ({ id, name, type, icon:'Icon.png', files:[{name:name.toLowerCase().replace(/\\s+/g,'_')+'.mp3', displayName:name+'.mp3'}], color, duration:0, randomPlay:false, ...opts });
    localStorage.setItem('ttrpg_characters', JSON.stringify([
      { id:'c1', name:'Human Paladin', sounds:[
        snd('s1','Smite','Holy','#ff0000',{loop:true, fadeIn:0.5, fadeOut:0.5, glowEnabled:true, glowProminence:0.7, files:[{name:'smite.mp3',displayName:'Smite.mp3'}]}),
        snd('s2','Shield Bash','Melee','#3b82f6',{loop:false, randomPlay:true, files:[{name:'shield1.mp3',displayName:'Shield1.mp3'},{name:'shield2.mp3',displayName:'Shield2.mp3'}]}),
        snd('s3','Healing Light','Magic','#22c55e',{loop:true, fadeIn:1.5, files:[{name:'heal.mp3',displayName:'Heal.mp3'}]})
      ]},
      { id:'c2', name:'Elf Sorcerer', sounds:[] }
    ]));
    localStorage.setItem('ttrpg_environment', JSON.stringify([
      { id:'e1', category:'Dungeon', sounds:[snd('e1s1','Dripping','Ambient','#84cc16',{loop:true, files:[{name:'drip.mp3',displayName:'Drip.mp3'}]})] },
      { id:'e2', category:'Forest', sounds:[] }
    ]));
    localStorage.setItem('ttrpg_groups', JSON.stringify([
      { id:'g1', name:'Tavern Pack', mode:'environment', categories:[{id:'gc1', category:'Ambience', sounds:[snd('gs1','Tavern Song','Music','#d97706',{loop:true, files:[{name:'tavern.mp3',displayName:'Tavern.mp3'}]})]}], characters:[] },
      { id:'g2', name:'Hero Pack', mode:'characters', categories:[], characters:[{id:'gch1', name:'Fighter', sounds:[]}] }
    ]));
    localStorage.setItem('ttrpg_data_version', '3');
    return 'restored';
  })()`);
  await cdp('Page.reload', { ignoreCache: true });
  await waitForReload();

  // ================================================================
  //  T: SETTINGS (via header button)
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE T: SETTINGS ===`);
  await evalJs(`document.querySelector('button[title="Settings"]')?.click()`);
  await sleep(600);
  const settingsOpen = await evalJs(`!!document.querySelector('[class*="fixed"][class*="z-50"]')`);
  log('SETTINGS','T1: settings modal opened',settingsOpen?'PASS':'FAIL');

  const themeCount = await evalJs(`(() => {
    const modal = document.querySelector('[class*="fixed"][class*="z-50"]');
    if(!modal) return 0;
    const themeGrid = modal.querySelector('.grid.grid-cols-3');
    return themeGrid ? themeGrid.querySelectorAll('button').length : 0;
  })()`);
  log('SETTINGS','T2: 6 theme buttons',themeCount===6?'PASS':'FAIL','count='+themeCount);

  // Cycle through themes
  for (const theme of ['Forest','Ocean','Fire','Magic','Gold']) {
    await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='${theme}'); if(b) b.click(); return 'OK'; })()`);
    await sleep(300);
    const tData = await evalJs(`(() => {
      const bs = JSON.parse(localStorage.getItem('backgroundSettings')||'{}');
      return { key: bs.theme };
    })()`);
    log('SETTINGS','T3: '+theme+' applied',tData?.key===theme.toLowerCase()?'PASS':'FAIL','key='+tData?.key);
  }

  // Default reset
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Default'); if(b) b.click(); return 'OK'; })()`);
  await sleep(300);
  const defaultReset = await evalJs(`(JSON.parse(localStorage.getItem('backgroundSettings')||'{}')).theme`);
  log('SETTINGS','T4: Default resets',defaultReset==='default'?'PASS':'FAIL',defaultReset);

  // About
  const legalBtn = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Legal')); if(b) b.click(); return b?'OK':'NO'; })()`);
  await sleep(500);
  const aboutText = await evalJs(`document.body.innerText`);
  log('SETTINGS','T5: About shows version',aboutText.includes('Version')&&aboutText.includes('0.1.3')?'PASS':'FAIL');
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Close'); if(b) b.click(); return 'OK'; })()`);
  await sleep(300);

  // Close settings
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Close Settings')); if(b) b.click(); const x=document.querySelector('button[title="Close"]'); if(x) x.click(); return 'OK'; })()`);
  await sleep(400);
  const settingsClosed = await evalJs(`!document.querySelector('[class*="fixed"][class*="z-50"]')`);
  log('SETTINGS','T6: settings closed',settingsClosed?'PASS':'FAIL');

  // ================================================================
  //  D: DELETE SOUND + CANCEL PATH
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE D: DELETE SOUND + CANCEL ===`);
  await toggleMobileEditMode(true);

  // Cancel path
  const delCancelBtn = await evalJs(`(() => {
    const c=[...document.querySelectorAll('[data-sound-card]')].find(c=>c.textContent.includes('Shield Bash'));
    if(!c) return 'NO_CARD';
    const b=c.parentElement?.querySelector('button[title="Delete Sound"]');
    if(!b) return 'NO_BTN';
    b.click(); return 'OK';
  })()`);
  await sleep(500);
  const cancelConfirm = await evalJs(`(() => {
    const t=document.querySelector('[class*="fixed"][class*="z-50"]')?.textContent||'';
    const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Cancel');
    if(b) b.click();
    return { text:t.includes('Shield Bash'), cancelled: !!b };
  })()`);
  log('SOUND','D1: cancel dialog shows Shield Bash',cancelConfirm?.text?'PASS':'FAIL');
  log('SOUND','D2: Cancel dismisses',cancelConfirm?.cancelled?'PASS':'FAIL');
  await sleep(500);
  const shieldStill = await evalJs(`(() => {
    const chars=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    const pal=chars.find(c=>c.name==='Human Paladin');
    return pal?.sounds?.some(s=>s.name==='Shield Bash');
  })()`);
  log('SOUND','D3: Shield Bash still exists after Cancel',shieldStill===true?'PASS':'FAIL');

  // Real delete
  const delHealBtn = await evalJs(`(() => {
    const c=[...document.querySelectorAll('[data-sound-card]')].find(c=>c.textContent.includes('Healing Light'));
    if(!c) return 'NO_CARD';
    const b=c.parentElement?.querySelector('button[title="Delete Sound"]');
    if(!b) return 'NO_BTN';
    b.click(); return 'OK';
  })()`);
  await sleep(500);
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
  await sleep(800);
  const healDeleted = await evalJs(`(() => {
    const chars=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    const pal=chars.find(c=>c.name==='Human Paladin');
    return pal?.sounds?.some(s=>s.name==='Healing Light');
  })()`);
  log('SOUND','D4: Healing Light deleted',healDeleted===false?'PASS':'FAIL');
  await toggleMobileEditMode(false);

  // ================================================================
  //  W / R / B / H / X: shared specs (Suite R the old sound-grid suite was
  //  folded into Suite U; the new Suite R is the shared scroll spec)
  // ================================================================
  // These run before Q (priming) and P (volume), each of which re-seeds, so a
  // reload between them is safe. H navigates to a group category through the
  // drawer and leaves the board there; X's self-contained seed+reload returns to
  // the default Human Paladin board afterwards.
  //
  // W leads deliberately: it asserts the app is at rest — no drawer open, the
  // rail rather than a sidebar — and every spec below seeds and reloads on it.
  await runSpecs(ctx, [platformGate]);
  // R seeds 60 sounds and reloads. 60 cards in a 2-column grid overflows a phone
  // by a wide margin, so the scroll assertions are as real here as on desktop.
  await runSpecs(ctx, [scroll]);
  await runSpecs(ctx, [sliders]);
  await runSpecs(ctx, [soundIntoGroup]);
  await runSpecs(ctx, [dragReorder]);

  // ================================================================
  //  Q: SOUND PRIMING (touch)
  // ================================================================
  // The desktop suite (e2e-full.mjs Suite Q, P17-P34) drives priming with
  // dispatchMouseEvent (right-click). Touch has no right-click: the ONLY gesture
  // is press-and-hold, and it travels a different path (touch -> pointer), so it
  // MUST be driven with Input.dispatchTouchEvent. This closes the checklist item
  // SOUND_PRIMING_SPEC.md §7 left open: "a real press-and-hold on a device".
  console.log(`\n[${LABEL}] === SUITE Q: SOUND PRIMING (touch) ===`);

  // Priming is one-shot and session-only, so re-seed to a known board. Same
  // fixture ids as e2e-full.mjs Suite Q, so a failure here can be compared
  // against the desktop run.
  const seedPrime = `(() => {
    const mk = (id,name,extra) => Object.assign({
      id, name, type:'Test', icon:'',
      files:[{name:'Longbow_4.mp3', displayName:'Longbow_4.mp3'}],
      color:'#ff0000', duration:5, fadeIn:0, fadeOut:0, loop:false, randomPlay:false, brightness:1
    }, extra||{});
    localStorage.setItem('ttrpg_characters', JSON.stringify([{
      id:'c1', name:'Human Paladin', sounds:[
        mk('p_fire','Fireball'), mk('p_frost','Frostbite'), mk('p_lay','Lay on Hands'), mk('p_cure','Cure Wounds'),
        mk('p27_a','Stop Test A',{ loop:true }), mk('p27_b','Stop Test B',{ loop:true }), mk('p27_c','Stop Test C',{ loop:true }),
        mk('p_broken','Broken Ref',{ files:[{name:'gone.mp3', displayName:'Gone.mp3', storedName:'nonexistent_zzz.mp3'}] })
      ]
    }]));
    localStorage.setItem('ttrpg_environment', JSON.stringify([
      { id:'e1', category:'Dungeon', sounds:[ mk('pe_trig','Echo Trigger'), mk('pe_prime','Dungeon Prime') ] },
      { id:'e2', category:'Forest', sounds:[] }
    ]));
    localStorage.setItem('ttrpg_groups', JSON.stringify([
      { id:'g1', name:'Tavern Pack', mode:'environment',
        categories:[{id:'gc1', category:'Ambience', sounds:[ mk('pg_trig','Hearth'), mk('pg_prime','Tavern Prime') ]}], characters:[] },
      { id:'g2', name:'Hero Pack', mode:'characters', categories:[],
        characters:[{id:'gch1', name:'Fighter', sounds:[ mk('pch_trig','Sword Draw'), mk('pch_prime','Battle Cry') ]}] }
    ]));
    localStorage.setItem('ttrpg_data_version', '3');
    for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k.startsWith('sound_file_')) localStorage.removeItem(k);}
    return 'seeded';
  })()`;

  // Same helper surface as e2e-full.mjs Suite Q, so the assertions read alike.
  // Re-injected after any reload (window state does not survive one).
  const primeHelpers = `(() => {
    window.__card = (id) => document.querySelector('[data-sound-card][data-sound-id="' + id + '"]');
    window.__cardCoords = (id) => {
      const c = window.__card(id);
      if (!c) return null;
      const r = c.getBoundingClientRect();
      const x = Math.round(r.left + r.width/2), y = Math.round(r.top + r.height/2);
      return { x, y, offscreen: (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) };
    };
    window.__primedIds = () => [...document.querySelectorAll('[data-sound-card][data-primed]')].map(c => c.dataset.soundId);
    window.__firedIds = () => [...document.querySelectorAll('[data-sound-card][data-fired]')].map(c => c.dataset.soundId);
    window.__audios = [];
    window.__origAudio = window.Audio;
    window.Audio = function(...a) { const el = new window.__origAudio(...a); window.__audios.push(el); return el; };
    window.Audio.prototype = window.__origAudio.prototype;
    window.__since = (n) => (window.__audios||[]).slice(n);
    window.__mark = () => (window.__audios||[]).length;
    window.__idsOf = (els) => els.map(e => e._soundId);
    window.__clearBtn = () => { const b = [...document.querySelectorAll('button')].find(x => (x.title||'').startsWith('Clear ')); return b ? b.title : 'NO_BTN'; };
    window.__playCard = (id) => { const c = window.__card(id); if (!c) return 'NO_CARD'; c.click(); return 'OK'; };
    return 'ok';
  })()`;

  await evalJs(seedPrime);
  await cdp('Page.reload', { ignoreCache: true });
  await waitForReload();
  await evalJs(primeHelpers);

  const clearPrimed = async () => {
    await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.title||'').startsWith('Clear ')); if(b) b.click(); return 'OK'; })()`);
    await sleep(250);
  };
  // Scroll a card to the viewport centre and return FRESH coords. Mobile shows a
  // 2-column grid, so a later card in the fixture can start off-screen; CDP input
  // is viewport-relative and would silently miss it.
  const centered = async (id) => {
    await evalJs(`(() => { const c=window.__card('${id}'); if(c) c.scrollIntoView({ block:'center' }); return 'OK'; })()`);
    await sleep(250);
    return evalJs(`window.__cardCoords('${id}')`);
  };

  // The real touch gestures. A hold is touchStart -> wait past PRIME_HOLD_MS
  // (500) -> touchEnd; a tap is a quick start/end that the browser turns into a
  // click (a trusted user gesture, so autoplay is allowed).
  const touchStart = (x,y) => cdp('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{ x, y, id:1, radiusX:2, radiusY:2, force:1 }] });
  const touchMovePt = (x,y) => cdp('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{ x, y, id:1, radiusX:2, radiusY:2, force:1 }] });
  const touchEnd = () => cdp('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  const hold = async (x,y,ms=900) => { await touchStart(x,y); await sleep(ms); await touchEnd(); };
  const tap  = async (x,y) => { await touchStart(x,y); await sleep(60); await touchEnd(); };

  // Q1: touch press-and-hold primes, and does NOT also play. The release after
  // the timer fires produces a click, which must be swallowed or a hold would
  // prime the card AND start the sound.
  const qFire = await centered('p_fire');
  log('PRIME','Q1-setup: card located', qFire && !qFire.offscreen ? 'PASS':'FAIL', JSON.stringify(qFire));
  const markQ1 = await evalJs(`window.__mark()`);
  await hold(qFire.x, qFire.y, 900);
  await sleep(500);
  const q1 = await evalJs(`(() => ({
    primed: window.__primedIds(),
    badge: !!document.querySelector('[data-prime-badge="p_fire"]'),
    overlay: !!document.querySelector('[data-prime-overlay="p_fire"]'),
    aria: window.__card('p_fire')?.getAttribute('aria-pressed'),
    played: window.__idsOf(window.__since(${markQ1}))
  }))()`);
  log('PRIME','Q1: touch press-and-hold primes (badge+overlay+aria)',JSON.stringify(q1?.primed)==='["p_fire"]' && q1?.badge && q1?.overlay && q1?.aria==='true'?'PASS':'FAIL',JSON.stringify(q1));
  log('PRIME','Q2: hold does NOT also play the sound',(q1?.played||[]).length===0?'PASS':'FAIL',JSON.stringify(q1?.played));

  // Q3: the primed card stays primed. On a real device a long press can raise a
  // contextmenu, which must not un-prime (toggling twice reads as "broken").
  await sleep(1500);
  const q3 = await evalJs(`({ primed: window.__primedIds(), badges: document.querySelectorAll('[data-prime-badge]').length })`);
  log('PRIME','Q3: primed state holds (no late un-prime)',JSON.stringify(q3?.primed)==='["p_fire"]' && q3?.badges===1?'PASS':'FAIL',JSON.stringify(q3));

  // Q4: a press that MOVES is a scroll, not a prime (40px >> the 10px cancel).
  await clearPrimed();
  const qCure = await centered('p_cure');
  await touchStart(qCure.x, qCure.y);
  await sleep(250);
  await touchMovePt(qCure.x + 40, qCure.y + 40);
  await sleep(900);
  await touchEnd();
  await sleep(300);
  const q4 = await evalJs(`window.__primedIds()`);
  log('PRIME','Q4: touch hold + 40px move does NOT prime',q4?.length===0?'PASS':'FAIL',JSON.stringify(q4));

  // Q5: edit mode primes by neither gesture (touch included).
  await toggleMobileEditMode(true);
  const qCure2 = await centered('p_cure');
  await hold(qCure2.x, qCure2.y, 900);
  await sleep(300);
  const q5 = await evalJs(`window.__primedIds()`);
  log('PRIME','Q5: edit mode does not prime (touch)',q5?.length===0?'PASS':'FAIL',JSON.stringify(q5));
  await toggleMobileEditMode(false);

  // Q6: THE feature. Two touch primes + a tap trigger = three sounds sharing one
  // _primeGroup token; the primed set is CONSUMED and the cards flash as fired.
  await clearPrimed();
  const qf6 = await centered('p_fire'); await hold(qf6.x, qf6.y, 900); await sleep(250);
  const qfr6 = await centered('p_frost'); await hold(qfr6.x, qfr6.y, 900); await sleep(250);
  const markQ6 = await evalJs(`window.__mark()`);
  const ql6 = await centered('p_lay');
  await tap(ql6.x, ql6.y);
  await sleep(1200);
  const q6 = await evalJs(`(() => {
    const els = window.__since(${markQ6});
    const ids = els.map(e => e._soundId);
    const groups = els.map(e => e._primeGroup);
    return {
      ids: ids.slice().sort(),
      sameGroup: groups.length===3 && groups[0] && groups.every(g => g === groups[0]),
      primedAfter: window.__primedIds(),
      fired: window.__firedIds()
    };
  })()`);
  log('PRIME','Q6: 2 touch primes + tap plays all 3',JSON.stringify(q6?.ids)==='["p_fire","p_frost","p_lay"]'?'PASS':'FAIL',JSON.stringify(q6));
  log('PRIME','Q6b: all 3 share one _primeGroup token',q6?.sameGroup?'PASS':'FAIL',JSON.stringify(q6?.sameGroup));
  log('PRIME','Q6c: primed set is CONSUMED after the trigger',q6?.primedAfter?.length===0?'PASS':'FAIL',JSON.stringify(q6?.primedAfter));
  log('PRIME','Q6d: consumed cards flash as fired',JSON.stringify(q6?.fired?.sort())==='["p_fire","p_frost"]'?'PASS':'FAIL',JSON.stringify(q6?.fired));

  // Q7: the stale-closure guard. Two triggers in the same tick must not each
  // replay the primed set (the capture-and-clear must be synchronous in a ref).
  await clearPrimed();
  const qf7 = await centered('p_fire'); await hold(qf7.x, qf7.y, 900); await sleep(200);
  const markQ7 = await evalJs(`window.__mark()`);
  await evalJs(`(() => { window.__playCard('p_lay'); window.__playCard('p_cure'); return 'OK'; })()`);
  await sleep(1000);
  const q7 = await evalJs(`(() => {
    const ids = window.__idsOf(window.__since(${markQ7}));
    const c = id => ids.filter(x => x === id).length;
    return { fire:c('p_fire'), lay:c('p_lay'), cure:c('p_cure'), total:ids.length };
  })()`);
  log('PRIME','Q7: rapid double trigger does not double the primes',q7?.fire===1 && q7?.lay===1 && q7?.cure===1 && q7?.total===3?'PASS':'FAIL',JSON.stringify(q7));

  // Q8: the clear-all affordance tracks the primed set.
  await clearPrimed();
  const q8before = await evalJs(`window.__clearBtn()`);
  const qf8 = await centered('p_fire'); await hold(qf8.x, qf8.y, 900); await sleep(250);
  const q8a = await evalJs(`({ btn: window.__clearBtn(), primed: window.__primedIds() })`);
  const qfr8 = await centered('p_frost'); await hold(qfr8.x, qfr8.y, 900); await sleep(250);
  const q8b = await evalJs(`window.__clearBtn()`);
  await clearPrimed();
  const q8c = await evalJs(`({ primed: window.__primedIds(), btn: window.__clearBtn() })`);
  log('PRIME','Q8a: no clear button while nothing is primed',q8before==='NO_BTN'?'PASS':'FAIL',q8before);
  log('PRIME','Q8b: button appears with the live count',/Clear 1 primed/.test(q8a?.btn||'') && /Clear 2 primed/.test(q8b||'')?'PASS':'FAIL',JSON.stringify({a:q8a?.btn,b:q8b}));
  log('PRIME','Q8c: clear empties the primed set and hides itself',q8c?.primed?.length===0 && q8c?.btn==='NO_BTN'?'PASS':'FAIL',JSON.stringify(q8c));

  // Q9: primed state is session-only. Nothing is persisted - the deliberate
  // absence of a localStorage key is asserted here too.
  const qf9 = await centered('p_fire'); await hold(qf9.x, qf9.y, 900); await sleep(250);
  const qKeys = await evalJs(`Object.keys(localStorage).filter(k => !k.startsWith('sound_file_')).sort()`);
  const knownPrimeKeys = ['backgroundSettings','boxSize','ttrpg_characters','ttrpg_characters_icon','ttrpg_data_version','ttrpg_environment','ttrpg_environment_icon','ttrpg_groups','ttrpg_themes','localStorageMigrationCompleted'];
  const qExtraKeys = (qKeys||[]).filter(k => !knownPrimeKeys.includes(k));
  log('PRIME','Q9: no new localStorage key for priming',qExtraKeys.length===0?'PASS':'FAIL',JSON.stringify(qExtraKeys));

  await cdp('Page.reload', { ignoreCache: true });
  await waitForReload();
  await evalJs(primeHelpers);
  const q10 = await evalJs(`({ primed: window.__primedIds(), badges: document.querySelectorAll('[data-prime-badge]').length, btn: window.__clearBtn() })`);
  log('PRIME','Q10: primed state does NOT survive a reload',q10?.primed?.length===0 && q10?.badges===0 && q10?.btn==='NO_BTN'?'PASS':'FAIL',JSON.stringify(q10));

  // Q11: stopping the primary stops the WHOLE primed group. Uses the looping
  // fixture (the shared clip is under a second and would unregister via 'ended').
  await clearPrimed();
  const a11 = await centered('p27_a'); await hold(a11.x, a11.y, 900); await sleep(200);
  const b11 = await centered('p27_b'); await hold(b11.x, b11.y, 900); await sleep(200);
  const markQ11 = await evalJs(`window.__mark()`);
  const c11 = await centered('p27_c');
  await tap(c11.x, c11.y); await sleep(700);
  const stopRes11 = await evalJs(`(() => {
    const c = window.__card('p27_c');
    const b = c && c.querySelector('button[title="Stop Sound"]');
    if (!b) return 'NO_STOP_BTN';
    b.click(); return 'OK';
  })()`);
  await sleep(400);
  const q11 = await evalJs(`(() => {
    const els = window.__since(${markQ11});
    return { n: els.length, stopped: els.filter(e => e.stopped === true).length };
  })()`);
  log('PRIME','Q11: stopping the primary stops the WHOLE primed group',stopRes11==='OK' && q11?.n===3 && q11?.stopped===3?'PASS':'FAIL',JSON.stringify({stop:stopRes11,n:q11?.n,stopped:q11?.stopped}));

  // Q12-Q14: the container-shape walker. soundById is built from
  // allSoundContainers(), so a touch prime must resolve from every shape. Mobile
  // navigates with the drawer, not tabs. Best-effort step clicks; a missing card
  // reports what the drawer actually offered.
  const drawerPick = async (text) => evalJs(`(() => {
    const want = ${JSON.stringify(text)};
    const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
    if (!d) return 'NO_DRAWER';
    const all = [...d.querySelectorAll('button')];
    const b = all.find(x => x.textContent.trim() === want)
           || all.find(x => x.textContent.trim().endsWith(want))
           || all.find(x => x.title === want);
    if (!b) return 'NO_ITEM:' + want;
    b.click(); return 'OK';
  })()`);
  const drawerList = () => evalJs(`(() => {
    const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
    if (!d) return 'NO_DRAWER';
    return JSON.stringify([...d.querySelectorAll('button')].map(x => x.title || x.textContent.trim()).filter(t => t && t.length < 24).slice(0, 30));
  })()`);

  const primeAndFire = async (label, steps, primeId, trigId) => {
    await clearPrimed();
    await openDrawer();
    const opened = await evalJs(`!!document.querySelector('[role="dialog"][aria-label="Navigation"]')`);
    const picks = [];
    for (const s of steps) { picks.push(s + '=' + await drawerPick(s)); await sleep(450); }
    const drawerNow = await drawerList();
    const heading = await evalJs(`document.querySelector('h2')?.textContent?.trim() || ''`);
    await closeDrawer();
    await sleep(450);
    const has = await evalJs(`!!window.__card('${primeId}')`);
    if (!has) { log('PRIME', label, 'FAIL', `card ${primeId} not rendered; opened=${opened}; picks=${JSON.stringify(picks)}; heading=${JSON.stringify(heading)}; drawer=${drawerNow}`); return; }
    const c = await centered(primeId);
    await hold(c.x, c.y, 900); await sleep(250);
    const primed = await evalJs(`window.__primedIds()`);
    if (JSON.stringify(primed) !== JSON.stringify([primeId])) { log('PRIME', label, 'FAIL', `primed=${JSON.stringify(primed)}`); return; }
    const mark = await evalJs(`window.__mark()`);
    const t = await centered(trigId);
    await tap(t.x, t.y); await sleep(1000);
    const ids = await evalJs(`window.__idsOf(window.__since(${mark}))`);
    const ok = (ids||[]).includes(trigId) && (ids||[]).includes(primeId);
    await clearPrimed();
    log('PRIME', label, ok ? 'PASS' : 'FAIL', ok ? 'ok' : `fired=${JSON.stringify(ids)}`);
  };

  await primeAndFire('Q12: primes + fires from an environment category', ['Environment','Dungeon'], 'pe_prime', 'pe_trig');
  await primeAndFire('Q13: primes + fires from a group category', ['Tavern Pack','Ambience'], 'pg_prime', 'pg_trig');
  await primeAndFire('Q14: primes + fires from a group character', ['Hero Pack','Fighter'], 'pch_prime', 'pch_trig');

  // ================================================================
  //  P: PER-SOUND VOLUME (shared spec - see e2e/specs/volume.mjs)
  // ================================================================
  // The assertions transfer verbatim from the desktop suite. The only platform
  // difference is P9's "trusted gesture" tap, which the shared spec routes through
  // the driver (desktop mouse event here, Input.dispatchTouchEvent on Android).
  await runSpecs(ctx, [volume]);
  // ================================================================
  //  M: MOVE / COPY SOUND
  // ================================================================
  // Port of e2e-full.mjs Suite M (M1-M22). The picker is platform-independent DOM
  // (a fixed overlay with section headers and row buttons), so the checks transfer
  // verbatim. One navigation difference: the desktop suite switches the active
  // character with a sidebar button to reach a sound it just moved; the mobile
  // board is drawer-driven, so this seed keeps every SOURCE on the initially
  // visible Human Paladin board and moves them OUT - exercising the same
  // character -> character / group-category / group-character / environment
  // transfers without any drawer round-trip.
  console.log(`\n[${LABEL}] === SUITE M: MOVE / COPY SOUND ===`);

  const seedMove = `(() => {
    const mk = (id,name,opts) => Object.assign({
      id, name, type:'Test', icon:'', file:'',
      files:[{name:'Longbow_4.mp3', displayName:'Longbow_4.mp3'}],
      color:'#ff0000', duration:0, randomPlay:false
    }, opts||{});
    localStorage.setItem('ttrpg_characters', JSON.stringify([
      { id:'c1', name:'Human Paladin', sounds:[
        mk('src_a','Alpha'), mk('src_b','Bravo',{ randomPlay:true, color:'#3b82f6' }),
        mk('src_c','Charlie'), mk('src_d','Delta'), mk('src_e','Echo')
      ]},
      { id:'c2', name:'Elf Sorcerer', sounds:[] }
    ]));
    localStorage.setItem('ttrpg_environment', JSON.stringify([
      { id:'e1', category:'Dungeon', sounds:[ mk('dun_a','Dungeon Drop') ] },
      { id:'e2', category:'Forest', sounds:[] }
    ]));
    localStorage.setItem('ttrpg_groups', JSON.stringify([
      { id:'g1', name:'Tavern Pack', mode:'environment',
        categories:[{id:'gc1', category:'Ambience', sounds:[ mk('tav_a','Tavern Tune') ]}], characters:[] },
      { id:'g2', name:'Hero Pack', mode:'characters', categories:[],
        characters:[{id:'gch1', name:'Fighter', sounds:[]}] }
    ]));
    localStorage.setItem('ttrpg_themes', JSON.stringify([]));
    localStorage.setItem('ttrpg_data_version', '3');
    for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k.startsWith('sound_file_')) localStorage.removeItem(k);}
    return 'seeded';
  })()`;

  // The picker helpers read localStorage directly (names/settings are the proof),
  // matching e2e-full.mjs so a failure here is comparable to the desktop run.
  const mcHelpers = `(() => {
    window.__mcOpen = (cardName) => {
      const c=[...document.querySelectorAll('[data-sound-card]')].find(c=>c.textContent.includes(cardName));
      if(!c) return 'NO_CARD';
      const b=c.parentElement?.querySelector('button[title="Move or Copy Sound"]');
      if(!b) return 'NO_BTN';
      b.click(); return 'OK';
    };
    window.__mcSections = () => [...document.querySelectorAll('p')]
      .filter(p => (p.className||'').includes('uppercase') && (p.className||'').includes('font-semibold'))
      .map(p => p.textContent.trim());
    window.__mcRow = (section, name) => {
      const secs=[...document.querySelectorAll('p')].filter(p => (p.className||'').includes('uppercase') && (p.className||'').includes('font-semibold'));
      const sec=secs.find(p => p.textContent.trim()===section);
      if(!sec) return null;
      const rows=[...(sec.parentElement?.children||[])].filter(el => el.tagName==='DIV');
      return rows.find(r => { const span=r.querySelector('span'); return span && span.firstChild && span.firstChild.textContent.trim()===name; }) || null;
    };
    window.__mcTitles = (section, name) => {
      const row=window.__mcRow(section,name);
      if(!row) return null;
      return [...row.querySelectorAll('button')].map(b=>b.getAttribute('title'));
    };
    window.__mcClick = (section, name, verb) => {
      const row=window.__mcRow(section,name);
      if(!row) return 'NO_ROW';
      const b=row.querySelector('button[title="'+verb+' to '+name+'"]');
      if(!b) return 'NO_BTN';
      b.click(); return 'OK';
    };
    window.__mcModalOpen = () => {
      const m=[...document.querySelectorAll('h2')].find(h=>h.textContent.trim()==='Move or Copy');
      return !!m && !!m.closest('div[class*="fixed"]');
    };
    window.__soundsIn = (key, matchName) => {
      const list=JSON.parse(localStorage.getItem(key)||'[]');
      const out=[];
      const walkChar=(c)=>out.push(...(c.sounds||[]).map(s=>({container:c.name||c.category, sound:s})));
      const walkGroup=(g)=>{
        (g.categories||[]).forEach(cat=>out.push(...(cat.sounds||[]).map(s=>({container:g.name+' / '+cat.category, sound:s}))));
        (g.characters||[]).forEach(ch=>out.push(...(ch.sounds||[]).map(s=>({container:g.name+' / '+ch.name, sound:s}))));
      };
      if(key==='ttrpg_characters') list.forEach(walkChar);
      else if(key==='ttrpg_environment') list.forEach(walkChar);
      else list.forEach(walkGroup);
      return out.filter(e => e.sound.name === matchName);
    };
    window.__countFileKeys = () => { let n=0; for(let i=0;i<localStorage.length;i++){ if((localStorage.key(i)||'').startsWith('sound_file_')) n++; } return n; };
    return 'ok';
  })()`;

  await evalJs(seedMove);
  await cdp('Page.reload', { ignoreCache: true });
  await waitForReload();
  await evalJs(mcHelpers);
  await toggleMobileEditMode(true);

  // M1: the button exists on every card, only in edit mode.
  const mBtn = await evalJs(`(() => {
    const cards=[...document.querySelectorAll('[data-sound-card]')];
    const withBtn=cards.filter(c=>!!c.parentElement?.querySelector('button[title="Move or Copy Sound"]'));
    return {cards:cards.length, withBtn:withBtn.length};
  })()`);
  log('MOVE','M1: Move/Copy button on all cards in edit mode',mBtn?.cards>0&&mBtn?.withBtn===mBtn?.cards?'PASS':'FAIL',mBtn?.withBtn+'/'+mBtn?.cards);

  // M2: picker opens from a card.
  const mOpen = await evalJs(`window.__mcOpen('Alpha')`);
  await sleep(500);
  const mPickerOpen = await evalJs(`window.__mcModalOpen()`);
  log('MOVE','M2: card button opens picker',mOpen==='OK'&&mPickerOpen===true?'PASS':'FAIL','open='+mOpen+' modal='+mPickerOpen);

  // M3: sections present, in sidebar order.
  const mSections = await evalJs(`window.__mcSections()`);
  log('MOVE','M3: sections Characters/groups/Environments',Array.isArray(mSections)&&mSections[0]==='Characters'&&mSections.includes('Tavern Pack')&&mSections.includes('Hero Pack')&&mSections[mSections.length-1]==='Environments'?'PASS':'FAIL',JSON.stringify(mSections));

  // M4: current container offers Copy but not Move.
  const mSelfTitles = await evalJs(`window.__mcTitles('Characters','Human Paladin')`);
  log('MOVE','M4: current container has Copy, no Move',Array.isArray(mSelfTitles)&&!mSelfTitles.includes('Move to Human Paladin')&&mSelfTitles.includes('Copy to Human Paladin')?'PASS':'FAIL',JSON.stringify(mSelfTitles));

  // M5: another container offers both, with distinct stable titles.
  const mOtherTitles = await evalJs(`window.__mcTitles('Characters','Elf Sorcerer')`);
  log('MOVE','M5: target row has Move + Copy titles',Array.isArray(mOtherTitles)&&mOtherTitles.includes('Move to Elf Sorcerer')&&mOtherTitles.includes('Copy to Elf Sorcerer')?'PASS':'FAIL',JSON.stringify(mOtherTitles));

  // M6-M10: COPY character -> character (picker from M2 is still open).
  const beforeCopy = await evalJs(`(() => {
    const l=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    return { paladin:l.find(c=>c.name==='Human Paladin')?.sounds?.length, elf:l.find(c=>c.name==='Elf Sorcerer')?.sounds?.length, soundFileKeys: window.__countFileKeys() };
  })()`);
  const mCopy = await evalJs(`window.__mcClick('Characters','Elf Sorcerer','Copy')`);
  await sleep(700);
  const afterCopy = await evalJs(`(() => {
    const l=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    const src=window.__soundsIn('ttrpg_characters','Alpha');
    const paladin=l.find(c=>c.name==='Human Paladin');
    const elf=l.find(c=>c.name==='Elf Sorcerer');
    const copy=elf?.sounds?.find(s=>s.name==='Alpha (copy)');
    return {
      paladin:paladin?.sounds?.length, elf:elf?.sounds?.length,
      srcStillThere:paladin?.sounds?.some(s=>s.name==='Alpha'),
      copyFound:!!copy,
      idsDiffer: !!copy && !!src[0] && src[0].sound.id !== copy.id,
      sharedFile: !!copy && !!src[0] && JSON.stringify(copy.files)===JSON.stringify(src[0].sound.files),
      legacyKept: copy ? ('file' in copy) : false,
      fileKeys: window.__countFileKeys()
    };
  })()`);
  log('MOVE','M6: copy adds to target, source untouched',mCopy==='OK'&&afterCopy?.paladin===beforeCopy?.paladin&&afterCopy?.elf===beforeCopy?.elf+1&&afterCopy?.srcStillThere===true?'PASS':'FAIL',JSON.stringify({before:beforeCopy,after:afterCopy}));
  log('MOVE','M7: copy id differs from source',afterCopy?.copyFound&&afterCopy?.idsDiffer?'PASS':'FAIL','copyFound='+afterCopy?.copyFound);
  log('MOVE','M8: copy shares files[] verbatim',afterCopy?.sharedFile?'PASS':'FAIL','');
  log('MOVE','M9: copy keeps legacy file field',afterCopy?.legacyKept?'PASS':'FAIL','');
  log('MOVE','M10: copy wrote no new sound_file_* key',afterCopy?.fileKeys===beforeCopy?.soundFileKeys?'PASS':'FAIL','before='+beforeCopy?.soundFileKeys+' after='+afterCopy?.fileKeys);

  // M11: second copy auto-suffixes "(copy 2)", scoped to the destination.
  await evalJs(`window.__mcOpen('Alpha')`);
  await sleep(400);
  const mCopy2 = await evalJs(`window.__mcClick('Characters','Elf Sorcerer','Copy')`);
  await sleep(700);
  const names2 = await evalJs(`(() => { const l=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]'); return l.find(c=>c.name==='Elf Sorcerer')?.sounds?.map(s=>s.name); })()`);
  log('MOVE','M11: second copy is "Alpha (copy 2)"',mCopy2==='OK'&&Array.isArray(names2)&&names2.includes('Alpha (copy 2)')?'PASS':'FAIL',JSON.stringify(names2));

  // M12: same name in a DIFFERENT container is not suffixed globally.
  await evalJs(`window.__mcOpen('Alpha')`);
  await sleep(400);
  const mCopyDungeon = await evalJs(`window.__mcClick('Environments','Dungeon','Copy')`);
  await sleep(700);
  const dungeonNames = await evalJs(`(() => { const l=JSON.parse(localStorage.getItem('ttrpg_environment')||'[]'); return l.find(c=>c.category==='Dungeon')?.sounds?.map(s=>s.name); })()`);
  log('MOVE','M12: copy elsewhere is "(copy)", not "(copy 3)"',mCopyDungeon==='OK'&&Array.isArray(dungeonNames)&&dungeonNames.includes('Alpha (copy)')?'PASS':'FAIL',JSON.stringify(dungeonNames));

  // M13-M15: MOVE within the same slice preserves everything and is silent.
  const beforeMove = await evalJs(`(() => {
    const l=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    const s=l.find(c=>c.name==='Human Paladin')?.sounds?.find(x=>x.name==='Bravo');
    window.__moveId=s?.id; window.__moveColor=s?.color; window.__moveFiles=JSON.stringify(s?.files);
    return { paladin:l.find(c=>c.name==='Human Paladin')?.sounds?.length, elf:l.find(c=>c.name==='Elf Sorcerer')?.sounds?.length, sound:s };
  })()`);
  await evalJs(`window.__mcOpen('Bravo')`);
  await sleep(400);
  const mMove = await evalJs(`window.__mcClick('Characters','Elf Sorcerer','Move')`);
  await sleep(800);
  const afterMove = await evalJs(`(() => {
    const l=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    const paladin=l.find(c=>c.name==='Human Paladin');
    const elf=l.find(c=>c.name==='Elf Sorcerer');
    const moved=elf?.sounds?.find(s=>s.name==='Bravo');
    return {
      paladin:paladin?.sounds?.length, elf:elf?.sounds?.length,
      goneFromSource:!paladin?.sounds?.some(s=>s.name==='Bravo'),
      sameId: !!moved && moved.id === window.__moveId,
      settingsKept: !!moved && moved.color===window.__moveColor && moved.randomPlay===true && JSON.stringify(moved.files)===window.__moveFiles,
      anyDialog: !!document.querySelector('h2')?.textContent?.includes('Confirm Delete'),
      pickerClosed: !window.__mcModalOpen()
    };
  })()`);
  log('MOVE','M13: move relocates within slice',mMove==='OK'&&afterMove?.paladin===beforeMove?.paladin-1&&afterMove?.elf===beforeMove?.elf+1&&afterMove?.goneFromSource?'PASS':'FAIL',JSON.stringify({before:{p:beforeMove?.paladin,e:beforeMove?.elf},after:{p:afterMove?.paladin,e:afterMove?.elf}}));
  log('MOVE','M14: move preserves id + settings + files',afterMove?.settingsKept?'PASS':'FAIL','');
  log('MOVE','M15: move opens no dialog, picker closed',afterMove?.pickerClosed&&afterMove?.anyDialog===false?'PASS':'FAIL','pickerClosed='+afterMove?.pickerClosed);

  // M16: cross-slice move from a character into a group category.
  await evalJs(`window.__mcOpen('Charlie')`);
  await sleep(400);
  const mMoveGroup = await evalJs(`window.__mcClick('Tavern Pack','Ambience','Move')`);
  await sleep(800);
  const groupMoved = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]');
    const c=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    return {
      stillInChar:!!c.find(x=>x.name==='Human Paladin')?.sounds?.some(s=>s.name==='Charlie'),
      landedInGroup:!!g.find(x=>x.name==='Tavern Pack')?.categories?.find(cat=>cat.category==='Ambience')?.sounds?.some(s=>s.name==='Charlie')
    };
  })()`);
  log('MOVE','M16: move from character into group category',mMoveGroup==='OK'&&groupMoved?.stillInChar===false&&groupMoved?.landedInGroup===true?'PASS':'FAIL',JSON.stringify(groupMoved));

  // M17: cross-slice move from a character into an environment category.
  await evalJs(`window.__mcOpen('Delta')`);
  await sleep(400);
  const mMoveEnv = await evalJs(`window.__mcClick('Environments','Dungeon','Move')`);
  await sleep(800);
  const envMoved = await evalJs(`(() => {
    const e=JSON.parse(localStorage.getItem('ttrpg_environment')||'[]');
    const c=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    return {
      stillInChar:!!c.find(x=>x.name==='Human Paladin')?.sounds?.some(s=>s.name==='Delta'),
      landedInEnv:!!e.find(x=>x.category==='Dungeon')?.sounds?.some(s=>s.name==='Delta')
    };
  })()`);
  log('MOVE','M17: move from character into environment category',mMoveEnv==='OK'&&envMoved?.stillInChar===false&&envMoved?.landedInEnv===true?'PASS':'FAIL','click='+mMoveEnv+' env='+JSON.stringify(envMoved));

  // M18: move into a group character (cross-slice).
  await evalJs(`window.__mcOpen('Echo')`);
  await sleep(400);
  const mMoveGroupChar = await evalJs(`window.__mcClick('Hero Pack','Fighter','Move')`);
  await sleep(800);
  const groupCharMoved = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]');
    const c=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    return {
      stillInChar:!!c.find(x=>x.name==='Human Paladin')?.sounds?.some(s=>s.name==='Echo'),
      landedInGroupChar:!!g.find(x=>x.name==='Hero Pack')?.characters?.find(ch=>ch.name==='Fighter')?.sounds?.some(s=>s.name==='Echo')
    };
  })()`);
  log('MOVE','M18: move into a group character (cross-slice)',mMoveGroupChar==='OK'&&groupCharMoved?.stillInChar===false&&groupCharMoved?.landedInGroupChar===true?'PASS':'FAIL',JSON.stringify(groupCharMoved));

  // M19: an empty destination is still offered and accepts a copy.
  await evalJs(`window.__mcOpen('Alpha')`);
  await sleep(400);
  const forestRow = await evalJs(`window.__mcTitles('Environments','Forest')`);
  const mCopyForest = await evalJs(`window.__mcClick('Environments','Forest','Copy')`);
  await sleep(700);
  const forestHas = await evalJs(`(() => { const l=JSON.parse(localStorage.getItem('ttrpg_environment')||'[]'); return l.find(c=>c.category==='Forest')?.sounds?.map(s=>s.name); })()`);
  log('MOVE','M19: empty destination listed and accepts copy',Array.isArray(forestRow)&&forestRow.includes('Copy to Forest')&&Array.isArray(forestHas)&&forestHas.length===1?'PASS':'FAIL',JSON.stringify({row:forestRow,sounds:forestHas}));

  // M20: Esc closes the picker (capture phase, so it does not also close the drawer).
  await evalJs(`window.__mcOpen('Alpha')`);
  await sleep(400);
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await sleep(400);
  const escClosed = await evalJs(`!window.__mcModalOpen()`);
  log('MOVE','M20: Esc closes picker',escClosed===true?'PASS':'FAIL','');

  // M21: data version untouched, no *_old keys (no data reset).
  const ver = await evalJs(`(() => { let old=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i)||''; if(k.endsWith('_old')) old.push(k); } return { v:localStorage.getItem('ttrpg_data_version'), old }; })()`);
  log('MOVE','M21: DATA_VERSION still 3, no *_old keys',ver?.v==='3'&&ver?.old?.length===0?'PASS':'FAIL',JSON.stringify(ver));

  // M22: button absent outside edit mode.
  await toggleMobileEditMode(false);
  await sleep(400);
  const noEditBtns = await evalJs(`document.querySelectorAll('button[title="Move or Copy Sound"]').length`);
  log('MOVE','M22: button hidden outside edit mode',noEditBtns===0?'PASS':'FAIL','count='+noEditBtns);

  // ================================================================
  //  Z: LIVE PLAYBACK (shared spec - see e2e/specs/playback.mjs)
  // ================================================================
  // Port of the live-playback suite that used to live only in e2e-features.mjs.
  // Z1's trigger is a real Input.dispatchTouchEvent tap through driver.trustedTap
  // — a synthetic click is not a user gesture, so autoplay is refused and play()
  // rejects, which would leave every later assertion reading a dead element.
  // Last of the shared specs so the fade sampling is not competing with other
  // suites; refcount re-seeds after it.
  await runSpecs(ctx, [playback]);

  // ================================================================
  //  G: FILE REFCOUNT GUARD (shared spec - see e2e/specs/refcount.mjs)
  // ================================================================
  // Standalone and last: re-seeds a known storedName, copies the sound, deletes
  // the source container and asserts the file key survives. G5 is the negative
  // localStorage case, which is not applicable under Tauri and logs a WARN -
  // Android reports 1 WARN / exit 1 exactly like the Windows phase.
  await runSpecs(ctx, [refcount]);

  // ================================================================
  //  Summary + Restore
  // ================================================================
  if (SAVE_RESTORE && capturedLS) {
    const rr = await evalJs(restoreLs(capturedLS));
    console.log(`[${LABEL}] localStorage restore:`, rr);
    await cdp('Page.reload', { ignoreCache: true });
    await sleep(3000);
  }

  console.log('\n==============================');
  report.summary();
  console.log('==============================');

  close();
  process.exit(report.exitCode());
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
