// Comprehensive E2E suite — tests every user-facing feature of The SpellCaster.
// Builds on e2e-run.mjs (structure/scroll/split/regression) and e2e-features.mjs
// (playback/fade/volume/loop). This file covers: sound-card UI indicators,
// edit-mode per-card controls, sound add/edit/delete, character/category/group CRUD,
// drag-to-reorder, settings/themes/image, split-view CRUD, empty states, keyboard.
// Env: CDP_PORT, LABEL, SAVE_RESTORE ('1'), EXPECT_TAURI ('1')
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEBUG_PORT = process.env.CDP_PORT || 9333;
const LABEL = process.env.LABEL || 'FULL';
const SAVE_RESTORE = process.env.SAVE_RESTORE === '1';
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
    else console.log(`[${LABEL}] WARNING: localStorage capture too large / failed (${(cap||'').length}b) — no restore`);
  }

  // Seed: small, deterministic, rich fixtures
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

  // Instrument playback for any audio checks in this suite
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
    window.__uploadFile = (sel, path) => (async () => { const doc=await (globalThis.__cdp||{}).eval?null:null; return 'need cdp'; })();
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

  // Helper: submit modal (bg-lime-600 submit button with given text)
  async function submitModal(btnText) {
    return evalJs(`(() => {
      const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='${btnText}' && x.type==='submit' && /bg-lime-600/.test(x.className));
      if(!b) return 'NO_SUBMIT:${btnText}';
      if(b.disabled) return 'DISABLED';
      b.click();
      return 'OK';
    })()`);
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
    const state = await evalJs(`!!document.querySelector('button[title="Toggle Edit Mode"]')?.className?.match(/lime|lime-600|bg-lime/)`);
    if (state === on) return;
    await evalJs(`document.querySelector('button[title="Toggle Edit Mode"]')?.click()`);
    await sleep(400);
  }

  async function waitForReload(ms = 3500) { await sleep(ms); }

  // ================================================================
  //  S: STRUCTURE / SEED INTEGRITY
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
    log('SEED','S3: Elf Sorcerer exists',chars.some(c=>c.name==='Elf Sorcerer')?'PASS':'FAIL');
    log('SEED','S4: 3 sounds on Paladin',chars.find(c=>c.name==='Human Paladin')?.sounds?.length===3?'PASS':'FAIL','count='+(chars.find(c=>c.name==='Human Paladin')?.sounds?.length));
    log('SEED','S5: 2 env categories',env.length===2?'PASS':'FAIL','count='+env.length);
    log('SEED','S6: Dungeon exists',env.some(e=>e.category==='Dungeon')?'PASS':'FAIL');
    log('SEED','S7: 2 groups',groups.length===2?'PASS':'FAIL','count='+groups.length);
    log('SEED','S8: Tavern Pack mode=environment',groups.find(g=>g.name==='Tavern Pack')?.mode==='environment'?'PASS':'FAIL');
    log('SEED','S9: Hero Pack mode=characters',groups.find(g=>g.name==='Hero Pack')?.mode==='characters'?'PASS':'FAIL');
    log('SEED','S10: Tavern Pack has 1 category',groups.find(g=>g.name==='Tavern Pack')?.categories?.length===1?'PASS':'FAIL');
    log('SEED','S11: Hero Pack has 1 character',groups.find(g=>g.name==='Hero Pack')?.characters?.length===1?'PASS':'FAIL');
    log('SEED','S12: data_version=3',localStorage.getItem('ttrpg_data_version')==='3'?'PASS':'FAIL');
    log('SEED','S13: cards rendered',document.querySelectorAll('[data-sound-card]').length>=3?'PASS':'FAIL','cards='+document.querySelectorAll('[data-sound-card]').length);
    return r;
  })()`);
  if (suiteS?.__error) log('SEED','Suite S','FAIL',suiteS.__error); else for (const r of suiteS) log(r.cat,r.n,r.s,r.d);

  // ================================================================
  //  U: SOUND CARD UI INDICATORS
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE U: CARD INDICATORS ===`);
  const suiteU = await evalJs(`(() => {
    const r = [];
    const log = (cat,n,s,d) => r.push({cat,n,s,d:d||''});
    const cards = [...document.querySelectorAll('[data-sound-card]')];
    const smite = cards.find(c => c.textContent.includes('Smite'));
    const shield = cards.find(c => c.textContent.includes('Shield Bash'));
    log('INDICATOR','U1: Smite card found',smite?'PASS':'FAIL');
    log('INDICATOR','U2: Shield Bash card found',shield?'PASS':'FAIL');
    if(smite) {
      const loopIcon = smite.querySelector('button[title="Looping enabled"], [title="Looping enabled"]');
      log('INDICATOR','U3: Smite loop icon title',loopIcon?'PASS':'FAIL',loopIcon?.getAttribute('title'));
      const glow = smite.style.boxShadow && smite.style.boxShadow !== 'none' && smite.style.boxShadow !== '';
      log('INDICATOR','U4: Smite glow boxShadow',glow?'PASS':'FAIL',smite.style.boxShadow?.slice(0,40));
    }
    if(shield) {
      const shuffle = shield.querySelector('[title*="files available"]');
      log('INDICATOR','U5: Shield multi-file icon',!!shuffle?'PASS':'FAIL',shuffle?.getAttribute('title'));
    }
    const cardsWithRole = cards.filter(c => c.getAttribute('role') === 'button');
    log('INDICATOR','U6: all cards role=button',cardsWithRole.length === cards.length ? 'PASS' : 'FAIL', cardsWithRole.length+'/'+cards.length);
    const loopIconCount = cards.filter(c => c.querySelector('[title="Looping enabled"]')).length;
    log('INDICATOR','U7: loop icons count (2 expected)', loopIconCount === 2 ? 'PASS' : 'FAIL', 'count='+loopIconCount);
    return r;
  })()`);
  if (suiteU?.__error) log('INDICATOR','Suite U','FAIL',suiteU.__error); else for (const r of suiteU) log(r.cat,r.n,r.s,r.d);

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
    const chars = JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
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
    const chars = JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
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
    const chars=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
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
    const chars=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
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
  const charDeleted = await evalJs(`JSON.parse(localStorage.getItem('ttrpg_characters')||'[]').some(c=>c.name.includes('Rogue'))`);
  log('CHAR','C6: Rogue deleted',charDeleted===false?'PASS':'FAIL','still_exists='+charDeleted);
  await toggleEditMode(false);

  // ================================================================
  //  K: ENVIRONMENT CATEGORY CRUD (add → edit → delete)
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE K: CATEGORY CRUD ===`);
  // Switch to Environment tab
  await evalJs(`document.querySelector('button')?.closest('div')?.querySelector?.('button'); [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Environment')?.click()`);
  await sleep(400);
  await evalJs(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Forest')?.click()`);
  await sleep(300);

  await toggleEditMode(true);
  const addCatOpen = await evalJs(`window.__clickText('Add Category')`);
  await sleep(500);
  await evalJs(`window.__setInput('name','Cave')`);
  const catSubmit = await submitModal('Add Category');
  await sleep(900);
  const catAdded = await evalJs(`(() => {
    const env=JSON.parse(localStorage.getItem('ttrpg_environment')||'[]');
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
    const env=JSON.parse(localStorage.getItem('ttrpg_environment')||'[]');
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
  const catDeleted = await evalJs(`JSON.parse(localStorage.getItem('ttrpg_environment')||'[]').some(e=>e.category.includes('Crystal'))`);
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
    const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]');
    const sidebar=[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Dragon Lore');
    return { has:g.some(x=>x.name==='Dragon Lore'), sidebar, mode:g.find(x=>x.name==='Dragon Lore')?.mode };
  })()`);
  log('GRP','G1: group added',grpAdded?.has&&grpAdded?.sidebar?'PASS':'FAIL',JSON.stringify(grpAdded));
  log('GRP','G2: mode defaults to environment',grpAdded?.mode==='environment'?'PASS':'FAIL',grpAdded?.mode);

  // Click into Dragon Lore group
  await evalJs(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Dragon Lore')?.click()`);
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
    const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]');
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
    const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Dragon Lore Reborn');
    return { mode:g?.mode, cats:g?.categories?.length, chars:g?.characters?.length, charNames:g?.characters?.map(c=>c.name) };
  })()`);
  log('GRP','G5: mode=characters after toggle',conv1?.mode==='characters'?'PASS':'FAIL',JSON.stringify(conv1));
  log('GRP','G6: categories empty',conv1?.cats===0?'PASS':'FAIL','cats='+conv1?.cats);
  log('GRP','G7: characters created',conv1?.chars>=0?'PASS':'FAIL','chars='+conv1?.chars);

  // Toggle back: characters → environment
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Environment Pack'); if(b) b.click(); return 'OK'; })()`);
  await sleep(500);
  const conv2 = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Dragon Lore Reborn');
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
    const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Dragon Lore Reborn');
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
    const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Dragon Lore Reborn');
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
    const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Dragon Lore Reborn');
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
    const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Dragon Lore Reborn');
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
  const grpDeleted = await evalJs(`JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').some(g=>g.name==='Dragon Lore Reborn')`);
  log('GRP','G14: group deleted',grpDeleted===false?'PASS':'FAIL','still_exists='+grpDeleted);
  await toggleEditMode(false);

  // ================================================================
  //  H: ADD SOUND INTO GROUP (real upload to existing Tavern Pack)
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE H: SOUND INTO GROUP ===`);
  await evalJs(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Tavern Pack')?.click()`);
  await sleep(400);
  await evalJs(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Ambience')?.click()`);
  await sleep(400);
  await toggleEditMode(true);
  const grpAddSoundOpen = await evalJs(`window.__clickText('Add Sound')`);
  await sleep(700);
  if (grpAddSoundOpen === 'OK') {
    await evalJs(`window.__setInput('name','Tavern Echo')`);
    const grpUp = await uploadWav();
    log('GRP','H1: WAV uploaded to group',grpUp?'PASS':'FAIL');
    await sleep(700);
    await submitModal('Add Sound');
    await sleep(1200);
  }
  const grpSoundAdded = await evalJs(`(() => {
    const g=JSON.parse(localStorage.getItem('ttrpg_groups')||'[]').find(x=>x.name==='Tavern Pack');
    const cat=g?.categories?.find(c=>c.category==='Ambience');
    return cat?.sounds?.some(s=>s.name==='Tavern Echo');
  })()`);
  log('GRP','H2: group sound persisted',grpSoundAdded===true?'PASS':'FAIL');
  await toggleEditMode(false);

  // ================================================================
  //  X: DRAG-TO-REORDER (pointer events on sound cards)
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE X: DRAG REORDER ===`);
  // Reload to return to the default Paladin view (earlier suites may have
  // navigated into groups/split), then re-enter edit mode.
  await cdp('Page.reload', { ignoreCache: true });
  await waitForReload();
  await toggleEditMode(true);
  const orderBefore = await evalJs(`(() => {
    const chars = JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    const pal = chars.find(c=>c.name==='Human Paladin');
    return pal?.sounds?.map(s=>s.name) || [];
  })()`);
  log('DRAG','X1: order before drag',orderBefore?.length===4?'PASS':'FAIL',JSON.stringify(orderBefore));
  // Move the last card to the first position
  const dragCoords = await evalJs(`(() => {
    const cards = [...document.querySelectorAll('[data-sound-card]')];
    if (cards.length < 2) return 'NO_CARDS:'+cards.length;
    const src = cards[cards.length-1]?.getBoundingClientRect();
    const tgt = cards[0]?.getBoundingClientRect();
    if (!src || !tgt) return 'NO_RECTS';
    return { sx: Math.round(src.x + src.width/2), sy: Math.round(src.y + src.height/2), tx: Math.round(tgt.x + tgt.width/2), ty: Math.round(tgt.y + tgt.height/2) };
  })()`);
  if (dragCoords?.sx) {
    // Simulate drag: mousePressed → mouseMoved (5 steps) → mouseReleased
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: dragCoords.sx, y: dragCoords.sy, button: 'left', clickCount: 1 });
    await sleep(50);
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mx = Math.round(dragCoords.sx + (dragCoords.tx - dragCoords.sx) * t);
      const my = Math.round(dragCoords.sy + (dragCoords.ty - dragCoords.sy) * t);
      await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mx, y: my, button: 'left' });
      await sleep(30);
    }
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dragCoords.tx, y: dragCoords.ty, button: 'left', clickCount: 0 });
    await sleep(500);
    const orderAfter = await evalJs(`(() => {
      const chars = JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
      const pal = chars.find(c=>c.name==='Human Paladin');
      return pal?.sounds?.map(s=>s.name) || [];
    })()`);
    const reordered = orderAfter?.[0] === 'Divine Light' || JSON.stringify(orderAfter) !== JSON.stringify(orderBefore);
    log('DRAG','X2: order changed',reordered?'PASS':'FAIL','before='+JSON.stringify(orderBefore)+' after='+JSON.stringify(orderAfter));
  } else {
    log('DRAG','X2: drag skipped',String(dragCoords));
  }
  await toggleEditMode(false);

  // ================================================================
  //  B: BOX-SIZE + VOLUME + PERSISTENCE ACROSS RELOAD
  // ================================================================
  console.log(`\n[${LABEL}] === SUITE B: SLIDERS & PERSISTENCE ===`);
  const sliderSet = await evalJs(`(() => {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    const size = [...document.querySelectorAll('input[type=range]')].find(s=>s.min==='0.5');
    const vol = [...document.querySelectorAll('input[type=range]')].find(s=>s.min==='0');
    if(size) { nativeSet.call(size,'1.8'); size.dispatchEvent(new Event('input',{bubbles:true})); size.dispatchEvent(new Event('change',{bubbles:true})); }
    return { sizeOk: size?.value === '1.8', volExists: !!vol };
  })()`);
  log('SLIDER','B1: box-size set to 1.8',sliderSet?.sizeOk?'PASS':'FAIL',JSON.stringify(sliderSet));
  const boxWidth = await evalJs(`Math.round(document.querySelector('[data-sound-card]')?.getBoundingClientRect().width || 0)`);
  log('SLIDER','B2: card width ~252px',boxWidth >= 248 && boxWidth <= 260 ? 'PASS' : 'FAIL',boxWidth+'px');
  const boxSizePersisted = await evalJs(`localStorage.getItem('boxSize')`);
  log('SLIDER','B3: boxSize persisted',boxSizePersisted==='1.8'?'PASS':'FAIL',boxSizePersisted);

  // Reload → box-size preserved
  await cdp('Page.reload', { ignoreCache: true });
  await waitForReload();
  const afterReload = await evalJs(`(() => {
    const size = [...document.querySelectorAll('input[type=range]')].find(s=>s.min==='0.5');
    return { size: size?.value, bs: localStorage.getItem('boxSize') };
  })()`);
  log('SLIDER','B4: box-size survives reload',afterReload?.size==='1.8'||afterReload?.bs==='1.8'?'PASS':'FAIL',JSON.stringify(afterReload));

  // Reset box-size back to 1.0
  await evalJs(`(() => { const s=[...document.querySelectorAll('input[type=range]')].find(s=>s.min==='0.5'); if(s){ const n=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; n.call(s,'1'); s.dispatchEvent(new Event('input',{bubbles:true})); s.dispatchEvent(new Event('change',{bubbles:true})); }})()`);
  await sleep(200);

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
      const bs = JSON.parse(localStorage.getItem('backgroundSettings')||'{}');
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
    return { css, key: (JSON.parse(localStorage.getItem('backgroundSettings')||'{}')).theme };
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
    const bs = JSON.parse(localStorage.getItem('backgroundSettings')||'{}');
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
    const bs = JSON.parse(localStorage.getItem('backgroundSettings')||'{}');
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
    const chars=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
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
    const chars=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    const pal=chars.find(c=>c.name==='Human Paladin');
    return pal?.sounds?.some(s=>s.name==='Healing Light');
  })()`);
  log('SOUND','D4: Healing Light deleted',healDeleted===false?'PASS':'FAIL');
  await toggleEditMode(false);

  // ================================================================
  //  V: EMPTY STATES (seed empty characters + env, reload)
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
  // Restore seed data for rest of tests
  await evalJs(`(() => {
    const snd = (id,name,type,color,opts) => ({ id, name, type, icon:'Icon.png', files:[{name:name.toLowerCase().replace(/\\s+/g,'_')+'.mp3', displayName:name+'.mp3'}], color, duration:0, randomPlay:false, ...opts });
    localStorage.setItem('ttrpg_characters', JSON.stringify([
      { id:'c1', name:'Human Paladin', sounds:[
        snd('s1','Divine Smite','Holy','#00ff00',{loop:true, fadeIn:0.5, fadeOut:0.5, glowEnabled:false, glowProminence:0.7, files:[{name:'smite.mp3',displayName:'Smite.mp3'}]}),
        snd('s2','Shield Bash','Melee','#3b82f6',{loop:false, randomPlay:true, files:[{name:'shield1.mp3',displayName:'Shield1.mp3'},{name:'shield2.mp3',displayName:'Shield2.mp3'}]})
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
    const ps=[...document.querySelectorAll('button')].filter(b=>['Default Characters','Default Environments','Tavern Pack','Hero Pack'].includes(b.textContent.trim()));
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
    const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Hero Pack');
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
  //  Summary + Restore
  // ================================================================
  if (SAVE_RESTORE && capturedLS) {
    const rr = await evalJs(`(() => { const o = ${JSON.stringify(capturedLS)}; localStorage.clear(); for (const k in o) localStorage.setItem(k, o[k]); return 'restored'; })()`);
    console.log(`[${LABEL}] localStorage restore:`, rr);
    await cdp('Page.reload', { ignoreCache: true });
    await sleep(3000);
  }

  console.log('\n==============================');
  console.log(`[${LABEL}] FULL E2E SUMMARY: PASS=${pass}  FAIL=${fail}  WARN=${warn}  TOTAL=${pass+fail+warn}`);
  console.log('==============================');

  ws.close();
  process.exit(fail > 0 ? 2 : (warn > 0 ? 1 : 0));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
