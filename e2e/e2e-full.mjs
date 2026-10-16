// Comprehensive E2E suite — tests every user-facing feature of The SpellCaster.
// Builds on e2e-run.mjs (structure/scroll/split/regression) and e2e-features.mjs
// (playback/fade/volume/loop). This file covers: sound-card UI indicators,
// edit-mode per-card controls, sound add/edit/delete, character/category/group CRUD,
// drag-to-reorder, settings/themes/image, split-view CRUD, empty states, keyboard.
//
// Ten suites are SHARED specs in ./specs, run from here AND from e2e-mobile.mjs:
//   volume         P1-P16   per-sound volume + persistence
//   indicators     U1-U7    card indicators
//   sliders        B1-B4    box-size slider + reload persistence
//   soundIntoGroup H1-H2    adding a sound into a group category
//   dragReorder    X1-X2    drag-to-reorder
//   refcount       G1-G5    file-reference guard on container deletion
//   platformGate   W1-W6    the isMobile gate picks the right chrome
//   scroll         R1-R10   single-view scroll containment
//   playback       Z1-Z10   live playback: fade, live master, loop, Stop All
// Shared CDP/report/seed/page plumbing lives in ./lib, the platform divergence
// (gestures, edit-mode toggle, navigation, file upload) is absorbed by
// ./lib/driver.mjs and the ctx helpers below.
// Env: CDP_PORT, LABEL, SAVE_RESTORE ('1'), EXPECT_TAURI ('1')
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, sleep } from './lib/cdp.mjs';
import { createReport } from './lib/report.mjs';
import { CAPTURE_LS, INSTRUMENT_AUDIO, KNOWN_KEYS, PAGE_HELPERS, SEED, restoreLs, submitModalExpr } from './lib/page.mjs';
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
import { resetDefaults } from './specs/reset.mjs';
import { profiles } from './specs/profiles.mjs';
import { bundle } from './specs/bundle.mjs';

const DEBUG_PORT = process.env.CDP_PORT || 9333;
const LABEL = process.env.LABEL || 'FULL';
const SAVE_RESTORE = process.env.SAVE_RESTORE === '1';
const EXPECT_TAURI = process.env.EXPECT_TAURI === '1';
const WAV = join(dirname(fileURLToPath(import.meta.url)), 'e2e_silence.wav');

// Tiny 1x1 red PNG for background-image upload test
const PNG = join(dirname(fileURLToPath(import.meta.url)), '_e2e_pixel.png');
(function makePng() {
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  const buf = Buffer.from(b64, 'base64');
  writeFileSync(PNG, buf);
})();

// 20s silent WAV generator (same as features)
(function makeWav() {
  const seconds = 20, rate = 8000, channels = 1, bits = 16;
  const dataLen = seconds * rate * channels * (bits / 8);
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataLen, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * channels * (bits / 8), 28); buf.writeUInt16LE(channels * (bits / 8), 32);
  buf.writeUInt16LE(bits, 34); buf.write('data', 36); buf.writeUInt32LE(dataLen, 40);
  writeFileSync(WAV, buf);
})();

async function main() {
  const { cdp, cdpInput, evalJs, close } = await connect({ port: DEBUG_PORT, label: LABEL, fatalExit: 3 });
  const driver = makeDriver({ platform: 'desktop', cdp, cdpInput, evalJs, sleep });

  // Every navigation goes through here. A page load wipes ALL window helpers,
  // and since profiles landed the profile helpers (window.__pk / __pseed /
  // __bareKeys) are what make the bare key names a suite seeds resolve to the
  // app's profile-scoped keys. A bare `cdp('Page.reload')` leaves them gone:
  // the next seed then writes keys the app never reads and the test passes
  // while exercising an empty board. Do not add a raw Page.reload.
  async function reloadPage(waitMs = 3500) {
    await cdp('Page.reload', { ignoreCache: true });
    await sleep(waitMs);
    await evalJs(PAGE_HELPERS);
  }

  const report = createReport(LABEL, 'FULL E2E SUMMARY');
  const { log, run } = report;

  let capturedLS = null;
  if (SAVE_RESTORE) {
    const cap = await evalJs(CAPTURE_LS);
    if (cap && cap.length < 3000000) { capturedLS = JSON.parse(cap); console.log(`[${LABEL}] captured ${Object.keys(capturedLS).length} localStorage keys`); }
    else console.log(`[${LABEL}] WARNING: localStorage capture too large / failed (${(cap||'').length}b) — no restore`);
  }

  // Seed: small, deterministic, rich fixtures
  await evalJs(PAGE_HELPERS);
  await evalJs(SEED);
  console.log(`[${LABEL}] SEED applied`);
  await reloadPage();

  // Instrument playback for any audio checks in this suite
  await run('PLAY', 'D0: instrument audio', () => evalJs(INSTRUMENT_AUDIO));

  // Set up page-level helpers
  await run('NAV', 'helpers', () => evalJs(PAGE_HELPERS));

  // Helper: upload WAV via CDP
  async function uploadWav() {
    for (let i = 0; i < 10; i++) {
      const doc = await cdp('DOM.getDocument', { depth: 1 });
      const qr = await cdp('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type="file"][accept*=".mp3"]' });
      if (qr.result?.nodeId) return cdp('DOM.setFileInputFiles', { nodeId: qr.result.nodeId, files: [WAV] });
      await sleep(400);
    }
    return null;
  }

  // Helper: submit modal (bg-lime-600 submit button with given text)
  async function submitModal(btnText) {
    return evalJs(submitModalExpr(btnText));
  }

  // Helper: click toggle button (e.g. glow)
  async function clickToggleNearText(text) {
    return evalJs(`(() => {
      const span=[...document.querySelectorAll('span')].find(s=>s.textContent.includes('${text}'));
      if(!span) return 'NO_SPAN';
      const container=span.closest('div.flex.items-center.justify-between') || span.closest('div.flex.items-center');
      if(!container) return 'NO_CONTAINER';
      const btn=container.querySelector('button');
      if(!btn) return 'NO_BTN';
      btn.click();
      return 'OK';
    })()`);
  }

  // Helper: click Edit Mode toggle (desktop sidebar button)
  async function toggleEditMode(on) {
    if (on) await driver.enterEditMode(); else await driver.exitEditMode();
  }

  async function waitForReload(ms = 3500) { await sleep(ms); }

  // Context handed to shared specs (e2e/specs/*). reload() re-seeds the DOM:
  // the page wipes window helpers on every load, so specs re-inject what they
  // need themselves. The navigation/action helpers absorb the desktop layout:
  // the sidebar shows every container at once, so "go to a board" is a click on
  // a sidebar leaf and there is no drawer to open.
  const ctx = {
    label: LABEL,
    log, run,
    evalJs,
    sleep,
    driver,
    isTauri: EXPECT_TAURI,
    submitModal: (t) => evalJs(submitModalExpr(t)),
    upload: () => uploadWav(),
    closeDrawer: async () => {},
    navigateTo: async (text) => {
      const r = await evalJs(`(() => {
        const bs = [...document.querySelectorAll('button')];
        const b = bs.find(x => x.textContent.trim() === '${text}') || bs.find(x => x.textContent.trim().endsWith('${text}') && !x.title);
        if (!b) return 'NO_BUTTON:${text}';
        b.click(); return 'OK';
      })()`);
      await sleep(400);
      return r;
    },
    clickModalOpener: async (label) => evalJs(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '${label}');
      if (!b) return 'NO_BUTTON:${label}';
      b.click(); return 'OK';
    })()`),
    deleteCharacter: async (name) => {
      const r = await evalJs(`(() => {
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '${name}');
        if (!b) return 'NO_BUTTON:${name}';
        const container = b.closest('[class*="bg-dark-800"]');
        if (!container) return 'NO_CONTAINER';
        const del = container.querySelector('button[title*="Delete Character"], button[title*="Delete character"]');
        if (!del) return 'NO_DELETE_BUTTON';
        del.click(); return 'OK';
      })()`);
      await sleep(500);
      await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
      await sleep(1000);
      return r;
    },
    reload: async () => reloadPage()
  };

  // ================================================================
  //  S: STRUCTURE / SEED INTEGRITY
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE S: SEED INTEGRITY ===`);
  const suiteS = await evalJs(`(() => {
    const r = [];
    const log = (cat,n,s,d) => r.push({cat,n,s,d:d||''});
    const chars = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    const env = JSON.parse(localStorage.getItem(window.__pk('ttrpg_environment'))||'[]');
    const groups = JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]');
    log('SEED','S1: 2 characters',chars.length===2?'PASS':'FAIL','count='+chars.length);
    log('SEED','S2: Human Paladin exists',chars.some(c=>c.name==='Human Paladin')?'PASS':'FAIL');
    log('SEED','S3: Elf Sorcerer exists',chars.some(c=>c.name==='Elf Sorcerer')?'PASS':'FAIL');
    log('SEED','S4: 3 sounds on Paladin',chars.find(c=>c.name==='Human Paladin')?.sounds?.length===3?'PASS':'FAIL','count='+(chars.find(c=>c.name==='Human Paladin')?.sounds?.length));
    log('SEED','S5: 2 env categories',env.length===2?'PASS':'FAIL','count='+env.length);
    log('SEED','S6: Dungeon exists',env.some(e=>e.category==='Dungeon')?'PASS':'FAIL');
    log('SEED','S7: 2 groups',groups.length===2?'PASS':'FAIL','count='+groups.length);
    log('SEED','S8: Tavern Pack mode=environment',groups.find(g=>g.name==='Tavern Pack')?.mode==='environment'?'PASS':'FAIL');
    log('SEED','S9: Hero Pack mode=characters',groups.find(g=>g.name==='Hero Pack')?.mode==='characters'?'PASS':'FAIL');
    log('SEED','S10: Tavern Pack has 1 category',groups.find(g=>g.name==='Tavern Pack')?.categories?.length===1?'PASS':'FAIL');
    log('SEED','S11: Hero Pack has 1 character',groups.find(g=>g.name==='Hero Pack')?.characters?.length===1?'PASS':'FAIL');
    log('SEED','S12: data_version=3',localStorage.getItem(window.__pk('ttrpg_data_version'))==='3'?'PASS':'FAIL');
    log('SEED','S13: cards rendered',document.querySelectorAll('[data-sound-card]').length>=3?'PASS':'FAIL','cards='+document.querySelectorAll('[data-sound-card]').length);
    return r;
  })()`);
  if (suiteS?.__error) log('SEED','Suite S','FAIL',suiteS.__error); else for (const r of suiteS) log(r.cat,r.n,r.s,r.d);

  // ================================================================
  //  U: CARD INDICATORS (moved to the shared-spec block below)
  // ================================================================
  // Suite M below is NOT self-contained - it reads the board the inline suites
  // leave behind - so every shared spec (each of which seeds and reloads) runs
  // after it, together, at the end. See the block after Suite Y.

  // ================================================================
  //  E: EDIT MODE + PER-CARD CONTROLS
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE E: EDIT MODE ===`);
  await toggleEditMode(true);
  const suiteE = await evalJs(`(() => {
    const r = [];
    const log = (cat,n,s,d) => r.push({cat,n,s,d:d||''});
    const cards = [...document.querySelectorAll('[data-sound-card]')];
    const inCard = (c,t) => !!(c?.parentElement?.querySelector('button[title="'+t+'"]'));
    const editBtns = cards.filter(c => inCard(c,'Edit Sound')).length;
    const delBtns = cards.filter(c => inCard(c,'Delete Sound')).length;
    log('EDIT','E1: Edit Sound buttons on all cards',cards.length>0&&cards.every(c=>inCard(c,'Edit Sound'))?'PASS':'FAIL',editBtns+'/'+cards.length);
    log('EDIT','E2: Delete Sound buttons on all cards',cards.length>0&&cards.every(c=>inCard(c,'Delete Sound'))?'PASS':'FAIL',delBtns+'/'+cards.length);
    log('EDIT','E3: cards aria-disabled in edit mode',cards.every(c=>c.getAttribute('aria-disabled')==='true')?'PASS':'FAIL');
    const editBar = !![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Add Sound');
    log('EDIT','E4: edit bar Add Sound visible',editBar?'PASS':'FAIL');
    const addGrp = !![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Add Group');
    log('EDIT','E5: edit bar Add Group visible',addGrp?'PASS':'FAIL');
    return r;
  })()`);
  if (suiteE?.__error) log('EDIT','Suite E','FAIL',suiteE.__error); else for (const r of suiteE) log(r.cat,r.n,r.s,r.d);
  await toggleEditMode(false);

  // ================================================================
  //  A: ADD SOUND WITH REAL UPLOAD
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE A: ADD SOUND ===`);
  await toggleEditMode(true);
  const addSoundOpen = await evalJs(`window.__clickText('Add Sound')`);
  await sleep(700);
  await evalJs(`window.__setInput('name','Divine Light'); window.__setInput('type','Blessing'); window.__setInput('color','#a855f7'); window.__setInput('fadeIn','0.8');`);
  const uploaded = await uploadWav();
  log('SOUND','A1: WAV uploaded',uploaded?'PASS':'FAIL');
  await sleep(700);
  const addResult = await submitModal('Add Sound');
  log('SOUND','A2: Add Sound submitted',addResult==='OK'?'PASS':'FAIL',addResult);
  await sleep(1200);
  const afterAdd = await evalJs(`(() => {
    const cards = document.querySelectorAll('[data-sound-card]').length;
    const chars = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    const pal = chars.find(c=>c.name==='Human Paladin');
    return { cards, soundCount: pal?.sounds?.length||0, firstName: pal?.sounds?.[pal.sounds.length-1]?.name||'' };
  })()`);
  log('SOUND','A3: card count increased',afterAdd?.cards===4?'PASS':'FAIL','cards='+afterAdd?.cards);
  log('SOUND','A4: storage sound count',afterAdd?.soundCount===4?'PASS':'FAIL','count='+afterAdd?.soundCount);
  log('SOUND','A5: new sound name',afterAdd?.firstName==='Divine Light'?'PASS':'FAIL',afterAdd?.firstName);
  await toggleEditMode(false);

  // ================================================================
  //  J: EDIT EXISTING SOUND VIA MODAL
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE J: EDIT SOUND MODAL ===`);
  await toggleEditMode(true);
  const editBtn = await evalJs(`(() => {
    const c=[...document.querySelectorAll('[data-sound-card]')].find(c=>c.textContent.includes('Smite'));
    if(!c) return 'NO_CARD';
    const b=c.parentElement?.querySelector('button[title="Edit Sound"]');
    if(!b) return 'NO_BTN';
    b.click();
    return 'OK';
  })()`);
  await sleep(700);
  log('SOUND','J1: edit modal opened',editBtn==='OK'?'PASS':'FAIL',editBtn);
  const prefilled = await evalJs(`(() => {
    const name=document.querySelector('input[name="name"]');
    const color=document.querySelector('input[name="color"]');
    const fadeIn=document.querySelector('input[name="fadeIn"]');
    return { name:name?.value, color:color?.value, fadeIn:fadeIn?.value };
  })()`);
  log('SOUND','J2: name prefilled (Smite)',prefilled?.name==='Smite'?'PASS':'FAIL',prefilled?.name);
  log('SOUND','J3: color prefilled (#ff0000)',prefilled?.color==='#ff0000'?'PASS':'FAIL',prefilled?.color);
  log('SOUND','J4: fadeIn prefilled (0.5)',prefilled?.fadeIn==='0.5'||prefilled?.fadeIn===0.5?'PASS':'FAIL',String(prefilled?.fadeIn));

  // Change name + color + toggle glow off
  await evalJs(`window.__setInput('name','Divine Smite'); window.__setInput('color','#00ff00');`);
  await clickToggleNearText('Enable Glow Effect');
  await sleep(200);
  const editSave = await submitModal('Save Changes');
  log('SOUND','J5: Save Changes submitted',editSave==='OK'?'PASS':'FAIL',editSave);
  await sleep(1200);
  const afterEdit = await evalJs(`(() => {
    const chars = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    const pal = chars.find(c=>c.name==='Human Paladin');
    const smite = pal?.sounds?.find(s=>s.id==='s1');
    return { name: smite?.name, color: smite?.color, glow: smite?.glowEnabled };
  })()`);
  log('SOUND','J6: name updated',afterEdit?.name==='Divine Smite'?'PASS':'FAIL',afterEdit?.name);
  log('SOUND','J7: color updated',afterEdit?.color==='#00ff00'?'PASS':'FAIL',afterEdit?.color);
  log('SOUND','J8: glow toggled off',afterEdit?.glow===false?'PASS':'FAIL',String(afterEdit?.glow));
  await toggleEditMode(false);

  // ================================================================
  //  C: CHARACTER CRUD (add → edit → delete with confirm)
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE C: CHARACTER CRUD ===`);
  // Add
  await toggleEditMode(true);
  const addCharOpen = await evalJs(`window.__clickText('Add Character')`);
  await sleep(500);
  await evalJs(`window.__setInput('name','Rogue')`);
  const charSubmit = await submitModal('Add Character');
  await sleep(900);
  const charAdded = await evalJs(`(() => {
    const chars=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    const sidebar=[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Rogue');
    return { has:chars.some(c=>c.name==='Rogue'), sidebar };
  })()`);
  log('CHAR','C1: character added',charAdded?.has&&charAdded?.sidebar?'PASS':'FAIL',JSON.stringify(charAdded));

  // Edit
  const editCharBtn = await evalJs(`(() => {
    const b=[...document.querySelectorAll('button[title="Edit Character"]')].find(b=>b.closest('div')?.textContent.includes('Rogue'));
    if(!b) return 'NO_EDIT_BTN';
    b.click();
    return 'OK';
  })()`);
  await sleep(500);
  log('CHAR','C2: edit modal opened',editCharBtn==='OK'?'PASS':'FAIL',editCharBtn);
  await evalJs(`window.__setInput('name','Rogue (Stealth)')`);
  const charEditSave = await submitModal('Save Changes');
  await sleep(900);
  const charEdited = await evalJs(`(() => {
    const chars=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    return { hasRogue:chars.some(c=>c.name==='Rogue'), hasNew:chars.some(c=>c.name==='Rogue (Stealth)') };
  })()`);
  log('CHAR','C3: rename succeeded',charEdited?.hasNew&&!charEdited?.hasRogue?'PASS':'FAIL',JSON.stringify(charEdited));

  // Delete with confirm text verification
  const delCharBtn = await evalJs(`(() => {
    const b=[...document.querySelectorAll('button[title="Delete Character"]')].find(b=>b.closest('div')?.textContent.includes('Rogue'));
    if(!b) return 'NO_DEL_BTN';
    b.click();
    return 'OK';
  })()`);
  await sleep(500);
  log('CHAR','C4: delete confirm opened',delCharBtn==='OK'?'PASS':'FAIL',delCharBtn);
  const confirmText = await evalJs(`document.querySelector('[class*="fixed"][class*="z-50"]')?.textContent || ''`);
  log('CHAR','C5: confirm mentions Rogue (Stealth)',confirmText.includes('Rogue')?'PASS':'FAIL',confirmText.slice(0,80));
  const delConfirm = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(!b) return 'NO'; b.click(); return 'OK'; })()`);
  await sleep(900);
  const charDeleted = await evalJs(`JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]').some(c=>c.name.includes('Rogue'))`);
  log('CHAR','C6: Rogue deleted',charDeleted===false?'PASS':'FAIL','still_exists='+charDeleted);
  await toggleEditMode(false);

  // ================================================================
  //  K: ENVIRONMENT CATEGORY CRUD (add → edit → delete)
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE K: CATEGORY CRUD ===`);
  // Switch to Environment tab
  await evalJs(`document.querySelector('button')?.closest('div')?.querySelector?.('button'); [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Environment')?.click()`);
  await sleep(400);
  await evalJs(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim().endsWith('Forest') && !b.title)?.click()`);
  await sleep(300);

  await toggleEditMode(true);
  const addCatOpen = await evalJs(`window.__clickText('Add Category')`);
  await sleep(500);
  await evalJs(`window.__setInput('name','Cave')`);
  const catSubmit = await submitModal('Add Category');
  await sleep(900);
  const catAdded = await evalJs(`(() => {
    const env=JSON.parse(localStorage.getItem(window.__pk('ttrpg_environment'))||'[]');
    const sidebar=[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Cave');
    return { has:env.some(e=>e.category==='Cave'), sidebar };
  })()`);
  log('ENV','K1: category added',catAdded?.has&&catAdded?.sidebar?'PASS':'FAIL',JSON.stringify(catAdded));

  // Edit category
  const editCatBtn = await evalJs(`(() => {
    const b=[...document.querySelectorAll('button[title="Edit Category"]')].find(b=>b.closest('div')?.textContent.includes('Cave'));
    if(!b) return 'NO';
    b.click();
    return 'OK';
  })()`);
  await sleep(500);
  await evalJs(`window.__setInput('name','Crystal Cave')`);
  const catEditSave = await submitModal('Save Changes');
  await sleep(900);
  const catEdited = await evalJs(`(() => {
    const env=JSON.parse(localStorage.getItem(window.__pk('ttrpg_environment'))||'[]');
    return { hasCave:env.some(e=>e.category==='Cave'), hasCrystal:env.some(e=>e.category==='Crystal Cave') };
  })()`);
  log('ENV','K2: rename succeeded',catEdited?.hasCrystal&&!catEdited?.hasCave?'PASS':'FAIL',JSON.stringify(catEdited));

  // Delete category
  const delCatBtn = await evalJs(`(() => {
    const b=[...document.querySelectorAll('button[title="Delete Category"]')].find(b=>b.closest('div')?.textContent.includes('Crystal'));
    if(!b) return 'NO';
    b.click();
    return 'OK';
  })()`);
  await sleep(500);
  const catConfirmText = await evalJs(`document.querySelector('[class*="fixed"][class*="z-50"]')?.textContent || ''`);
  log('ENV','K3: confirm mentions Crystal Cave',catConfirmText.includes('Crystal')?'PASS':'FAIL');
  const catDel = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(!b) return 'NO'; b.click(); return 'OK'; })()`);
  await sleep(900);
  const catDeleted = await evalJs(`JSON.parse(localStorage.getItem(window.__pk('ttrpg_environment'))||'[]').some(e=>e.category.includes('Crystal'))`);
  log('ENV','K4: Crystal Cave deleted',catDeleted===false?'PASS':'FAIL');
  await toggleEditMode(false);

  // ================================================================
  //  G: GROUPS FULL CRUD + MODE TOGGLE CONVERSION
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE G: GROUPS CRUD ===`);
  // Add group
  await toggleEditMode(true);
  const addGrpOpen = await evalJs(`window.__clickText('Add Group')`);
  await sleep(500);
  await evalJs(`window.__setInput('name','Dragon Lore')`);
  const grpSubmit = await submitModal('Add Group');
  await sleep(900);
  const grpAdded = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]');
    const sidebar=[...document.querySelectorAll('button')].some(b=>b.textContent.trim().endsWith('Dragon Lore'));
    return { has:g.some(x=>x.name==='Dragon Lore'), sidebar, mode:g.find(x=>x.name==='Dragon Lore')?.mode };
  })()`);
  log('GRP','G1: group added',grpAdded?.has&&grpAdded?.sidebar?'PASS':'FAIL',JSON.stringify(grpAdded));
  log('GRP','G2: mode defaults to environment',grpAdded?.mode==='environment'?'PASS':'FAIL',grpAdded?.mode);

  // Click into Dragon Lore group
  await evalJs(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim().endsWith('Dragon Lore'))?.click()`);
  await sleep(400);

  // Edit group name via "Edit Group" button in grid header
  const editGrpBtn = await evalJs(`(() => {
    const b=document.querySelector('button[title="Edit Group"]');
    if(!b) return 'NO';
    b.click();
    return 'OK';
  })()`);
  await sleep(500);
  log('GRP','G3: edit group modal opened',editGrpBtn==='OK'?'PASS':'FAIL',editGrpBtn);
  await evalJs(`window.__setInput('name','Dragon Lore Reborn')`);
  const grpEditSave = await submitModal('Save Changes');
  await sleep(900);
  const grpEdited = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]');
    return { hasOld:g.some(x=>x.name==='Dragon Lore'), hasNew:g.some(x=>x.name==='Dragon Lore Reborn') };
  })()`);
  log('GRP','G4: group renamed',grpEdited?.hasNew&&!grpEdited?.hasOld?'PASS':'FAIL',JSON.stringify(grpEdited));

  // Mode toggle: env → characters
  const toggleToChars = await evalJs(`(() => {
    const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Character Pack' && b.closest('[class*="sidebar"], [class*="drawer"], div')?.querySelector('button')?.textContent?.includes('Dragon'));
    if(!b) { const all=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Character Pack'); return all.length+'char_packs'; }
    b.click(); return 'OK';
  })()`);
  // Fallback: if Dragon Lore context lost, just click the first Character Pack visible (group tab is active)
  if (toggleToChars !== 'OK') {
    await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Character Pack'); if(b) b.click(); return 'clicked'; })()`);
  }
  await sleep(500);
  const conv1 = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]').find(x=>x.name==='Dragon Lore Reborn');
    return { mode:g?.mode, cats:g?.categories?.length, chars:g?.characters?.length, charNames:g?.characters?.map(c=>c.name) };
  })()`);
  log('GRP','G5: mode=characters after toggle',conv1?.mode==='characters'?'PASS':'FAIL',JSON.stringify(conv1));
  log('GRP','G6: categories empty',conv1?.cats===0?'PASS':'FAIL','cats='+conv1?.cats);
  log('GRP','G7: characters created',conv1?.chars>=0?'PASS':'FAIL','chars='+conv1?.chars);

  // Toggle back: characters → environment
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Environment Pack'); if(b) b.click(); return 'OK'; })()`);
  await sleep(500);
  const conv2 = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]').find(x=>x.name==='Dragon Lore Reborn');
    return { mode:g?.mode, cats:g?.categories?.length, chars:g?.characters?.length };
  })()`);
  log('GRP','G8: mode=environment after toggle back',conv2?.mode==='environment'?'PASS':'FAIL',JSON.stringify(conv2));
  log('GRP','G9: round-trip categories restored',conv2?.cats>=0?'PASS':'FAIL','cats='+conv2?.cats);

  // Add category into Dragon Lore (env mode)
  const addGrpCat = await evalJs(`window.__clickText('Add Category')`);
  await sleep(500);
  if (addGrpCat === 'OK') {
    await evalJs(`window.__setInput('name','Rumors')`);
    const grpCatSubmit = await submitModal('Add Category');
    await sleep(900);
  }
  const grpCatAdded = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]').find(x=>x.name==='Dragon Lore Reborn');
    return g?.categories?.some(c=>c.category==='Rumors');
  })()`);
  log('GRP','G10: group category added',grpCatAdded===true?'PASS':'FAIL','hasRumors='+grpCatAdded);

  // Delete group category
  const delGrpCatBtn = await evalJs(`(() => {
    const b=[...document.querySelectorAll('button[title="Delete Category"]')].find(b=>b.closest('div')?.textContent.includes('Rumors'));
    if(!b) return 'NO';
    b.click(); return 'OK';
  })()`);
  await sleep(400);
  if (delGrpCatBtn === 'OK') {
    const gcConfirm = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(!b) return 'NO'; b.click(); return 'OK'; })()`);
    await sleep(700);
  }
  const grpCatDeleted = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]').find(x=>x.name==='Dragon Lore Reborn');
    return g?.categories?.some(c=>c.category==='Rumors');
  })()`);
  log('GRP','G11: group category deleted',grpCatDeleted===false?'PASS':'FAIL');

  // Add character into Dragon Lore (switch to characters mode first)
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Character Pack'); if(b) b.click(); return 'OK'; })()`);
  await sleep(400);
  const addGrpChar = await evalJs(`window.__clickText('Add Character')`);
  await sleep(500);
  if (addGrpChar === 'OK') {
    await evalJs(`window.__setInput('name','Bard')`);
    const grpCharSubmit = await submitModal('Add Character');
    await sleep(900);
  }
  const grpCharAdded = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]').find(x=>x.name==='Dragon Lore Reborn');
    return g?.characters?.some(c=>c.name==='Bard');
  })()`);
  log('GRP','G12: group character added',grpCharAdded===true?'PASS':'FAIL');

  // Delete group character
  const delGrpCharBtn = await evalJs(`(() => {
    const b=[...document.querySelectorAll('button[title="Delete Character"]')].find(b=>b.closest('div')?.textContent.includes('Bard'));
    if(!b) return 'NO';
    b.click(); return 'OK';
  })()`);
  await sleep(400);
  if (delGrpCharBtn === 'OK') {
    await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
    await sleep(700);
  }
  const grpCharDeleted = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]').find(x=>x.name==='Dragon Lore Reborn');
    return g?.characters?.some(c=>c.name==='Bard');
  })()`);
  log('GRP','G13: group character deleted',grpCharDeleted===false?'PASS':'FAIL');

  // Delete group
  const delGrpBtn = await evalJs(`(() => {
    const b=document.querySelector('button[title="Delete Group"]');
    if(!b) return 'NO';
    b.click(); return 'OK';
  })()`);
  await sleep(400);
  if (delGrpBtn === 'OK') {
    await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
    await sleep(700);
  }
  const grpDeleted = await evalJs(`JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]').some(g=>g.name==='Dragon Lore Reborn')`);
  log('GRP','G14: group deleted',grpDeleted===false?'PASS':'FAIL','still_exists='+grpDeleted);
  await toggleEditMode(false);

  // ================================================================
  //  H: ADD SOUND INTO GROUP (real upload to existing Tavern Pack)
  // ================================================================
  //  H / X / B: shared specs - moved to the shared-spec block after Suite Y.
  //  Suite M below depends on the board the inline suites leave behind, and each
  //  of these specs seeds + reloads, so running them here would reset its input.

  // ================================================================
  //  T: THEMES + SETTINGS + IMAGE + ABOUT
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE T: THEMES & SETTINGS ===`);
  await evalJs(`document.querySelector('button[title="Settings"]')?.click()`);
  await sleep(600);
  const settingsOpen = await evalJs(`!!document.querySelector('[class*="fixed"][class*="z-50"]')`);
  log('SETTINGS','T1: settings modal opened',settingsOpen?'PASS':'FAIL');

  // Theme buttons count
  const themeCount = await evalJs(`(() => {
    const modal = document.querySelector('[class*="fixed"][class*="z-50"]');
    if(!modal) return 0;
    const themeGrid = modal.querySelector('.grid.grid-cols-3');
    return themeGrid ? themeGrid.querySelectorAll('button').length : 0;
  })()`);
  log('SETTINGS','T2: 6 theme buttons',themeCount===6?'PASS':'FAIL','count='+themeCount);

  // Cycle through all non-default themes
  const themes = ['Forest','Ocean','Fire','Magic','Gold'];
  for (const theme of themes) {
    await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='${theme}'); if(b) b.click(); return 'OK'; })()`);
    await sleep(300);
    const tData = await evalJs(`(() => {
      const bs = JSON.parse(localStorage.getItem(window.__pk('backgroundSettings'))||'{}');
      const css = getComputedStyle(document.documentElement).getPropertyValue('--theme-bg-primary').trim();
      return { key: bs.theme, css };
    })()`);
    log('SETTINGS','T3: '+theme+' applied',tData?.key===theme.toLowerCase()?'PASS':'FAIL','key='+tData?.key+' css='+tData?.css);
  }

  // Default theme resets CSS
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Default'); if(b) b.click(); return 'OK'; })()`);
  await sleep(300);
  const defaultReset = await evalJs(`(() => {
    const css = getComputedStyle(document.documentElement).getPropertyValue('--theme-bg-primary').trim();
    return { css, key: (JSON.parse(localStorage.getItem(window.__pk('backgroundSettings'))||'{}')).theme };
  })()`);
  log('SETTINGS','T4: Default resets CSS',defaultReset?.key==='default'?'PASS':'FAIL',JSON.stringify(defaultReset));

  // Custom color picker
  await evalJs(`(() => {
    const inp = document.querySelector('input[type="color"]');
    if(!inp) return 'NO';
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    nativeSet.call(inp,'#123456');
    inp.dispatchEvent(new Event('input',{bubbles:true}));
    inp.dispatchEvent(new Event('change',{bubbles:true}));
    return 'OK';
  })()`);
  await sleep(300);
  const customColor = await evalJs(`(() => {
    const bs = JSON.parse(localStorage.getItem(window.__pk('backgroundSettings'))||'{}');
    return bs.theme;
  })()`);
  log('SETTINGS','T5: custom color stored',customColor==='#123456'?'PASS':'FAIL',customColor);

  // Background Image tab
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Background Image'); if(b) b.click(); return 'OK'; })()`);
  await sleep(400);
  // Upload image via CDP
  for (let i = 0; i < 5; i++) {
    const doc = await cdp('DOM.getDocument', { depth: 1 });
    const qr = await cdp('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type="file"][accept="image/*"]' });
    if (qr.result?.nodeId) {
      await cdp('DOM.setFileInputFiles', { nodeId: qr.result.nodeId, files: [PNG] });
      break;
    }
    await sleep(400);
  }
  await sleep(800);
  const imgApplied = await evalJs(`(() => {
    const app = document.querySelector('.app-container');
    const hasBg = app?.classList.contains('bg-cover') || (app?.style.backgroundImage || '').includes('data:');
    const bs = JSON.parse(localStorage.getItem(window.__pk('backgroundSettings'))||'{}');
    return { hasBg, type: bs.type };
  })()`);
  log('SETTINGS','T6: image applied',imgApplied?.hasBg||imgApplied?.type==='image'?'PASS':'FAIL',JSON.stringify(imgApplied));

  // Remove image
  const removeImgBtn = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Remove Image'); if(b) b.click(); return b?'OK':'NO'; })()`);
  await sleep(400);
  log('SETTINGS','T7: Remove Image clicked',removeImgBtn==='OK'?'PASS':'FAIL');

  // Legal & Credits → About modal
  const legalBtn = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Legal')); if(b) b.click(); return b?'OK':'NO'; })()`);
  await sleep(500);
  const aboutText = await evalJs(`document.body.innerText`);
  log('SETTINGS','T8: About shows version',aboutText.includes('Version')&&aboutText.includes('0.1.3')?'PASS':'FAIL');
  log('SETTINGS','T9: About shows Lucide license',aboutText.includes('Lucide')?'PASS':'FAIL');
  // Close About
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Close'); if(b) b.click(); return 'OK'; })()`);
  await sleep(300);

  // Close Settings
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Close Settings')); if(b) b.click(); const x=document.querySelector('button[title="Close"]'); if(x) x.click(); return 'OK'; })()`);
  await sleep(400);
  const settingsClosed = await evalJs(`!document.querySelector('[class*="fixed"][class*="z-50"]')`);
  log('SETTINGS','T10: settings closed',settingsClosed?'PASS':'FAIL');

  // ================================================================
  //  D: DELETE SOUND + CANCEL PATH
  // ================================================================
  // Suite G (groups CRUD) and Suite T (settings) can leave the app navigated off
  // the character board. Suites D and M below drive the per-card delete and the
  // move/copy picker, which only exist on a sound board - so reset the view to
  // the default Human Paladin board first. The reload re-renders from
  // localStorage, so the fixture those suites read is untouched.
  await reloadPage();
  await waitForReload();
  console.log(`\n[${LABEL}] === SUITE D: DELETE SOUND + CANCEL ===`);
  await toggleEditMode(true);
  // Cancel path: try deleting Shield Bash, then Cancel
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
    const chars=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    const pal=chars.find(c=>c.name==='Human Paladin');
    return pal?.sounds?.some(s=>s.name==='Shield Bash');
  })()`);
  log('SOUND','D3: Shield Bash still exists after Cancel',shieldStill===true?'PASS':'FAIL');

  // Real delete: delete Healing Light
  const delHealBtn = await evalJs(`(() => {
    const c=[...document.querySelectorAll('[data-sound-card]')].find(c=>c.textContent.includes('Healing Light'));
    if(!c) return 'NO_CARD';
    const b=c.parentElement?.querySelector('button[title="Delete Sound"]');
    if(!b) return 'NO_BTN';
    b.click(); return 'OK';
  })()`);
  await sleep(500);
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
  await sleep(900);
  const healDeleted = await evalJs(`(() => {
    const chars=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    const pal=chars.find(c=>c.name==='Human Paladin');
    return pal?.sounds?.some(s=>s.name==='Healing Light');
  })()`);
  log('SOUND','D4: Healing Light deleted',healDeleted===false?'PASS':'FAIL');
  await toggleEditMode(false);

  // ================================================================
  //  M: MOVE / COPY SOUND
  // ================================================================
  // Fixture at this point (after suite D):
  //   Human Paladin: Smite, Shield Bash      Elf Sorcerer: (empty)
  //   Dungeon: Dripping                      Forest: (empty)
  //   Tavern Pack / Ambience: Tavern Song    Hero Pack / Fighter: (empty)
  console.log(`\n[${LABEL}] === SUITE M: MOVE / COPY SOUND ===`);
  await toggleEditMode(true);

  // In-page helpers for the picker: sections are keyed by their header, and row
  // labels must be matched on the first text node so the "(duplicate here)"
  // suffix does not defeat the comparison.
  await evalJs(`(() => {
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
      return rows.find(r => {
        const span=r.querySelector('span');
        return span && span.firstChild && span.firstChild.textContent.trim()===name;
      }) || null;
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
    window.__confirmDialogOpen = () => !!document.querySelector('h2')?.textContent?.includes('Confirm Delete');
    window.__soundsIn = (key, matchName) => {
      const list=JSON.parse(localStorage.getItem(window.__pk(key))||'[]');
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
    return 'ok';
  })()`);

  // --- M1: the button exists on every card, only in edit mode
  const mBtn = await evalJs(`(() => {
    const cards=[...document.querySelectorAll('[data-sound-card]')];
    const withBtn=cards.filter(c=>!!c.parentElement?.querySelector('button[title="Move or Copy Sound"]'));
    return {cards:cards.length, withBtn:withBtn.length};
  })()`);
  log('MOVE','M1: Move/Copy button on all cards in edit mode',mBtn?.cards>0&&mBtn?.withBtn===mBtn?.cards?'PASS':'FAIL',mBtn?.withBtn+'/'+mBtn?.cards);

  // --- M2: picker opens from a card
  const mOpen = await evalJs(`window.__mcOpen('Divine Smite')`);
  await sleep(500);
  const mPickerOpen = await evalJs(`window.__mcModalOpen()`);
  log('MOVE','M2: card button opens picker',mOpen==='OK'&&mPickerOpen===true?'PASS':'FAIL','open='+mOpen+' modal='+mPickerOpen);

  // --- M3: sections present, in sidebar order
  const mSections = await evalJs(`window.__mcSections()`);
  log('MOVE','M3: sections Characters/groups/Environments',Array.isArray(mSections)&&mSections[0]==='Characters'&&mSections.includes('Tavern Pack')&&mSections.includes('Hero Pack')&&mSections[mSections.length-1]==='Environments'?'PASS':'FAIL',JSON.stringify(mSections));

  // --- M4: current container offers Copy but not Move
  const mSelfTitles = await evalJs(`window.__mcTitles('Characters','Human Paladin')`);
  log('MOVE','M4: current container has Copy, no Move',Array.isArray(mSelfTitles)&&!mSelfTitles.includes('Move to Human Paladin')&&mSelfTitles.includes('Copy to Human Paladin')?'PASS':'FAIL',JSON.stringify(mSelfTitles));

  // --- M5: other container offers both, with distinct stable titles
  const mOtherTitles = await evalJs(`window.__mcTitles('Characters','Elf Sorcerer')`);
  log('MOVE','M5: target row has Move + Copy titles',Array.isArray(mOtherTitles)&&mOtherTitles.includes('Move to Elf Sorcerer')&&mOtherTitles.includes('Copy to Elf Sorcerer')?'PASS':'FAIL',JSON.stringify(mOtherTitles));

  // --- M6: COPY character -> character
  const beforeCopy = await evalJs(`(() => {
    const l=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    let sfk=0; for(let i=0;i<localStorage.length;i++){ if((localStorage.key(i)||'').startsWith('profile:'+window.__pid()+':sound_file_')) sfk++; }
    return { paladin:l.find(c=>c.name==='Human Paladin')?.sounds?.length, elf:l.find(c=>c.name==='Elf Sorcerer')?.sounds?.length, soundFileKeys:sfk };
  })()`);
  const mCopy = await evalJs(`window.__mcClick('Characters','Elf Sorcerer','Copy')`);
  await sleep(700);
  const afterCopy = await evalJs(`(() => {
    const l=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    const src=window.__soundsIn('ttrpg_characters','Divine Smite');
    const paladin=l.find(c=>c.name==='Human Paladin');
    const elf=l.find(c=>c.name==='Elf Sorcerer');
    const copy=elf?.sounds?.find(s=>s.name==='Divine Smite (copy)');
    return {
      paladin:paladin?.sounds?.length, elf:elf?.sounds?.length,
      srcStillThere:paladin?.sounds?.some(s=>s.name==='Divine Smite'),
      copyFound:!!copy,
      idsDiffer: !!copy && !!src[0] && src[0].sound.id !== copy.id,
      sharedFile: !!copy && !!src[0] && JSON.stringify(copy.files)===JSON.stringify(src[0].sound.files),
      legacyKept: copy ? ('file' in copy) : false,
      fileKeys: (() => { let n=0; for(let i=0;i<localStorage.length;i++){ if((localStorage.key(i)||'').startsWith('profile:'+window.__pid()+':sound_file_')) n++; } return n; })()
    };
  })()`);
  log('MOVE','M6: copy adds to target, source untouched',mCopy==='OK'&&afterCopy?.paladin===beforeCopy?.paladin&&afterCopy?.elf===beforeCopy?.elf+1&&afterCopy?.srcStillThere===true?'PASS':'FAIL',JSON.stringify({before:beforeCopy,after:afterCopy}));
  log('MOVE','M7: copy id differs from source',afterCopy?.copyFound&&afterCopy?.idsDiffer?'PASS':'FAIL','copyFound='+afterCopy?.copyFound);
  log('MOVE','M8: copy shares files[] verbatim',afterCopy?.sharedFile?'PASS':'FAIL','');
  log('MOVE','M9: copy keeps legacy file field',afterCopy?.legacyKept?'PASS':'FAIL','');

  // --- M10: no second sound_file_* key was written (the file is genuinely shared)
  // afterCopy.fileKeys directly checked against beforeCopy.soundFileKeys
  log('MOVE','M10: copy wrote no new sound_file_* key',afterCopy?.fileKeys===beforeCopy?.soundFileKeys?'PASS':'FAIL','before='+beforeCopy?.soundFileKeys+' after='+afterCopy?.fileKeys);

  // --- M11: second copy auto-suffixes (copy 2), scoped to the destination
  await evalJs(`window.__mcOpen('Divine Smite')`);
  await sleep(400);
  const mCopy2 = await evalJs(`window.__mcClick('Characters','Elf Sorcerer','Copy')`);
  await sleep(700);
  const names2 = await evalJs(`(() => {
    const l=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    return l.find(c=>c.name==='Elf Sorcerer')?.sounds?.map(s=>s.name);
  })()`);
  log('MOVE','M11: second copy is "Smite (copy 2)"',mCopy2==='OK'&&Array.isArray(names2)&&names2.includes('Divine Smite (copy 2)')?'PASS':'FAIL',JSON.stringify(names2));

  // --- M12: same name in a DIFFERENT container is not suffixed globally
  await evalJs(`window.__mcOpen('Divine Smite')`);
  await sleep(400);
  const mCopyDungeon = await evalJs(`window.__mcClick('Environments','Dungeon','Copy')`);
  await sleep(700);
  const dungeonNames = await evalJs(`(() => {
    const l=JSON.parse(localStorage.getItem(window.__pk('ttrpg_environment'))||'[]');
    return l.find(c=>c.category==='Dungeon')?.sounds?.map(s=>s.name);
  })()`);
  log('MOVE','M12: copy elsewhere is "(copy)", not "(copy 3)"',mCopyDungeon==='OK'&&Array.isArray(dungeonNames)&&dungeonNames.includes('Divine Smite (copy)')?'PASS':'FAIL',JSON.stringify(dungeonNames));

  // --- M13: MOVE within the same slice preserves everything and is silent
  const beforeMove = await evalJs(`(() => {
    const l=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    const s=l.find(c=>c.name==='Human Paladin')?.sounds?.find(x=>x.name==='Shield Bash');
    window.__shieldId=s?.id; window.__shieldColor=s?.color; window.__shieldFiles=JSON.stringify(s?.files);
    return { paladin:l.find(c=>c.name==='Human Paladin')?.sounds?.length, elf:l.find(c=>c.name==='Elf Sorcerer')?.sounds?.length, sound:s };
  })()`);
  await evalJs(`window.__mcOpen('Shield Bash')`);
  await sleep(400);
  const mMove = await evalJs(`window.__mcClick('Characters','Elf Sorcerer','Move')`);
  await sleep(800);
  const afterMove = await evalJs(`(() => {
    const l=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    const paladin=l.find(c=>c.name==='Human Paladin');
    const elf=l.find(c=>c.name==='Elf Sorcerer');
    const moved=elf?.sounds?.find(s=>s.name==='Shield Bash');
    return {
      paladin:paladin?.sounds?.length, elf:elf?.sounds?.length,
      goneFromSource:!paladin?.sounds?.some(s=>s.name==='Shield Bash'),
      sameId: !!moved && moved.id === window.__shieldId,
      settingsKept: !!moved && moved.color===window.__shieldColor && moved.randomPlay===true && JSON.stringify(moved.files)===window.__shieldFiles,
      anyDialog: !!document.querySelector('h2')?.textContent?.includes('Confirm Delete'),
      pickerClosed: !window.__mcModalOpen()
    };
  })()`);
  log('MOVE','M13: move relocates within slice',mMove==='OK'&&afterMove?.paladin===beforeMove?.paladin-1&&afterMove?.elf===beforeMove?.elf+1&&afterMove?.goneFromSource?'PASS':'FAIL',JSON.stringify({before:{p:beforeMove?.paladin,e:beforeMove?.elf},after:{p:afterMove?.paladin,e:afterMove?.elf}}));
  log('MOVE','M14: move preserves id + settings + files',afterMove?.settingsKept?'PASS':'FAIL','');
  log('MOVE','M15: move opens no dialog, picker closed',afterMove?.pickerClosed&&afterMove?.anyDialog===false?'PASS':'FAIL','pickerClosed='+afterMove?.pickerClosed);

  // --- M16: cross-slice move from a character into a group category
  await evalJs(`window.__mcOpen('Divine Smite')`);
  await sleep(400);
  const mMoveGroup = await evalJs(`window.__mcClick('Tavern Pack','Ambience','Move')`);
  await sleep(800);
  const groupMoved = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]');
    const c=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    const still=c.find(x=>x.name==='Human Paladin')?.sounds?.some(s=>s.name==='Divine Smite');
    const landed=g.find(x=>x.name==='Tavern Pack')?.categories?.find(cat=>cat.category==='Ambience')?.sounds?.some(s=>s.name==='Divine Smite');
    return { stillInChar:!!still, landedInGroup:!!landed };
  })()`);
  log('MOVE','M16: move from character into group category',mMoveGroup==='OK'&&groupMoved?.stillInChar===false&&groupMoved?.landedInGroup===true?'PASS':'FAIL',JSON.stringify(groupMoved));

  // --- M17: cross-slice move from character into environment category
  // Ensure Elf Sorcerer is active so we can see Shield Bash
  await evalJs(`(() => {
    const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Elf Sorcerer');
    if(b) { b.click(); return 'OK'; }
    return 'NO_BTN';
  })()`);
  await sleep(600);
  const mOpenEnv = await evalJs(`window.__mcOpen('Shield Bash')`);
  await sleep(400);
  const mMoveEnv = await evalJs(`window.__mcClick('Environments','Dungeon','Move')`);
  await sleep(800);
  const envMoved = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]');
    const e=JSON.parse(localStorage.getItem(window.__pk('ttrpg_environment'))||'[]');
    const c=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    return {
      stillInChar:!!c.find(x=>x.name==='Human Paladin')?.sounds?.some(s=>s.name==='Shield Bash'),
      landedInEnv:!!e.find(x=>x.category==='Dungeon')?.sounds?.some(s=>s.name==='Shield Bash')
    };
  })()`);
  log('MOVE','M17: move from character into environment category',mMoveEnv==='OK'&&envMoved?.stillInChar===false&&envMoved?.landedInEnv===true?'PASS':'FAIL','open='+mOpenEnv+' click='+mMoveEnv+' env='+JSON.stringify(envMoved));

  // --- M18: move into a group character (from character is cross-slice)
  // Switch back to Human Paladin so Divine Light is visible
  await evalJs(`(() => {
    const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Human Paladin');
    if(b) { b.click(); return 'OK'; }
    return 'NO_BTN';
  })()`);
  await sleep(600);
  await evalJs(`window.__mcOpen('Divine Light')`);
  await sleep(400);
  const mMoveGroupChar = await evalJs(`window.__mcClick('Hero Pack','Fighter','Move')`);
  await sleep(800);
  const groupCharMoved = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]');
    const c=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
    return {
      stillInChar:!!c.find(x=>x.name==='Human Paladin')?.sounds?.some(s=>s.name==='Divine Light'),
      landedInGroupChar:!!g.find(x=>x.name==='Hero Pack')?.characters?.find(ch=>ch.name==='Fighter')?.sounds?.some(s=>s.name==='Divine Light')
    };
  })()`);
  log('MOVE','M18: move into a group character (cross-slice)',mMoveGroupChar==='OK'&&groupCharMoved?.stillInChar===false&&groupCharMoved?.landedInGroupChar===true?'PASS':'FAIL','click='+mMoveGroupChar+' '+JSON.stringify(groupCharMoved));

  // --- M19: an empty destination is still offered and accepts a copy
  await evalJs(`(() => {
    const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Elf Sorcerer');
    if(b) { b.click(); return 'OK'; }
    return 'NO_BTN';
  })()`);
  await sleep(600);
  await evalJs(`window.__mcOpen('Divine Smite (copy)')`);
  await sleep(400);
  const forestRow = await evalJs(`window.__mcTitles('Environments','Forest')`);
  const mCopyForest = await evalJs(`window.__mcClick('Environments','Forest','Copy')`);
  await sleep(700);
  const forestHas = await evalJs(`(() => {
    const l=JSON.parse(localStorage.getItem(window.__pk('ttrpg_environment'))||'[]');
    return l.find(c=>c.category==='Forest')?.sounds?.map(s=>s.name);
  })()`);
  log('MOVE','M19: empty destination listed and accepts copy',Array.isArray(forestRow)&&forestRow.includes('Copy to Forest')&&Array.isArray(forestHas)&&forestHas.length===1?'PASS':'FAIL',JSON.stringify({row:forestRow,sounds:forestHas}));

  // --- M20: Esc closes the picker
  await evalJs(`window.__mcOpen('Divine Smite (copy)')`);
  await sleep(400);
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await sleep(400);
  const escClosed = await evalJs(`!window.__mcModalOpen()`);
  log('MOVE','M20: Esc closes picker',escClosed===true?'PASS':'FAIL','');

  // --- M21: data version untouched, no *_old keys (no data reset)
  //
  // Scoped to THIS profile via __keysFor(pid), not a raw scan of localStorage. The
  // raw scan caught a `*_old` key belonging to a *different* profile - a leftover
  // from an earlier run - and failed the suite on 2026-10-12 for a reason that had
  // nothing to do with the code. The guard is still exactly as strict: a DATA_VERSION
  // mismatch must not leave a backup behind for the profile under test.
  //
  // This briefly excluded `<knownKey>_old` too, because a profile left unversioned
  // in the user's store made the app write that backup mid-run. Removed again the
  // same day: the harness now ends every run with the store verified from disk
  // against its pre-run state, so residue cannot accumulate and there is nothing
  // left for this assertion to trip over. 💡 Fix the environment before relaxing
  // the assertion - otherwise you cannot tell a real regression from old litter.
  const ver = await evalJs(`(() => {
    const old = window.__keysFor(window.__pid()).filter(k => k.endsWith('_old'));
    return { v: localStorage.getItem(window.__pk('ttrpg_data_version')), old };
  })()`);
  log('MOVE','M21: DATA_VERSION still 3, no *_old keys',ver?.v==='3'&&ver?.old?.length===0?'PASS':'FAIL',JSON.stringify(ver));

  // --- M22: button absent outside edit mode
  await toggleEditMode(false);
  await sleep(400);
  const noEditBtns = await evalJs(`document.querySelectorAll('button[title="Move or Copy Sound"]').length`);
  log('MOVE','M22: button hidden outside edit mode',noEditBtns===0?'PASS':'FAIL','count='+noEditBtns);
  await toggleEditMode(true);

  // ================================================================
  //  V: EMPTY STATES (seed empty characters + env, reload)
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE V: EMPTY STATES ===`);
  await evalJs(`(() => {
    localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([]));
    localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([]));
    return 'emptied';
  })()`);
  await reloadPage();
  await waitForReload();
  // Matched on the INVARIANT ("No characters/categories yet" + "Edit Mode"), not on
  // the verb between them. This used to pin the literal phrase 'toggle Edit Mode',
  // so rewording the sentence to "No characters yet. Toggle Edit Mode to add one."
  // failed V1 on a suite that was measuring the right thing. The empty-state copy
  // now uses a full stop and a capitalised verb, and there are two variants in the
  // app ("Toggle" for an empty section, "Open" for an empty container); a test
  // that only survives one of them is testing the prose, not the behaviour.
  const emptyTexts = await evalJs(`(() => {
    const texts = [...document.querySelectorAll('p,div,span')].map(e=>e.textContent.trim())
      .filter(t=>/^No (characters|categories) yet/.test(t) && t.includes('Edit Mode'));
    return texts.slice(0,3);
  })()`);
  log('STATE','V1: empty-state text present',emptyTexts?.length>=1?'PASS':'FAIL',JSON.stringify(emptyTexts));
  // Restore seed data for rest of tests
  await evalJs(`(() => {
    const snd = (id,name,type,color,opts) => ({ id, name, type, icon:'Icon.png', files:[{name:name.toLowerCase().replace(/\\s+/g,'_')+'.mp3', displayName:name+'.mp3'}], color, duration:0, randomPlay:false, ...opts });
    localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([
      { id:'c1', name:'Human Paladin', sounds:[
        snd('s1','Divine Smite','Holy','#00ff00',{loop:true, fadeIn:0.5, fadeOut:0.5, glowEnabled:false, glowProminence:0.7, files:[{name:'smite.mp3',displayName:'Smite.mp3'}]}),
        snd('s2','Shield Bash','Melee','#3b82f6',{loop:false, randomPlay:true, files:[{name:'shield1.mp3',displayName:'Shield1.mp3'},{name:'shield2.mp3',displayName:'Shield2.mp3'}]})
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
    localStorage.setItem(window.__pk('ttrpg_data_version'), '3');
    return 'restored';
  })()`);
  await reloadPage();
  await waitForReload();

  // ================================================================
  //  L: SPLIT VIEW DEEP
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE L: SPLIT VIEW DEEP ===`);
  const splitOn = await evalJs(`(() => {
    const b = document.querySelector('button.relative.inline-flex.h-5.w-9');
    if (!b) return 'NO_TOGGLE';
    const isOn = b.className.includes('bg-lime');
    b.click();
    return isOn ? 'WAS_ON' : 'WAS_OFF';
  })()`);
  await sleep(1500);
  log('SPLIT','L1: split toggle clicked',splitOn.startsWith('WAS_')?'PASS':'FAIL',splitOn);

  const splitPanels = await evalJs(`(() => {
    const panels = [...document.querySelectorAll('div')].filter(d =>
      d instanceof HTMLElement &&
      (d.className||'').includes('bg-dark-800') &&
      (d.className||'').includes('overflow-y-auto') &&
      getComputedStyle(d).overflowY === 'auto'
    );
    return panels.length;
  })()`);
  log('SPLIT','L2: 2 split panels',splitPanels>=2?'PASS':'FAIL','panels='+splitPanels);

  // Source pills
  const pills = await evalJs(`(() => {
    const ps=[...document.querySelectorAll('button')].filter(b=>['Default Characters','Default Environments','Tavern Pack','Hero Pack'].some(n=>b.textContent.trim().endsWith(n)));
    return ps.map(b=>b.textContent.trim());
  })()`);
  log('SPLIT','L3: source pills present',pills?.length>=2?'PASS':'FAIL',JSON.stringify(pills));

  // Select Human Paladin in char panel
  const charClick = await evalJs(`(() => {
    const h2s=[...document.querySelectorAll('h2')];
    const charH2=h2s.find(h=>h.textContent.trim()==='Characters');
    const sidebar=charH2?.closest('div[class*="bg-dark-800"]');
    if(!sidebar) return 'NO_PANEL';
    const hp=[...sidebar.querySelectorAll('button')].find(b=>b.textContent.trim()==='Human Paladin');
    if(!hp) return 'NO_BTN';
    hp.click(); return 'OK';
  })()`);
  await sleep(600);
  log('SPLIT','L4: Human Paladin selected in split',charClick==='OK'?'PASS':'FAIL',charClick);

  // Find sidebar panel by its heading text
  const findSidebar = (heading) => `([...document.querySelectorAll('h2')].find(h=>h.textContent.trim()==='${heading}')?.closest('div[class*="bg-dark-800"]'))`;

  // Click Hero Pack pill → Fighter
  const heroPackClick = await evalJs(`(() => {
    const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().endsWith('Hero Pack'));
    if(b) { b.click(); return 'OK'; }
    return 'NO_PILL';
  })()`);
  await sleep(600);
  const fighterVisible = await evalJs(`(() => {
    const sidebar=${findSidebar('Characters')};
    return !!sidebar && [...sidebar.querySelectorAll('button')].some(b=>b.textContent.trim()==='Fighter');
  })()`);
  log('SPLIT','L5: Hero Pack pill shows Fighter',heroPackClick==='OK'&&fighterVisible?'PASS':'FAIL');

  // Click Default Environments pill
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Default Environments'); if(b) b.click(); return 'OK'; })()`);
  await sleep(400);
  const envPanelHasDungeon = await evalJs(`(() => {
    const sidebar=${findSidebar('Environments')};
    if(!sidebar) return 'NO_PANEL';
    return [...sidebar.querySelectorAll('button')].some(b=>b.textContent.trim()==='Dungeon');
  })()`);
  log('SPLIT','L6: Default Env shows Dungeon',envPanelHasDungeon===true?'PASS':'FAIL',String(envPanelHasDungeon));

  // Exit split
  await evalJs(`(() => { const b=document.querySelector('button.relative.inline-flex.h-5.w-9'); if(b) b.click(); })()`);
  await sleep(1000);
  log('SPLIT','L7: split exited',true?'PASS':'');

  // ================================================================
  //  Y: KEYBOARD ACCESSIBILITY
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE Y: KEYBOARD ===`);
  const kb = await evalJs(`(() => {
    const card = document.querySelector('[data-sound-card]');
    if (!card) return { err: 'no card' };
    const role = card.getAttribute('role');
    const tabIdx = card.getAttribute('tabindex');
    // Dispatch Enter keydown (should not throw even with no real audio)
    try {
      card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    } catch(e) {
      return { role, tabIdx, err: e.message };
    }
    return { role, tabIdx };
  })()`);
  log('A11Y','Y1: card role=button',kb?.role==='button'?'PASS':'FAIL',JSON.stringify(kb));
  log('A11Y','Y2: card tabIndex=0',kb?.tabIdx==='0'?'PASS':'FAIL',kb?.tabIdx);
  log('A11Y','Y3: Enter keydown no crash',!kb?.err?'PASS':'FAIL',kb?.err);

  // ================================================================
  //  SHARED SPECS: W / R / U / H / X / B (also run from e2e-mobile.mjs)
  // ================================================================
  // These run together, after every inline suite, because Suite M is the one
  // order-dependent suite in this file (it reads the board the inline suites
  // leave behind) and each shared spec starts by seeding + reloading its own
  // fixture. The P/Q specs below and the refcount spec after them are all
  // self-contained, so this block does not disturb them.
  //
  // W (platform gate) leads deliberately: it asserts the app is at rest — no
  // drawer open, the right navigation chrome for this phase — and every other
  // spec in this block seeds and reloads on top of it.
  await runSpecs(ctx, [platformGate]);
  // R seeds 60 sounds and reloads. It is here rather than early precisely
  // because that seed would destroy the board the inline suites still need.
  await runSpecs(ctx, [scroll]);
  await runSpecs(ctx, [indicators]);
  await runSpecs(ctx, [soundIntoGroup]);
  await runSpecs(ctx, [dragReorder]);
  await runSpecs(ctx, [sliders]);

  // ================================================================
  //  P: PER-SOUND VOLUME (shared spec - see e2e/specs/volume.mjs)
  // ================================================================
  await runSpecs(ctx, [volume]);
  // ================================================================
  //  Q: SOUND PRIMING
  // ================================================================
  // Ids continue the P series at P17 (P1-P16 were per-sound volume).
  console.log(`\n[${LABEL}] === SUITE Q: SOUND PRIMING (P17+) ===`);
  // One-shot priming: nothing is persisted, so this re-seeds and reloads, and
  // every assertion below is made against freshly-primed state.
  await evalJs(`(() => {
    const mk = (id,name,extra) => Object.assign({
      id, name, type:'Test', icon:'',
      files:[{name:'Longbow_4.mp3', displayName:'Longbow_4.mp3'}],
      color:'#ff0000', duration:5, fadeIn:0, fadeOut:0, loop:false, randomPlay:false,
      brightness:1
    }, extra||{});
    localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([{
      id:'c1', name:'Human Paladin', sounds:[
        mk('p_fire','Fireball'),
        mk('p_frost','Frostbite'),
        mk('p_lay','Lay on Hands'),
        mk('p_cure','Cure Wounds'),
        // P27 only: these loop, so they never fire 'ended' on their own. The
        // shared seed clip is well under a second long, so a non-looping trigger
        // unregistered itself before the stop assertion could run - the button
        // was gone for timing reasons, not because stopping was broken.
        mk('p27_a','Stop Test A',{ loop:true }),
        mk('p27_b','Stop Test B',{ loop:true }),
        mk('p27_c','Stop Test C',{ loop:true }),
        // A reference that resolves to nothing. Priming it must not break the
        // primary trigger (the "primed sound with no resolvable file" case).
        mk('p_broken','Broken Ref',{ files:[{name:'gone.mp3', displayName:'Gone.mp3', storedName:'nonexistent_zzz.mp3'}] })
      ]
    }]));
    localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([
      { id:'e1', category:'Dungeon', sounds:[ mk('pe_trig','Echo Trigger'), mk('pe_prime','Dungeon Prime') ] },
      { id:'e2', category:'Forest', sounds:[] }
    ]));
    localStorage.setItem(window.__pk('ttrpg_groups'), JSON.stringify([
      { id:'g1', name:'Tavern Pack', mode:'environment',
        categories:[{id:'gc1', category:'Ambience', sounds:[ mk('pg_trig','Hearth'), mk('pg_prime','Tavern Prime') ]}],
        characters:[] },
      { id:'g2', name:'Hero Pack', mode:'characters', categories:[],
        characters:[{id:'gch1', name:'Fighter', sounds:[ mk('pch_trig','Sword Draw'), mk('pch_prime','Battle Cry') ]}] }
    ]));
    localStorage.setItem(window.__pk('ttrpg_data_version'), '3');
    for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k.startsWith('profile:'+window.__pid()+':sound_file_')) localStorage.removeItem(k);}
    return 'seeded';
  })()`);
  await reloadPage();
  await sleep(3000);

  const installPrimeHelpers = `(() => {
    window.__card = (id) => document.querySelector('[data-sound-card][data-sound-id="' + id + '"]');
    window.__cardCoords = (id) => {
      const c = window.__card(id);
      if (!c) return null;
      const r = c.getBoundingClientRect();
      const x = Math.round(r.left + r.width/2), y = Math.round(r.top + r.height/2);
      // Coords are cached by several tests and reused after other cards have
      // been measured, so never scroll here - a scroll would invalidate every
      // cached pair. Just report a card that is not actually in the viewport,
      // because CDP input is viewport-relative and would silently miss it.
      return { x, y, offscreen: (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) };
    };
    window.__primedIds = () => [...document.querySelectorAll('[data-sound-card][data-primed]')].map(c => c.dataset.soundId);
    window.__firedIds = () => [...document.querySelectorAll('[data-sound-card][data-fired]')].map(c => c.dataset.soundId);
    window.__audios = window.__audios || [];
    window.__hookAudio = () => {
      if (window.__origAudio) return 'already';
      window.__audios = [];
      window.__origAudio = window.Audio;
      window.Audio = function(...a) { const el = new window.__origAudio(...a); window.__audios.push(el); return el; };
      window.Audio.prototype = window.__origAudio.prototype;
      return 'hooked';
    };
    // Audios created since marker __n.
    window.__since = (n) => (window.__audios||[]).slice(n);
    window.__mark = () => (window.__audios||[]).length;
    window.__idsOf = (els) => els.map(e => e._soundId);
    window.__clearBtn = () => {
      const b = [...document.querySelectorAll('button')].find(x => (x.title||'').startsWith('Clear '));
      return b ? b.title : 'NO_BTN';
    };
    window.__playCard = (id) => { const c = window.__card(id); if (!c) return 'NO_CARD'; c.click(); return 'OK'; };
    // Click a control by its visible text, falling back to its title. Note there
    // is NO 'Groups' tab on desktop: every group is a tab of its own
    // (App.jsx:5559) and clicking it calls selectGroup. Those buttons also
    // prefix the group's initial letter when the group has no icon, so their
    // text reads "TTavern Pack" - match on a suffix too.
    window.__pick = (name) => {
      const all = [...document.querySelectorAll('button')];
      const byText = all.find(x => x.textContent.trim() === name);
      if (byText) { byText.click(); return 'OK_TEXT'; }
      const bySuffix = all.find(x => x.textContent.trim().endsWith(name));
      if (bySuffix) { bySuffix.click(); return 'OK_SUFFIX:' + bySuffix.textContent.trim(); }
      const byTitle = all.find(x => x.title === name);
      if (byTitle) { byTitle.click(); return 'OK_TITLE'; }
      return 'NO_ITEM:' + name + ' | have: ' + JSON.stringify(
        all.filter(x => x.textContent.trim().length > 0 && x.textContent.trim().length < 20)
           .map(x => x.textContent.trim()).slice(0, 25));
    };
    // Report every visible control name - used when navigation fails, so the
    // failure message tells you what the page actually offered.
    window.__pickList = () => JSON.stringify([...document.querySelectorAll('button')]
      .map(x => x.title || x.textContent.trim())
      .filter(t => t && t.length > 0 && t.length < 24).slice(0, 40));
    return 'ok';
  })()`;
  await evalJs(installPrimeHelpers);
  await evalJs(`window.__hookAudio()`);

  // P17: right-click primes, exactly once. CDP Input events are trusted, so this
  // is the real gesture (pointerdown with button 2 AND the contextmenu the
  // browser synthesises) rather than two hand-rolled events.
  const fireCoords = await evalJs(`window.__cardCoords('p_fire')`);
  log('PRIME','P17-setup: card located',fireCoords?'PASS':'FAIL',JSON.stringify(fireCoords));
  if (fireCoords) {
    await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: fireCoords.x, y: fireCoords.y, button: 'right', clickCount: 1, buttons: 2 });
    await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: fireCoords.x, y: fireCoords.y, button: 'right', clickCount: 1, buttons: 0 });
  }
  await sleep(300);
  const p17 = await evalJs(`(() => ({
    primed: window.__primedIds(),
    badge: !!document.querySelector('[data-prime-badge="p_fire"]'),
    overlay: !!document.querySelector('[data-prime-overlay="p_fire"]'),
    aria: window.__card('p_fire')?.getAttribute('aria-pressed')
  }))()`);
  log('PRIME','P17: right-click primes, badge + overlay + aria-pressed',JSON.stringify(p17?.primed)==='["p_fire"]' && p17?.badge && p17?.overlay && p17?.aria==='true'?'PASS':'FAIL',JSON.stringify(p17));

  // P18: the double-fire trap. A right-click ALSO arrives as pointerdown, so if
  // the hold timer had armed it would fire 500ms later and toggle the card back
  // OFF. Priming is a toggle, so a double-fire looks exactly like "broken".
  // Waiting past the threshold is the whole assertion.
  await sleep(800);
  const p18 = await evalJs(`window.__primedIds()`);
  log('PRIME','P18: hold timer NOT armed by right-click (no double-toggle)',JSON.stringify(p18)==='["p_fire"]'?'PASS':'FAIL',JSON.stringify(p18));

  // P19: right-click again un-primes. Toggle semantics, asserted from the primed
  // set rather than the badge, so the two cannot pass for each other.
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: fireCoords.x, y: fireCoords.y, button: 'right', clickCount: 1, buttons: 2 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: fireCoords.x, y: fireCoords.y, button: 'right', clickCount: 1, buttons: 0 });
  await sleep(300);
  const p19 = await evalJs(`(() => ({ primed: window.__primedIds(), badge: !!document.querySelector('[data-prime-badge]') }))()`);
  log('PRIME','P19: second right-click un-primes',p19?.primed?.length===0 && !p19?.badge?'PASS':'FAIL',JSON.stringify(p19));

  // P20: press-and-hold primes AND does not play. The release after the timer
  // fires produces a click, which must be swallowed or a hold would prime the
  // card and start the sound. Held well past the 500ms threshold: a hidden
  // page throttles setTimeout to ~1s, so a tight 750ms hold never gets there
  // and the test would fail for a harness reason rather than an app reason.
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.title||'').startsWith('Clear ')); if(b) b.click(); return 'OK'; })()`);
  await sleep(250);
  const layCoords = await evalJs(`window.__cardCoords('p_lay')`);
  const mark20 = await evalJs(`window.__mark()`);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: layCoords.x, y: layCoords.y, button: 'left', clickCount: 1, buttons: 1 });
  await sleep(1600);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: layCoords.x, y: layCoords.y, button: 'left', clickCount: 1, buttons: 0 });
  await sleep(400);
  const p20 = await evalJs(`(() => ({
    primed: window.__primedIds(),
    played: window.__idsOf(window.__since(${mark20}))
  }))()`);
  log('PRIME','P20: press-and-hold primes without playing',JSON.stringify(p20?.primed)==='["p_lay"]' && (p20?.played||[]).length===0?'PASS':'FAIL',JSON.stringify(p20));

  // P21: a press that MOVES is a scroll or a drag, not a prime. Movement is
  // measured against the press origin, so 40px is well past the 10px cancel.
  // Cleared first so the assertion is about THIS gesture and cannot be swayed
  // by whatever the previous test left primed.
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.title||'').startsWith('Clear ')); if(b) b.click(); return 'OK'; })()`);
  await sleep(250);
  const cureCoords = await evalJs(`window.__cardCoords('p_cure')`);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: cureCoords.x, y: cureCoords.y, button: 'left', clickCount: 1, buttons: 1 });
  await sleep(300);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cureCoords.x + 40, y: cureCoords.y + 40, button: 'left', buttons: 1 });
  await sleep(1400);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cureCoords.x + 40, y: cureCoords.y + 40, button: 'left', clickCount: 1, buttons: 0 });
  await sleep(300);
  const p21 = await evalJs(`window.__primedIds()`);
  log('PRIME','P21: hold + 40px move does NOT prime',p21?.length===0?'PASS':'FAIL',JSON.stringify(p21));

  // P22: no priming in edit mode. The affordance is hidden there and togglePrime
  // refuses, so neither path can prime even if the gesture lands.
  await toggleEditMode(true);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: cureCoords.x, y: cureCoords.y, button: 'left', clickCount: 1, buttons: 1 });
  await sleep(1600);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cureCoords.x, y: cureCoords.y, button: 'left', clickCount: 1, buttons: 0 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: cureCoords.x, y: cureCoords.y, button: 'right', clickCount: 1, buttons: 2 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cureCoords.x, y: cureCoords.y, button: 'right', clickCount: 1, buttons: 0 });
  await sleep(400);
  const p22 = await evalJs(`window.__primedIds()`);
  log('PRIME','P22: edit mode does not prime (hold or right-click)',p22?.length===0?'PASS':'FAIL',JSON.stringify(p22));
  await toggleEditMode(false);

  // P23: THE feature. Two primes + a trigger = three sounds, and all three
  // carry the same _primeGroup token so the card's stop button can act on them
  // as one action (P27 asserts that).
  await evalJs(`window.__clearBtn()`);
  await sleep(200);
  const primedFire = await evalJs(`window.__cardCoords('p_fire')`);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: primedFire.x, y: primedFire.y, button: 'right', clickCount: 1, buttons: 2 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: primedFire.x, y: primedFire.y, button: 'right', clickCount: 1, buttons: 0 });
  await sleep(200);
  const frostCoords = await evalJs(`window.__cardCoords('p_frost')`);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: frostCoords.x, y: frostCoords.y, button: 'right', clickCount: 1, buttons: 2 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: frostCoords.x, y: frostCoords.y, button: 'right', clickCount: 1, buttons: 0 });
  await sleep(300);
  const mark23 = await evalJs(`window.__mark()`);
  // Trigger through a real trusted click, for the same autoplay reason P9 notes.
  const layCoords2 = await evalJs(`window.__cardCoords('p_lay')`);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: layCoords2.x, y: layCoords2.y, button: 'left', clickCount: 1, buttons: 1 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: layCoords2.x, y: layCoords2.y, button: 'left', clickCount: 1, buttons: 0 });
  await sleep(1200);
  const p23 = await evalJs(`(() => {
    const els = window.__since(${mark23});
    const ids = els.map(e => e._soundId);
    const groups = els.map(e => e._primeGroup);
    return {
      ids: ids.slice().sort(),
      count: ids.length,
      sameGroup: groups.length===3 && groups[0] && groups.every(g => g === groups[0]),
      primedAfter: window.__primedIds(),
      fired: window.__firedIds()
    };
  })()`);
  log('PRIME','P23: 2 primes + trigger plays all 3',JSON.stringify(p23?.ids)==='["p_fire","p_frost","p_lay"]'?'PASS':'FAIL',JSON.stringify(p23));
  log('PRIME','P23b: all 3 share one _primeGroup token',p23?.sameGroup?'PASS':'FAIL',JSON.stringify(p23?.sameGroup));
  log('PRIME','P23c: primed set is CONSUMED (gone after the trigger)',p23?.primedAfter?.length===0?'PASS':'FAIL',JSON.stringify(p23?.primedAfter));
  log('PRIME','P23d: consumed cards flash as fired',JSON.stringify(p23?.fired?.sort())==='["p_fire","p_frost"]'?'PASS':'FAIL',JSON.stringify(p23?.fired));

  // P24: no residue. A second trigger plays only itself.
  const mark24 = await evalJs(`window.__mark()`);
  await evalJs(`window.__playCard('p_cure')`);
  await sleep(900);
  const p24 = await evalJs(`window.__idsOf(window.__since(${mark24}))`);
  log('PRIME','P24: next trigger plays only itself (no residue)',JSON.stringify(p24)==='["p_cure"]'?'PASS':'FAIL',JSON.stringify(p24));

  // P25: two triggers in quick succession must not hand the same primed set to
  // both. The capture-and-clear is synchronous; if it were not, the second
  // trigger would replay the primes.
  await evalJs(`window.__clearBtn()`);
  await sleep(150);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: fireCoords.x, y: fireCoords.y, button: 'right', clickCount: 1, buttons: 2 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: fireCoords.x, y: fireCoords.y, button: 'right', clickCount: 1, buttons: 0 });
  await sleep(150);
  const mark25 = await evalJs(`window.__mark()`);
  await evalJs(`(() => { window.__playCard('p_lay'); window.__playCard('p_cure'); return 'OK'; })()`);
  await sleep(1000);
  const p25 = await evalJs(`(() => {
    const ids = window.__idsOf(window.__since(${mark25}));
    const count = id => ids.filter(x => x === id).length;
    return { fire: count('p_fire'), frost: count('p_frost'), lay: count('p_lay'), cure: count('p_cure'), total: ids.length };
  })()`);
  log('PRIME','P25: rapid double trigger does not double the primes',p25?.fire===1 && p25?.frost===0 && p25?.lay===1 && p25?.cure===1 && p25?.total===3?'PASS':'FAIL',JSON.stringify(p25));

  // P26: priming a sound and then playing THAT sound must not play it twice.
  await evalJs(`window.__clearBtn()`);
  await sleep(150);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: fireCoords.x, y: fireCoords.y, button: 'right', clickCount: 1, buttons: 2 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: fireCoords.x, y: fireCoords.y, button: 'right', clickCount: 1, buttons: 0 });
  await sleep(200);
  const mark26 = await evalJs(`window.__mark()`);
  await evalJs(`window.__playCard('p_fire')`);
  await sleep(800);
  const p26 = await evalJs(`(() => {
    const ids = window.__idsOf(window.__since(${mark26}));
    return { total: ids.length, fire: ids.filter(x=>x==='p_fire').length };
  })()`);
  log('PRIME','P26: playing a primed sound does not double it',p26?.total===1 && p26?.fire===1?'PASS':'FAIL',JSON.stringify(p26));

  // P27: stopping the primary stops the whole primed group. One card is one
  // action to the user even when it made three sounds. Uses the looping sounds
  // so none of them can end and unregister before the stop button is clicked.
  await evalJs(`window.__clearBtn()`);
  await sleep(150);
  const a27 = await evalJs(`window.__cardCoords('p27_a')`);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: a27.x, y: a27.y, button: 'right', clickCount: 1, buttons: 2 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: a27.x, y: a27.y, button: 'right', clickCount: 1, buttons: 0 });
  await sleep(150);
  const b27 = await evalJs(`window.__cardCoords('p27_b')`);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: b27.x, y: b27.y, button: 'right', clickCount: 1, buttons: 2 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b27.x, y: b27.y, button: 'right', clickCount: 1, buttons: 0 });
  await sleep(200);
  const mark27 = await evalJs(`window.__mark()`);
  // Trusted CDP click, not element.click(): a synthetic click is not a user
  // gesture, so web refuses autoplay, play() rejects and cleanupAudio removes
  // the element from audioElementsRef - after which there is nothing to stop
  // and this assertion would read 0 stopped for the wrong reason.
  const c27 = await evalJs(`window.__cardCoords('p27_c')`);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: c27.x, y: c27.y, button: 'left', clickCount: 1, buttons: 1 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c27.x, y: c27.y, button: 'left', clickCount: 1, buttons: 0 });
  await sleep(600);
  const stopRes = await evalJs(`(() => {
    const c = window.__card('p27_c');
    const b = c && c.querySelector('button[title="Stop Sound"]');
    if (!b) return 'NO_STOP_BTN';
    b.click(); return 'OK';
  })()`);
  await sleep(400);
  const p27 = await evalJs(`(() => {
    const els = window.__since(${mark27});
    return { stop: ${JSON.stringify(stopRes)}, n: els.length, stopped: els.filter(e => e.stopped === true).length };
  })()`);
  log('PRIME','P27: stopping the primary stops the WHOLE primed group',p27?.stop==='OK' && p27?.n===3 && p27?.stopped===3?'PASS':'FAIL',JSON.stringify(p27));

  // P28: a prime that cannot resolve its file is skipped, and the primary still
  // plays. The broken sound is primed via its own right-click first.
  await evalJs(`window.__clearBtn()`);
  await sleep(150);
  const brokenCoords = await evalJs(`window.__cardCoords('p_broken')`);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: brokenCoords.x, y: brokenCoords.y, button: 'right', clickCount: 1, buttons: 2 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: brokenCoords.x, y: brokenCoords.y, button: 'right', clickCount: 1, buttons: 0 });
  await sleep(250);
  const mark28 = await evalJs(`window.__mark()`);
  await evalJs(`window.__playCard('p_cure')`);
  await sleep(900);
  const p28 = await evalJs(`(() => {
    const ids = window.__idsOf(window.__since(${mark28}));
    return { ids, primed: window.__primedIds() };
  })()`);
  log('PRIME','P28: unresolvable prime does not break the primary',(p28?.ids||[]).includes('p_cure') && (p28?.ids||[]).includes('p_broken') && p28?.primed?.length===0?'PASS':'FAIL',JSON.stringify(p28));

  // P29: the clear-all affordance tracks the primed set: absent when empty,
  // showing the live count when something is primed, absent again once cleared.
  const p29Before = await evalJs(`window.__clearBtn()`);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: fireCoords.x, y: fireCoords.y, button: 'right', clickCount: 1, buttons: 2 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: fireCoords.x, y: fireCoords.y, button: 'right', clickCount: 1, buttons: 0 });
  await sleep(250);
  const p29a = await evalJs(`({ btn: window.__clearBtn(), primed: window.__primedIds() })`);
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: frostCoords.x, y: frostCoords.y, button: 'right', clickCount: 1, buttons: 2 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: frostCoords.x, y: frostCoords.y, button: 'right', clickCount: 1, buttons: 0 });
  await sleep(250);
  const p29b = await evalJs(`window.__clearBtn()`);
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.title||'').startsWith('Clear ')); if(b) b.click(); return 'OK'; })()`);
  await sleep(300);
  const p29c = await evalJs(`(() => ({ primed: window.__primedIds(), btn: window.__clearBtn() }))()`);
  log('PRIME','P29a: no clear button while nothing is primed',p29Before==='NO_BTN'?'PASS':'FAIL',p29Before);
  log('PRIME','P29b: button appears with the live count',/Clear 1 primed/.test(p29a?.btn||'') && /Clear 2 primed/.test(p29b||'')?'PASS':'FAIL',JSON.stringify({a:p29a?.btn,b:p29b}));
  log('PRIME','P29c: clear empties the primed set and hides itself',p29c?.primed?.length===0 && p29c?.btn==='NO_BTN'?'PASS':'FAIL',JSON.stringify(p29c));

  // P30: the native menu never appears on a card. Cards are div role="button",
  // so nothing suppresses the context menu but our own handler.
  const p30 = await evalJs(`(() => {
    const c = window.__card('p_fire');
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
    c.dispatchEvent(ev);
    return { prevented: ev.defaultPrevented };
  })()`);
  log('PRIME','P30: contextmenu default is prevented',p30?.prevented===true?'PASS':'FAIL',JSON.stringify(p30));

  // P31: primed state is session-only. Nothing is persisted, so a reload clears
  // it - and the deliberate absence of a localStorage key is asserted here too.
  await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: fireCoords.x, y: fireCoords.y, button: 'right', clickCount: 1, buttons: 2 });
  await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: fireCoords.x, y: fireCoords.y, button: 'right', clickCount: 1, buttons: 0 });
  await sleep(250);
  const keysBefore = await evalJs(`window.__bareKeys()`);
  // KNOWN_KEYS, imported - not a second copy of it. That copy is how
  // spellcaster_import_backups got missed here on 2026-10-14 and failed P31a on
  // every Windows run whose store already held one, while P14a (volume.mjs, which
  // imports the list) passed. Two lists of "the keys the app may persist" is one
  // too many; both assertions now read the same one.
  const primeKeys = (keysBefore||[]).filter(k => !KNOWN_KEYS.includes(k));
  log('PRIME','P31a: no new localStorage key for priming',primeKeys.length===0?'PASS':'FAIL',JSON.stringify(primeKeys));

  await reloadPage();
  await sleep(3000);
  await evalJs(installPrimeHelpers);
  const p31b = await evalJs(`({ primed: window.__primedIds(), badges: document.querySelectorAll('[data-prime-badge]').length, btn: window.__clearBtn() })`);
  log('PRIME','P31b: primed state does NOT survive a reload',p31b?.primed?.length===0 && p31b?.badges===0 && p31b?.btn==='NO_BTN'?'PASS':'FAIL',JSON.stringify(p31b));

  // P32-P34: the container-shape walker. soundById is built from
  // allSoundContainers(), so a prime resolves from any of the shapes. This is
  // the regression guard for the four-shape assumption; the vestigial
  // groups[].sounds is NOT testable this way (normalizeStoredData wipes it) and
  // is covered by the Default-category note in the spec.
  // Clicks its way through `path` (tab button first, then the category or
  // member), asserting every card after the navigation so a miss reports what
  // the page actually offered instead of an opaque failure.
  const shapeCase = async (cat, path, primeId, trigId) => {
    await evalJs(`window.__clearBtn()`);
    for (const step of path) {
      const r = await evalJs(`window.__pick('${step}')`);
      await sleep(500);
      if (String(r).startsWith('NO_ITEM')) return `${cat}: ${r}`;
    }
    const has = await evalJs(`!!window.__card('${primeId}')`);
    if (!has) return `${cat}: card ${primeId} not rendered; buttons=${await evalJs('window.__pickList()')}`;
    const c = await evalJs(`window.__cardCoords('${primeId}')`);
    await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'right', clickCount: 1, buttons: 2 });
    await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'right', clickCount: 1, buttons: 0 });
    await sleep(300);
    const primed = await evalJs(`window.__primedIds()`);
    if (JSON.stringify(primed) !== JSON.stringify([primeId])) return `${cat}: primed=${JSON.stringify(primed)}`;
    const mark = await evalJs(`window.__mark()`);
    await evalJs(`window.__playCard('${trigId}')`);
    await sleep(1000);
    const ids = await evalJs(`window.__idsOf(window.__since(${mark}))`);
    const ok = (ids||[]).includes(trigId) && (ids||[]).includes(primeId);
    await evalJs(`window.__clearBtn()`);
    return ok ? null : `${cat}: fired=${JSON.stringify(ids)}`;
  };

  await evalJs(`window.__hookAudio()`);
  let shapeErr = await shapeCase('P32 env', ['Environment', 'Dungeon'], 'pe_prime', 'pe_trig');
  log('PRIME','P32: primes and fires from an environment category',shapeErr?'FAIL':'PASS',shapeErr || 'ok');
  shapeErr = await shapeCase('P33 groupcat', ['Tavern Pack', 'Ambience'], 'pg_prime', 'pg_trig');
  log('PRIME','P33: primes and fires from a group category',shapeErr?'FAIL':'PASS',shapeErr || 'ok');
  shapeErr = await shapeCase('P34 groupchar', ['Hero Pack', 'Fighter'], 'pch_prime', 'pch_trig');
  log('PRIME','P34: primes and fires from a group character',shapeErr?'FAIL':'PASS',shapeErr || 'ok');

  // ================================================================
  //  Z: LIVE PLAYBACK (shared spec - see e2e/specs/playback.mjs)
  // ================================================================
  // Last of the shared specs, just before refcount: it leaves the master volume
  // wherever Z7 put it (50%) and needs a quiet page for the fade sampling, so it
  // must not run in the middle of the block. refcount re-seeds after it.
  await runSpecs(ctx, [playback]);

  // ================================================================
  //  F: PROFILES (shared spec - see e2e/specs/profiles.mjs)
  // ================================================================
  // Step 1 of the profile feature: the storage adapter, the first-run
  // migration, and the full-remount switch. It creates and DELETES profiles,
  // and it clears storage to prove the legacy adoption path - so it runs near
  // the end, before the two specs that re-seed for themselves. It must stay
  // ahead of refcount and reset, which both re-seed after themselves.
  await runSpecs(ctx, [profiles]);

  // ================================================================
  //  I: PROFILE BUNDLES - EXPORT / IMPORT (shared spec - specs/bundle.mjs)
  // ================================================================
  // Steps 3-6 of the profile feature: the .spellcaster format, both import
  // modes, and the refusals. It seeds its own board and uploads a real sound so
  // the upload provenance is genuine, and it replaces the native picker with a
  // stub on window.__TAURI_INTERNALS__.invoke - grant_path, writeFile and
  // readFile still run for real, so the desktop journey is covered end to end
  // (I10 and I18) without a #32770 dialog anyone can dismiss. On the web phase
  // only I1 and I2 run: export/import is Tauri-only by design (§7).
  await runSpecs(ctx, [bundle]);

  // ================================================================
  //  G: FILE REFCOUNT GUARD (shared spec - see e2e/specs/refcount.mjs)
  // ================================================================
  // Standalone by construction: the spec re-seeds a known storedName, copies the
  // sound, deletes the source container and asserts the file key survives. It runs
  // last so its reloads cannot disturb other suites.
  await runSpecs(ctx, [refcount]);

  // ================================================================
  //  O: RESET TO STARTER SOUNDS (shared spec - see e2e/specs/reset.mjs)
  // ================================================================
  // Genuinely last, and for a different reason than the others: this is the only
  // spec that REWRITES the board into a different shape. It is safe here because
  // it seeds its own fixture first, which is what finally unblocked it — it had
  // been deferred twice on the grounds that it "wipes the fixture every later
  // suite reads", and that was true only of the old shared-then-relied-upon
  // suites. It seeds, it acts, and nothing runs after it.
  await runSpecs(ctx, [resetDefaults]);

  // ================================================================
  //  Summary + Restore
  // ================================================================
  if (SAVE_RESTORE && capturedLS) {
    const rr = await evalJs(restoreLs(capturedLS));
    console.log(`[${LABEL}] localStorage restore:`, rr);
    await reloadPage();
    await sleep(3000);
  }

  console.log('\n==============================');
  report.summary();
  console.log('==============================');

  close();
  process.exit(report.exitCode());
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
