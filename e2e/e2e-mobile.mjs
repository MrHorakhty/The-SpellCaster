// Mobile E2E suite — tests mobile-specific UI of The SpellCaster.
// Covers: rail navigation, drawer open/close, drawer tab switching, sound grid
// rendering, edit mode via grid button, add/edit/delete sound via drawer,
// character CRUD via drawer, group CRUD via drawer, empty states, settings.
// Env: CDP_PORT, LABEL, SAVE_RESTORE ('1'), EXPECT_TAURI ('1')
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEBUG_PORT = process.env.CDP_PORT || 9224;
const LABEL = process.env.LABEL || 'MOBILE';
const SAVE_RESTORE = process.env.SAVE_RESTORE === '1';
const WAV = join(dirname(fileURLToPath(import.meta.url)), 'e2e_silence.wav');

// 20s silent WAV generator
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
let seq = 0;
const pending = new Map();

async function main() {
  let page;
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      const targets = await res.json();
      page = targets?.find(t => t.type === 'page' && (t.url || '').startsWith('http'));
      if (page) break;
    } catch (e) {}
    await sleep(500);
  }
  if (!page) { console.error(`[${LABEL}] NO APP PAGE on :${DEBUG_PORT}`); process.exit(1); }
  console.log(`[${LABEL}] page: ${page.url}`);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const cdp = (method, params = {}) => new Promise(resolve => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evalJs = async (expression) => {
    const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) return { __error: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text };
    return r.result?.result?.value;
  };

  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('DOM.enable');

  const allResults = [];
  let pass = 0, fail = 0, warn = 0;
  const log = (cat, name, status, detail) => {
    const line = `[${cat}] ${status} ${name}: ${detail || ''}`;
    allResults.push(line);
    console.log(line);
    if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  };
  const run = async (cat, name, fn) => {
    const res = await fn();
    if (res && res.__error) log(cat, name, 'FAIL', res.__error);
    return res;
  };

  let capturedLS = null;
  if (SAVE_RESTORE) {
    const cap = await evalJs(`(() => { const o = {}; for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); o[k]=localStorage.getItem(k);} return JSON.stringify(o); })()`);
    if (cap && cap.length < 3000000) { capturedLS = JSON.parse(cap); console.log(`[${LABEL}] captured ${Object.keys(capturedLS).length} localStorage keys`); }
    else console.log(`[${LABEL}] WARNING: localStorage capture too large / failed (${(cap||'').length}b) -- no restore`);
  }

  // Seed: same as e2e-full.mjs
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
    localStorage.setItem('ttrpg_themes', JSON.stringify([]));
    localStorage.setItem('ttrpg_data_version', '3');
    localStorage.removeItem('backgroundSettings');
    localStorage.removeItem('boxSize');
    for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k.startsWith('sound_file_')) localStorage.removeItem(k);}
    return 'seeded';
  })();`);
  console.log(`[${LABEL}] SEED applied`);
  await cdp('Page.reload', { ignoreCache: true });
  await sleep(3500);

  // Instrument playback
  await run('PLAY', 'D0: instrument audio', () => evalJs(`(() => {
    window.__e2eAudio = [];
    const op = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function(...a){ window.__e2eAudio.push(this); return op.apply(this, a); };
    return 'instrumented';
  })()`));

  // Set up page-level helpers
  await run('NAV', 'helpers', () => evalJs(`(() => {
    window.__clickText = (t) => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===t); if(!b) return 'NO:'+t; b.click(); return 'OK'; };
    window.__findText = (t) => [...document.querySelectorAll('button')].find(x=>x.textContent.trim()===t);
    window.__setInput = (name, val) => { const el=document.querySelector('input[name="'+name+'"]'); if(!el) return 'NO:'+name; const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(el, val); el.dispatchEvent(new Event('input',{bubbles:true})); return 'OK'; };
    return 'ok';
  })()`));

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

  // Helper: submit modal (bg-lime-600 submit button)
  async function submitModal(btnText) {
    return evalJs(`(() => {
      const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='${btnText}' && x.type==='submit' && /bg-lime-600/.test(x.className));
      if(!b) return 'NO_SUBMIT:${btnText}';
      if(b.disabled) return 'DISABLED';
      b.click();
      return 'OK';
    })()`);
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
    const state = await evalJs(`!!document.querySelector('button[title="Exit Edit Mode"]')`);
    if (state === on) return;
    const btn = on ? 'Enter Edit Mode' : 'Exit Edit Mode';
    await evalJs(`document.querySelector('button[title="${btn}"]')?.click()`);
    await sleep(400);
  }

  async function waitForReload(ms = 3500) { await sleep(ms); }

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
  //  R: SOUND GRID RENDERING
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE R: SOUND GRID ===`);
  const suiteR = await evalJs(`(() => {
    const r = [];
    const log = (cat,n,s,d) => r.push({cat,n,s,d:d||''});
    const cards = [...document.querySelectorAll('[data-sound-card]')];
    log('GRID','R1: cards rendered',cards.length>=3?'PASS':'FAIL','count='+cards.length);
    const smite = cards.find(c=>c.textContent.includes('Smite'));
    log('GRID','R2: Smite card present',!!smite?'PASS':'FAIL');
    const shield = cards.find(c=>c.textContent.includes('Shield Bash'));
    log('GRID','R3: Shield Bash card present',!!shield?'PASS':'FAIL');
    const loopIcon = smite?.querySelector('[title="Looping enabled"]');
    log('GRID','R4: Smite loop icon',!!loopIcon?'PASS':'FAIL');
    const glow = smite?.style.boxShadow && smite.style.boxShadow !== 'none' && smite.style.boxShadow !== '';
    log('GRID','R5: Smite glow',!!glow?'PASS':'FAIL',smite?.style.boxShadow?.slice(0,30));
    const allRoleBtn = cards.every(c=>c.getAttribute('role')==='button');
    log('GRID','R6: all cards role=button',allRoleBtn?'PASS':'FAIL');
    return r;
  })()`);
  if (suiteR?.__error) log('GRID','Suite R','FAIL',suiteR.__error); else for (const r of suiteR) log(r.cat,r.n,r.s,r.d);

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
    log('SOUND','A2: WAV uploaded',uploaded?'PASS':'FAIL');
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

    // Edit character via drawer button
    const editCharClick = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b=[...d.querySelectorAll('button[title="Edit Character"]')].find(b=>b.closest('div')?.textContent.includes('Rogue'));
      if(!b) return 'NO_EDIT_BTN';
      b.click(); return 'OK';
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
    }

    // Delete character via drawer button
    const delCharClick = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b=[...d.querySelectorAll('button[title="Delete Character"]')].find(b=>b.closest('div')?.textContent.includes('Rogue'));
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
  await evalJs(`(() => { const d=document.querySelector('[role="dialog"][aria-label="Navigation"]'); const b=[...d.querySelectorAll('button')].find(x=>x.textContent.trim()==='Forest'); if(b) b.click(); return 'OK'; })()`);
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

    // Edit category
    const editCatClick = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b=[...d.querySelectorAll('button[title="Edit Category"]')].find(b=>b.closest('div')?.textContent.includes('Cave'));
      if(!b) return 'NO';
      b.click(); return 'OK';
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
    }

    // Delete category
    const delCatClick = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b=[...d.querySelectorAll('button[title="Delete Category"]')].find(b=>b.closest('div')?.textContent.includes('Crystal'));
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
    const b = [...d.querySelectorAll('button')].find(x=>x.textContent.trim()==='Tavern Pack');
    if(b) b.click();
    return 'OK';
  })()`);
  await sleep(300);

  const addGrpClick = await evalJs(`window.__clickText('Add Group')`);
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

    // Click into Dragon Lore in drawer
    await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b = [...d.querySelectorAll('button')].find(x=>x.textContent.trim()==='Dragon Lore');
      if(b) b.click(); return 'OK';
    })()`);
    await sleep(400);

    // Edit group name
    const editGrpClick = await evalJs(`(() => {
      const b=document.querySelector('button[title="Edit Group"]');
      if(!b) return 'NO';
      b.click(); return 'OK';
    })()`);
    await sleep(500);
    log('GRP','G4: edit group modal opened',editGrpClick==='OK'?'PASS':'FAIL',editGrpClick);

    if (editGrpClick === 'OK') {
      await evalJs(`window.__setInput('name','Dragon Lore Reborn')`);
      await submitModal('Save Changes');
      await sleep(800);
      const grpEdited = await evalJs(`(() => {
        const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]');
        return { hasOld:g.some(x=>x.name==='Dragon Lore'), hasNew:g.some(x=>x.name==='Dragon Lore Reborn') };
      })()`);
      log('GRP','G5: group renamed',grpEdited?.hasNew&&!grpEdited?.hasOld?'PASS':'FAIL',JSON.stringify(grpEdited));
    }

    // Mode toggle: env → characters
    const toggleClick = await evalJs(`(() => {
      const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Character Pack');
      if(b) { b.click(); return 'OK'; }
      return 'NO';
    })()`);
    await sleep(500);
    const conv1 = await evalJs(`(() => {
      const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Dragon Lore Reborn');
      return { mode:g?.mode, cats:g?.categories?.length, chars:g?.characters?.length };
    })()`);
    log('GRP','G6: mode=characters after toggle',conv1?.mode==='characters'?'PASS':'FAIL',JSON.stringify(conv1));

    // Toggle back
    await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Environment Pack'); if(b) b.click(); return 'OK'; })()`);
    await sleep(500);
    const conv2 = await evalJs(`(() => {
      const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Dragon Lore Reborn');
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
      const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Dragon Lore Reborn');
      return g?.categories?.some(c=>c.category==='Rumors');
    })()`);
    log('GRP','G8: group category added',grpCatAdded===true?'PASS':'FAIL');

    // Delete group category
    const delGrpCat = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b=[...d.querySelectorAll('button[title="Delete Category"]')].find(b=>b.closest('div')?.textContent.includes('Rumors'));
      if(!b) return 'NO';
      b.click(); return 'OK';
    })()`);
    await sleep(400);
    if (delGrpCat === 'OK') {
      await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
      await sleep(700);
    }
    const grpCatDeleted = await evalJs(`(() => {
      const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Dragon Lore Reborn');
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
      const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Dragon Lore Reborn');
      return g?.characters?.some(c=>c.name==='Bard');
    })()`);
    log('GRP','G10: group character added',grpCharAdded===true?'PASS':'FAIL');

    // Delete group character
    const delGrpChar = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b=[...d.querySelectorAll('button[title="Delete Character"]')].find(b=>b.closest('div')?.textContent.includes('Bard'));
      if(!b) return 'NO';
      b.click(); return 'OK';
    })()`);
    await sleep(400);
    if (delGrpChar === 'OK') {
      await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
      await sleep(700);
    }
    const grpCharDeleted = await evalJs(`(() => {
      const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Dragon Lore Reborn');
      return g?.characters?.some(c=>c.name==='Bard');
    })()`);
    log('GRP','G11: group character deleted',grpCharDeleted===false?'PASS':'FAIL');

    // Delete group
    const delGrpClick = await evalJs(`(() => {
      const d = document.querySelector('[role="dialog"][aria-label="Navigation"]');
      const b=[...d.querySelectorAll('button[title="Delete Group: Dragon Lore Reborn"]')][0];
      if(!b) return 'NO';
      b.click(); return 'OK';
    })()`);
    await sleep(400);
    if (delGrpClick === 'OK') {
      await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete'); if(b) b.click(); return 'OK'; })()`);
      await sleep(700);
    }
    const grpDeleted = await evalJs(`JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').some(g=>g.name==='Dragon Lore Reborn')`);
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
  const emptyTexts = await evalJs(`(() => {
    const texts = [...document.querySelectorAll('p,div,span')].map(e=>e.textContent.trim()).filter(t=>t.includes('No ') && t.includes('toggle Edit Mode'));
    return texts.slice(0,3);
  })()`);
  log('STATE','V1: empty-state text present',emptyTexts?.length>=1?'PASS':'FAIL',JSON.stringify(emptyTexts));
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
  //  Summary + Restore
  // ================================================================
  if (SAVE_RESTORE && capturedLS) {
    const rr = await evalJs(`(() => { const o = ${JSON.stringify(capturedLS)}; localStorage.clear(); for (const k in o) localStorage.setItem(k, o[k]); return 'restored'; })()`);
    console.log(`[${LABEL}] localStorage restore:`, rr);
    await cdp('Page.reload', { ignoreCache: true });
    await sleep(3000);
  }

  console.log('\n==============================');
  console.log(`[${LABEL}] MOBILE E2E SUMMARY: PASS=${pass}  FAIL=${fail}  WARN=${warn}  TOTAL=${pass+fail+warn}`);
  console.log('==============================');

  ws.close();
  process.exit(fail > 0 ? 2 : (warn > 0 ? 1 : 0));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
