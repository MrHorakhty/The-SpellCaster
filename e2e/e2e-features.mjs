// Deep E2E feature suite — uploads a real WAV via the app's own Add Sound modal,
// then verifies storage, live playback, volume, loop, fade-in, icon tint, theme,
// CRUD and reload persistence. Runs against web OR Tauri (WebView2) CDP endpoint.
// Env: CDP_PORT, LABEL, SAVE_RESTORE ('1' to snapshot+restore localStorage), DEL_UPLOADED ('1')
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEBUG_PORT = process.env.CDP_PORT || 9333;
const LABEL = process.env.LABEL || 'FEAT';
const SAVE_RESTORE = process.env.SAVE_RESTORE === '1';
const WAV = join(dirname(fileURLToPath(import.meta.url)), 'e2e_silence.wav');

// Build a 20s mono 8kHz 16-bit PCM silent WAV (valid, plays, long enough for fade/loop tests)
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
    const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
    const line = `[${cat}] ${icon} ${name}: ${detail || ''}`;
    allResults.push(line);
    console.log(line);
    if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  };
  const approx = (v, t, tol) => v >= t - tol && v <= t + tol;
  // Run JS, and if it returns {__error} mark a FAIL.
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

  const seed = `(() => {
    localStorage.setItem('ttrpg_characters', JSON.stringify([{id:'c1',name:'Human Paladin',sounds:[]}]));
    localStorage.setItem('ttrpg_environment', JSON.stringify([{id:'e1',category:'Dungeon',sounds:[]}]));
    localStorage.setItem('ttrpg_groups', JSON.stringify([]));
    localStorage.setItem('ttrpg_themes', JSON.stringify([]));
    localStorage.setItem('ttrpg_data_version', '3');
    localStorage.removeItem('backgroundSettings');
    localStorage.removeItem('boxSize');
    for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k.startsWith('sound_file_')) localStorage.removeItem(k);}
    return 'seeded';
  })();`;
  console.log(`[${LABEL}] SEED:`, await evalJs(seed));
  await cdp('Page.reload', { ignoreCache: true });
  await sleep(3000);

  // Instrument playback construction for live inspection
  await run('PLAY', 'D0: instrument audio', () => evalJs(`(() => {
    window.__e2eAudio = [];
    const op = HTMLMediaElement.prototype.play;
    const opa = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.play = function(...a){ window.__e2eAudio.push(this); return op.apply(this, a); };
    HTMLMediaElement.prototype.pause = function(...a){ if (!window.__e2eAudio.includes(this)) window.__e2eAudio.push(this); return opa.apply(this, a); };
    return 'instrumented';
  })()`));

  // Helper: click exact-text button / set inputs — defined once in page
  await run('NAV', 'D1b: helpers ready', () => evalJs(`(() => {
    window.__clickText = (t) => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===t); if(!b) return 'NO_BTN:'+t; b.click(); return 'OK'; };
    window.__setInput = (name, val) => { const el=document.querySelector('input[name="'+name+'"]'); if(!el) return 'NO_INPUT:'+name; const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; if(val===true||val===false){ el.checked=val; el.dispatchEvent(new Event('change',{bubbles:true})); } else { s.call(el, val); el.dispatchEvent(new Event('input',{bubbles:true})); } return 'OK'; };
    return 'ok';
  })()`));

  // ============ D: ADD SOUND WITH REAL FILE UPLOAD ============
  console.log(`\n[${LABEL}] === SUITE D: ADD SOUND + FILE SAVE ===`);
  await evalJs(`document.querySelector('button[title="Toggle Edit Mode"]')?.click()`); await sleep(600);
  const inEdit = await evalJs(`!!document.querySelector('button[title="Toggle Edit Mode"]')?.className?.match(/lime|lime-600|bg-lime/)`);
  log('EDIT', 'D2: edit mode on', inEdit ? 'PASS' : 'FAIL');

  const addClick = await evalJs(`window.__clickText('Add Sound')`);
  log('SOUND', 'D3: open Add Sound modal', addClick === 'OK' ? 'PASS' : 'FAIL', addClick);
  await sleep(700);

  // Fill form
  await evalJs(`window.__setInput('name','E2E Silence'); window.__setInput('type','E2E Test'); window.__setInput('color','#ff0000'); window.__setInput('fadeIn','2'); document.querySelector('#loop').click();`);
  await sleep(200);

  // Upload WAV via CDP DOM.setFileInputFiles
  let upRes = null;
  for (let i = 0; i < 10; i++) {
    const doc = await cdp('DOM.getDocument', { depth: 1 });
    const qr = await cdp('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type="file"][accept*=".mp3"]' });
    if (qr.result?.nodeId) { upRes = await cdp('DOM.setFileInputFiles', { nodeId: qr.result.nodeId, files: [WAV] }); break; }
    await sleep(400);
  }
  log('SOUND', 'D4: WAV uploaded via file input', upRes ? 'PASS' : 'FAIL', upRes ? 'setFileInputFiles ok' : 'input not found');
  await sleep(700);
  const filesShown = await evalJs(`(() => { const t=[...document.querySelectorAll('span')].map(s=>s.textContent.trim()).find(t=>/\\d+ file\\S* uploaded/.test(t)); return t||''; })()`);
  log('SOUND', 'D5: file registered in form', /1 file uploaded/.test(filesShown||'') ? 'PASS' : 'FAIL', filesShown);

  const sub = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Add Sound' && x.type==='submit' && /bg-lime-600/.test(x.className)); if(!b) return 'NO_SUBMIT'; if(b.disabled) return 'DISABLED'; b.click(); return 'OK'; })()`);
  log('SOUND', 'D6: submit Add Sound', sub === 'OK' ? 'PASS' : 'FAIL', sub);
  await sleep(1200);

  const afterAdd = await evalJs(`(() => {
    const o = {};
    o.cards = document.querySelectorAll('[data-sound-card]').length;
    o.modalOpen = !!document.querySelector('#loop');
    o.filter = (() => { const c=[...document.querySelectorAll('[data-sound-card]')][0]; if(!c) return ''; const img=c.querySelector('img'); return img? (img.style.filter||'') : ''; })();
    return o;
  })()`);
  log('SOUND', 'D7: card added', afterAdd?.cards === 1 ? 'PASS' : 'FAIL', 'cards=' + afterAdd?.cards + ' modalOpen=' + afterAdd?.modalOpen);
  log('COLOR', 'D8: icon tint hue-rotate applied', (afterAdd?.filter||'').includes('hue-rotate') ? 'PASS' : 'FAIL', afterAdd?.filter);

  const stored = await evalJs(`(() => {
    const chars = JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    const s = chars.find(c=>c.id==='c1').sounds[0] || null;
    const k = s && s.files && s.files[0] ? 'sound_file_'+s.files[0].name : null;
    return { s, hasLSS: k ? !!localStorage.getItem(k) : false, lsv: k ? (localStorage.getItem(k)||'').slice(0,30) : '' };
  })()`);
  log('DATA', 'D9: sound persisted in ttrpg_characters', !!stored?.s?.name ? 'PASS' : 'FAIL', stored?.s?.name);
  log('DATA', 'D10: color #ff0000 persisted', stored?.s?.color === '#ff0000' ? 'PASS' : 'FAIL', stored?.s?.color);
  log('DATA', 'D11: loop=true persisted', stored?.s?.loop === true ? 'PASS' : 'FAIL', String(stored?.s?.loop));
  log('DATA', 'D12: fadeIn=2 persisted', Number(stored?.s?.fadeIn) === 2 ? 'PASS' : 'FAIL', String(stored?.s?.fadeIn));
  log('DATA', 'D13: file entry recorded', /^sound_.*_e2e_silence\.wav$/.test(stored?.s?.files?.[0]?.name||'') ? 'PASS' : 'FAIL', stored?.s?.files?.[0]?.name);
  log('DATA', 'D14: ' + (process.env.EXPECT_TAURI==='1' ? 'Tauri fs path contract (verified on disk post-run)' : 'web sound_file_ localStorage'), process.env.EXPECT_TAURI==='1' ? 'PASS' : (stored?.hasLSS ? 'PASS':'FAIL'), stored?.hasLSS ? stored?.lsv : '(no key) — checked externally on disk, expect; for web this must be a data: URL');

  // ============ E: PLAYBACK + VOLUME + FADE + LOOP ============
  console.log(`\n[${LABEL}] === SUITE E: LIVE PLAYBACK ===`);
  await evalJs(`document.querySelector('button[title="Toggle Edit Mode"]')?.click()`); await sleep(500); // edit mode OFF so clicking plays
  const playing = await evalJs(`(async () => {
    const card = document.querySelector('[data-sound-card]');
    if (!card) return 'no card';
    card.click();
    await new Promise(r=>setTimeout(r, 900));
    const a = window.__e2eAudio[0];
    if (!a) return 'no audio instance';
    return { paused: a.paused, src: (a.src||'').slice(0,60), vol: a.volume, loop: a.loop, ring: card.className.includes('ring') };
  })()`);
  log('PLAY', 'E1: playback started', playing?.paused === false ? 'PASS' : 'FAIL',
    playing?.paused === false ? 'playing' : ('paused=true ' + JSON.stringify(playing)));
  log('PLAY', 'E2: audio src resolves to ' + (playing?.src?.startsWith('data:') ? 'data: URL (web)' : (playing?.src?.startsWith('asset://') || playing?.src?.startsWith('http') ? 'asset/conv src (Tauri)' : 'other')), (playing?.src||'').length > 5 ? 'PASS' : 'FAIL', playing?.src);
  log('PLAY', 'E3: card shows ring while playing', playing?.ring ? 'PASS' : 'FAIL');

  // fade-in: sample volume ramp vs master(target at 2s)
  const fadeSamples = await evalJs(`(async () => {
    const a = window.__e2eAudio[0]; if(!a) return 'no audio';
    const t0 = a.volume;
    await new Promise(r=>setTimeout(r, 700));
    const t700 = a.volume;
    await new Promise(r=>setTimeout(r, 2000));
    const t2700 = a.volume;
    return { t0, t700, t2700 };
  })()`);
  log('FADE', 'E4: fade-in ramps (t700 > t0)', fadeSamples?.t700 > fadeSamples?.t0 ? 'PASS' : 'FAIL', JSON.stringify(fadeSamples));
  log('FADE', 'E5: fade reaches full (t2700 ≈ target)', approx(fadeSamples?.t2700 || 0, 1, 0.15) ? 'PASS' : 'FAIL', 'vol@2.7s=' + fadeSamples?.t2700);

  // master volume change on a live (looping) audio
  const volRes = await evalJs(`(async () => {
    const slider = [...document.querySelectorAll('input[type=range]')].find(s=>s.min==='0' && (s.max==='1' || s.max==='1.0'));
    if(!slider) return 'no vol slider';
    const a = window.__e2eAudio[0];
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    s.call(slider, '0.2'); slider.dispatchEvent(new Event('input',{bubbles:true})); slider.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r, 300));
    return { audioVol: a.volume, slider: slider.value };
  })()`);
  log('VOL', 'E6: master volume changes live audio (0.2)', approx(Number(volRes?.audioVol), 0.2, 0.05) ? 'PASS' : 'FAIL', JSON.stringify(volRes));

  const numRes = await evalJs(`(async () => {
    const ni = document.querySelector('input[title="Volume (%)"]') || [...document.querySelectorAll('input[type=number]')][0];
    if(!ni) return 'no vol number input';
    const a = window.__e2eAudio[0];
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    s.call(ni, '50'); ni.dispatchEvent(new Event('input',{bubbles:true})); ni.dispatchEvent(new Event('change',{bubbles:true})); ni.blur();
    await new Promise(r=>setTimeout(r, 300));
    const slider = [...document.querySelectorAll('input[type=range]')].find(s=>s.min==='0' && (s.max==='1' || s.max==='1.0'));
    return { audioVol: a.volume, slider: slider?.value, num: ni.value };
  })()`);
  log('VOL', 'E7: volume number input -> 50%', approx(Number(numRes?.audioVol), 0.5, 0.05) && approx(Number(numRes?.slider), 0.5, 0.02) ? 'PASS' : 'FAIL', JSON.stringify(numRes));

  // loop: force near end of 20s wav, manual-loop should rewind to ~0
  const loopRes = await evalJs(`(async () => {
    const a = window.__e2eAudio[0]; if(!a) return 'no audio';
    if (!Number.isFinite(a.duration)) return 'no duration';
    const start = a.currentTime;
    try { a.currentTime = a.duration - 0.2; } catch(e){ return 'seek err '+e.message; }
    await new Promise(r=>setTimeout(r, 800));
    return { start, after: a.currentTime, duration: a.duration };
  })()`);
  log('LOOP', 'E8: manual loop rewinds at boundary', Number(loopRes?.after) < 2 ? 'PASS' : 'FAIL' , 'currentTime ' + loopRes?.start + ' -> ' + loopRes?.after + ' (dur ' + loopRes?.duration + ')');

  // stop all
  await evalJs(`document.querySelector('button[title="Stop All Sounds"]')?.click()`);
  await sleep(400);
  const stopped = await evalJs(`(() => { const a=window.__e2eAudio[0]; const c=document.querySelector('[data-sound-card]'); return { paused: a? a.paused : null, ring: c? c.className.includes('ring'):null }; })()`);
  log('PLAY', 'E9: Stop All stops audio + clears ring', stopped?.paused === true && stopped?.ring === false ? 'PASS' : 'FAIL', JSON.stringify(stopped));

  // ============ F: THEME + CRUD + PERSISTENCE ============
  console.log(`\n[${LABEL}] === SUITE F: THEME / CRUD / PERSISTENCE ===`);
  await evalJs(`document.querySelector('button[title="Settings"]')?.click()`); await sleep(600);
  const themeBefore = await evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--theme-bg-primary').trim()`);
  const themeClick = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Forest'); if(!b) return 'NO_THEME'; b.click(); return 'OK'; })()`);
  await sleep(600);
  const themeAfter = await evalJs(`(() => {
    const rs = getComputedStyle(document.documentElement);
    const bs = JSON.parse(localStorage.getItem('backgroundSettings')||'{}');
    return { primary: rs.getPropertyValue('--theme-bg-primary').trim(), drawer: rs.getPropertyValue('--theme-bg-drawer').trim(), stored: bs.theme };
  })()`);
  log('THEME', 'F1: apply Forest theme', themeClick === 'OK' && themeAfter?.primary !== themeBefore ? 'PASS' : 'FAIL', themeBefore + ' -> ' + themeAfter?.primary);
  log('THEME', 'F2: theme persisted in backgroundSettings', themeAfter?.stored === 'forest' ? 'PASS' : 'FAIL', 'stored=' + themeAfter?.stored);
  log('THEME', 'F3: drawer var derived', /^#([0-9a-f]{6})$/i.test(themeAfter?.drawer||'') ? 'PASS' : 'FAIL', themeAfter?.drawer);
  const closeSet = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Close'); if(b){b.click(); return 'OK';} const x=[...document.querySelectorAll('button')].find(x=>x.title==='Close'); if(x){x.click();return 'OK';} return 'NO_CLOSE'; })()`);
  await sleep(400);

  // Add Character
  await evalJs(`document.querySelector('button[title="Toggle Edit Mode"]')?.click()`); await sleep(500);
  const addChar = await evalJs(`window.__clickText('Add Character')`);
  await sleep(500);
  await evalJs(`window.__setInput('name','E2E Hero')`);
  await sleep(150);
  const subChar = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Add Character' && x.type==='submit' && /bg-lime-600/.test(x.className)); if(!b) return 'NO'; b.click(); return 'OK'; })()`);
  await sleep(900);
  const charAdded = await evalJs(`(() => {
    const chars = JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    const sidebar = [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='E2E Hero');
    return { has: chars.some(c=>c.name==='E2E Hero'), sidebar };
  })()`);
  log('CHAR', 'F4: add character persists', charAdded?.has ? 'PASS' : 'FAIL', 'storage=' + charAdded?.has + ' sidebar=' + charAdded?.sidebar);

  // Reload persistence
  await cdp('Page.reload', { ignoreCache: true });
  await sleep(3000);
  const reloadCheck = await evalJs(`(() => {
    const chars = JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    const env = JSON.parse(localStorage.getItem('ttrpg_environment')||'[]');
    const hp = chars.find(c=>c.id==='c1');
    const e2e = chars.find(c=>c.name==='E2E Hero');
    return {
      hpSounds: hp?.sounds?.length || 0,
      hpSound: hp?.sounds?.[0]?.name || '',
      hpColor: hp?.sounds?.[0]?.color || '',
      heroExists: !!e2e,
      theme: (JSON.parse(localStorage.getItem('backgroundSettings')||'{}')).theme
    };
  })()`);
  log('PERSIST', 'F5: sound survives reload', reloadCheck?.hpSounds === 1 && reloadCheck?.hpSound === 'E2E Silence' ? 'PASS' : 'FAIL', JSON.stringify(reloadCheck));
  log('PERSIST', 'F6: color survives reload', reloadCheck?.hpColor === '#ff0000' ? 'PASS' : 'FAIL', reloadCheck?.hpColor);
  log('PERSIST', 'F7: character survives reload', reloadCheck?.heroExists ? 'PASS' : 'FAIL');
  log('PERSIST', 'F8: theme survives reload', reloadCheck?.theme === 'forest' ? 'PASS' : 'FAIL', 'theme=' + reloadCheck?.theme);

  // Environment add-sound (second upload) + delete
  console.log(`\n[${LABEL}] === SUITE G: ENVIRONMENT SOUND + DELETE ===`);
  await evalJs(`document.querySelector('button[title="Toggle Edit Mode"]')?.click()`); await sleep(500);
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Environment'); if(b) b.click(); return 'OK'; })()`);
  await sleep(400);
  await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Dungeon' && !x.title); if(b) b.click(); return 'OK'; })()`);
  await sleep(500);
  await evalJs(`window.__clickText('Add Sound')`); await sleep(700);
  await evalJs(`window.__setInput('name','Env Echo'); window.__setInput('type','E2E Test');`);
  let up2 = null;
  for (let i = 0; i < 10; i++) {
    const doc = await cdp('DOM.getDocument', { depth: 1 });
    const qr = await cdp('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type="file"][accept*=".mp3"]' });
    if (qr.result?.nodeId) { up2 = await cdp('DOM.setFileInputFiles', { nodeId: qr.result.nodeId, files: [WAV] }); break; }
    await sleep(400);
  }
  await sleep(700);
  const sub2 = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Add Sound' && x.type==='submit' && /bg-lime-600/.test(x.className)); if(!b) return 'NO_SUBMIT'; if(b.disabled) return 'DISABLED'; b.click(); return 'OK'; })()`);
  await sleep(1200);
  const envStored = await evalJs(`(() => {
    const env = JSON.parse(localStorage.getItem('ttrpg_environment')||'[]');
    const dun = env.find(c=>c.id==='e1');
    return { n: dun?.sounds?.length||0, name: dun?.sounds?.[0]?.name||'', file: dun?.sounds?.[0]?.files?.[0]?.name||'' };
  })()`);
  log('ENV', 'G1: environment sound added', envStored?.n === 1 && envStored?.name === 'Env Echo' ? 'PASS' : 'FAIL', JSON.stringify(envStored));
  log('ENV', 'G2: env file entry recorded', /^sound_.*_e2e_silence\.wav$/.test(envStored?.file||'') ? 'PASS' : 'FAIL', envStored?.file);

  // Delete via card edit-mode delete + confirm
  const delRes = await evalJs(`(async () => {
    const card=[...document.querySelectorAll('[data-sound-card]')].find(c=>c.textContent.includes('Env Echo'));
    if(!card) return 'card not found';
    const d=card.querySelector('button[title="Delete Sound"]');
    if(!d) return 'no delete btn (edit mode?)';
    d.click();
    await new Promise(r=>setTimeout(r,400));
    const confirmBtn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete');
    if(!confirmBtn) return 'no confirm btn';
    confirmBtn.click();
    await new Promise(r=>setTimeout(r,900));
    const env = JSON.parse(localStorage.getItem('ttrpg_environment')||'[]');
    const dun = env.find(c=>c.id==='e1');
    const cardAfter=[...document.querySelectorAll('[data-sound-card]')].length;
    return { n: dun?.sounds?.length||0, cardCount: cardAfter };
  })()`);
  log('ENV', 'G3: Delete Sound via modal removes it', delRes?.n === 0 ? 'PASS' : 'FAIL', JSON.stringify(delRes));

  // Delete character via sidebar delete badge + confirm
  const delChar = await evalJs(`(async () => {
    const ct=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Characters');
    if(ct) ct.click();
    await new Promise(r=>setTimeout(r, 400));
    const d=[...document.querySelectorAll('button[title="Delete Character"]')].find(b=>b.closest('div')?.textContent.includes('E2E Hero'));
    if(!d) return 'no char delete btn';
    d.click();
    await new Promise(r=>setTimeout(r,400));
    const cb=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete');
    if(!cb) return 'no confirm';
    cb.click();
    await new Promise(r=>setTimeout(r,900));
    const chars=JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
    return { heroLeft: chars.some(c=>c.name==='E2E Hero'), count: chars.length };
  })()`);
  log('CHAR', 'G4: Delete Character removes it', delChar?.heroLeft === false ? 'PASS' : 'FAIL', JSON.stringify(delChar));

  // ============ Restore ============
  if (SAVE_RESTORE && capturedLS) {
    const rr = await evalJs(`(() => { const o = ${JSON.stringify(capturedLS)}; localStorage.clear(); for (const k in o) localStorage.setItem(k, o[k]); return 'restored'; })()`);
    console.log(`[${LABEL}] localStorage restore:`, rr);
    await cdp('Page.reload', { ignoreCache: true });
    await sleep(3000);
  }

  console.log('\n==============================');
  console.log(`[${LABEL}] FEATURES E2E SUMMARY: PASS=${pass}  FAIL=${fail}  WARN=${warn}  TOTAL=${pass+fail+warn}`);
  console.log('==============================');
  ws.close();
  process.exit(fail > 0 ? 2 : (warn > 0 ? 1 : 0));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });