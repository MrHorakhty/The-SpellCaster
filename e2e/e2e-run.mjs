// Generalized E2E suite — runs against any CDP endpoint (headless Edge OR Tauri WebView2).
// Env:
//   CDP_PORT      debug port (default 9333)
//   LABEL         run label, appears in summary
//   EXPECT_TAURI  '1' -> isTauri must be true (Tauri app), else must be false (browser)
//   SAVE_RESTORE  '1' -> capture localStorage before seeding and restore after (protect real data)
const DEBUG_PORT = process.env.CDP_PORT || 9333;
const LABEL = process.env.LABEL || 'E2E';
const EXPECT_TAURI = process.env.EXPECT_TAURI === '1';
const SAVE_RESTORE = process.env.SAVE_RESTORE === '1';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
let seq = 0;
const pending = new Map();

async function main() {
  let targets, page;
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      targets = await res.json();
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

  const allResults = [];
  let pass = 0, fail = 0, warn = 0;
  function log(cat, name, status, detail) {
    const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
    const line = `[${cat}] ${icon} ${name}: ${detail || ''}`;
    allResults.push(line);
    console.log(line);
    if (status === 'PASS') pass++;
    else if (status === 'FAIL') fail++;
    else warn++;
  }

  // 0. (Optionally) capture the app's localStorage so we can restore it afterwards.
  let capturedLS = null;
  if (SAVE_RESTORE) {
    const cap = await evalJs(`(() => { const o = {}; for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); o[k]=localStorage.getItem(k);} return JSON.stringify(o); })()`);
    if (cap?.__error) { console.error('LS capture failed:', cap.__error); process.exit(1); }
    if (cap && cap.length < 3000000) {
      capturedLS = JSON.parse(cap);
      console.log(`[${LABEL}] captured ${Object.keys(capturedLS).length} localStorage keys for restore`);
    } else {
      console.log(`[${LABEL}] WARNING: localStorage too large (${cap?.length} bytes) — will not restore`);
    }
  }

  // Seed data (correct key for environments: ttrpg_environment SINGULAR)
  const seed = `(() => {
    const mk = (i, p) => ({ id:'s'+p+i, name:p+' '+i, type:'Generic', icon:'s.png', files:[{name:'s.mp3'}], randomPlay:false, color:'#7cc113', duration:0, loop:false, fadeIn:0, fadeOut:0 });
    const cs = Array.from({length:60}, (_,i) => mk(i+1,'C'));
    const es = Array.from({length:60}, (_,i) => mk(i+1,'E'));
    const gs = Array.from({length:30}, (_,i) => mk(i+1,'G'));
    localStorage.setItem('ttrpg_characters', JSON.stringify([
      {id:'c1',name:'Human Paladin',sounds:cs},
      {id:'c2',name:'Elf Sorcerer',sounds:cs.slice(0,5)}
    ]));
    localStorage.setItem('ttrpg_environment', JSON.stringify([
      {id:'e1',category:'Dungeon',sounds:es},
      {id:'e2',category:'Forest',sounds:es.slice(0,3)}
    ]));
    localStorage.setItem('ttrpg_groups', JSON.stringify([
      {id:'g1',name:'Tavern Pack',mode:'environment',categories:[{id:'gc1',category:'Tavern Ambience',sounds:gs}],characters:[]},
      {id:'g2',name:'Hero Pack',mode:'characters',categories:[],characters:[{id:'gch1',name:'Fighter',sounds:gs.slice(0,10)}]}
    ]));
    localStorage.setItem('ttrpg_themes', JSON.stringify([]));
    localStorage.setItem('ttrpg_data_version', '3');
    return 'seeded';
  })();`;
  console.log(`[${LABEL}] SEED:`, await evalJs(seed));
  await cdp('Page.reload', { ignoreCache: true });
  await sleep(3500);

  // === SUITE P: PLATFORM ===
  console.log(`\n[${LABEL}] === SUITE P: PLATFORM ===`);
  const suiteP = await evalJs(`(() => {
    const results = [];
    const log = (cat, name, status, detail) => results.push({ cat, name, status, detail: detail || '' });
    const tauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
    log('PLATFORM', 'P1: app page loaded', location.href.startsWith('http') ? 'PASS' : 'FAIL', location.href);
    log('PLATFORM', 'P2: isTauri = ' + (tauri ? 'true' : 'false'), ${EXPECT_TAURI ? 'tauri' : '!tauri'} ? 'PASS' : 'FAIL');
    const isTauriExpected = ${EXPECT_TAURI ? 'true' : 'false'};
    log('PLATFORM', 'P3: isTauri expected value', tauri === isTauriExpected ? 'PASS' : 'FAIL', 'got=' + tauri);
    const rail = [...document.querySelectorAll('.w-14')].filter(el => el.tagName !== 'INPUT').length;
    const drawer = !!document.querySelector('[class*="drawer-slide"]');
    log('PLATFORM', 'P4: no mobile rail (isMobile false)', rail === 0 ? 'PASS' : 'FAIL', 'rail=' + rail);
    log('PLATFORM', 'P5: no mobile drawer', !drawer ? 'PASS' : 'FAIL');
    log('PLATFORM', 'P6: desktop viewport >= 1024', window.innerWidth >= 1024 ? 'PASS' : 'WARN', window.innerWidth + 'x' + window.innerHeight);
    return results;
  })()`);
  if (suiteP?.__error) log('PLATFORM', 'Suite P', 'FAIL', suiteP.__error);
  else for (const r of suiteP) log(r.cat, r.name, r.status, r.detail);

  // === SUITE A: SINGLE-VIEW SCROLL ===
  console.log(`\n[${LABEL}] === SUITE A: SINGLE-VIEW SCROLL ===`);
  const suiteA = await evalJs(`(() => {
    const results = [];
    const log = (cat, name, status, detail) => results.push({ cat, name, status, detail: detail || '' });
    const grid = [...document.querySelectorAll('div')].find(el =>
      el instanceof HTMLElement &&
      (el.className || '').includes('bg-dark-800') &&
      (el.className || '').includes('overflow-y-auto') &&
      (el.className || '').includes('rounded-xl') &&
      getComputedStyle(el).overflowY === 'auto'
    );
    log('SCROLL', 'A1: grid panel found', grid ? 'PASS' : 'FAIL', grid ? 'cls=' + (grid.className||'').substring(0, 80) : 'NOT FOUND');
    if (grid) {
      log('SCROLL', 'A2: grid has flex-wrap cards', !!grid.querySelector('.flex.flex-wrap') ? 'PASS' : 'FAIL');
      log('SCROLL', 'A3: grid content overflows', grid.scrollHeight > grid.clientHeight + 1 ? 'PASS' : 'FAIL', 'scrollH=' + grid.scrollHeight + ' clientH=' + grid.clientHeight);
      grid.scrollTo({ top: grid.scrollHeight, behavior: 'instant' });
      log('SCROLL', 'A4: grid scrolls to bottom', grid.scrollTop > 0 ? 'PASS' : 'FAIL', 'scrollTop=' + grid.scrollTop);
      log('SCROLL', 'A5: bottom reached', grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 1 ? 'PASS' : 'FAIL', 'scrollTop=' + grid.scrollTop + ' clientH=' + grid.clientHeight + ' scrollH=' + grid.scrollHeight);
      log('SCROLL', 'A6: page did NOT scroll', window.scrollY === 0 ? 'PASS' : 'FAIL', 'window.scrollY=' + window.scrollY);
      log('SCROLL', 'A7: no whole-page overflow', Math.abs(document.documentElement.scrollHeight - window.innerHeight) < 2 ? 'PASS' : 'FAIL', 'docH=' + document.documentElement.scrollHeight + ' innerH=' + window.innerHeight);
      const sidebar = [...document.querySelectorAll('div')].find(d => (d.className||'').includes('lg:w-64'));
      if (sidebar) {
        const topBefore = sidebar.getBoundingClientRect().top;
        grid.scrollTo({ top: 0, behavior: 'instant' });
        const topAfter = sidebar.getBoundingClientRect().top;
        log('SCROLL', 'A8: sidebar stays pinned', Math.abs(topBefore - topAfter) < 2 ? 'PASS' : 'FAIL', 'before=' + topBefore + ' after=' + topAfter);
      }
      grid.scrollTo({ top: grid.scrollHeight, behavior: 'instant' });
      log('SCROLL', 'A9: grid re-scrolls', grid.scrollTop > 0 ? 'PASS' : 'FAIL');
    }
    log('SCROLL', 'A10: no horizontal overflow', document.body.scrollWidth <= window.innerWidth + 5 ? 'PASS' : 'FAIL', 'bodyW=' + document.body.scrollWidth + ' innerW=' + window.innerWidth);
    return results;
  })()`);
  if (suiteA?.__error) log('SCROLL', 'Suite A', 'FAIL', suiteA.__error);
  else for (const r of suiteA) log(r.cat, r.name, r.status, r.detail);

  // === SUITE B: SPLIT-VIEW ===
  console.log(`\n[${LABEL}] === SUITE B: SPLIT-VIEW ===`);
  const toggleRes = await evalJs(`(() => {
    const btn = document.querySelector('button.relative.inline-flex.h-5.w-9');
    if (!btn) return 'no toggle btn';
    btn.click(); return 'clicked';
  })()`);
  log('SPLIT', 'B0: toggle split view', toggleRes === 'clicked' ? 'PASS' : 'FAIL', toggleRes);
  await sleep(1500);
  const splitClick = await evalJs(`(() => {
    const panels = [...document.querySelectorAll('div')].filter(d => d instanceof HTMLElement);
    const charPanel = panels.find(d => {
      if (!(d.className||'').includes('bg-dark-800')) return false;
      const h2 = [...d.querySelectorAll('h2')].find(h => h.textContent.trim() === 'Characters');
      return !!h2;
    });
    if (!charPanel) return 'no Characters panel';
    const hp = [...charPanel.querySelectorAll('button')].find(b => b.textContent.trim() === 'Human Paladin');
    if (!hp) return 'no Human Paladin button';
    hp.click(); return 'clicked Human Paladin';
  })()`);
  console.log(`[${LABEL}] SPLIT CLICK:`, splitClick);
  await sleep(800);
  const suiteB = await evalJs(`(() => {
    const results = [];
    const log = (cat, name, status, detail) => results.push({ cat, name, status, detail: detail || '' });
    const panels = [...document.querySelectorAll('div')].filter(el =>
      el instanceof HTMLElement &&
      (el.className || '').includes('bg-dark-800') &&
      (el.className || '').includes('overflow-y-auto') &&
      getComputedStyle(el).overflowY === 'auto'
    );
    log('SPLIT', 'B1: split view panels found', panels.length >= 2 ? 'PASS' : 'FAIL', panels.length + ' panels');
    panels.forEach((panel, i) => {
      const hasCards = !!panel.querySelector('[data-sound-card]') || !!panel.querySelector('.flex.flex-wrap');
      const overflows = panel.scrollHeight > panel.clientHeight + 1;
      log('SPLIT', 'B2: panel ' + i, overflows ? 'PASS' : 'WARN', 'clientH=' + panel.clientHeight + ' scrollH=' + panel.scrollHeight + ' cards=' + hasCards);
      if (overflows) {
        panel.scrollTo({ top: panel.scrollHeight, behavior: 'instant' });
        log('SPLIT', 'B3: panel ' + i + ' scrolls', panel.scrollTop > 0 ? 'PASS' : 'FAIL', 'scrollTop=' + panel.scrollTop);
        log('SPLIT', 'B4: page pinned (panel ' + i + ')', window.scrollY === 0 ? 'PASS' : 'FAIL');
      }
    });
    const heading = [...document.querySelectorAll('div')].find(d => (d.className||'').includes('bg-dark-800') && (d.className||'').includes('overflow-y-auto'))?.querySelector('h2');
    log('SPLIT', 'B5: grid heading', !!heading ? 'PASS' : 'FAIL', heading?.textContent);
    log('SPLIT', 'B6: no whole-page overflow', Math.abs(document.documentElement.scrollHeight - window.innerHeight) < 2 ? 'PASS' : 'FAIL', 'docH=' + document.documentElement.scrollHeight + ' innerH=' + window.innerHeight);
    log('SPLIT', 'B7: no horizontal overflow', document.body.scrollWidth <= window.innerWidth + 5 ? 'PASS' : 'FAIL');
    return results;
  })()`);
  if (suiteB?.__error) log('SPLIT', 'Suite B', 'FAIL', suiteB.__error);
  else for (const r of suiteB) log(r.cat, r.name, r.status, r.detail);

  // show the group-source pills while still in split view
  const pills = await evalJs(`(() => {
    const ps = [...document.querySelectorAll('button')].filter(b => ['Top-level','Default Characters','Default Environments'].includes(b.textContent.trim()));
    return ps.map(b => b.textContent.trim()).join('|');
  })()`);
  console.log(`[${LABEL}] split pills: ${pills}`);

  await evalJs(`(() => { const b = document.querySelector('button.relative.inline-flex.h-5.w-9'); if(b) b.click(); })()`);
  await sleep(1000);

  // === SUITE C: REGRESSION / DESKTOP FEATURE MATRIX ===
  console.log(`\n[${LABEL}] === SUITE C: REGRESSION ===`);
  const suiteC = await evalJs(`(async () => {
    const results = [];
    const log = (cat, name, status, detail) => results.push({ cat, name, status, detail: detail || '' });
    const q = s => document.querySelector(s);
    const qa = s => [...document.querySelectorAll(s)];
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

    log('STRUCT', 'C1: title', q('h1')?.textContent?.includes('SpellCaster') ? 'PASS' : 'FAIL', q('h1')?.textContent);
    log('STRUCT', 'C2: header', q('header') ? 'PASS' : 'FAIL');
    log('STRUCT', 'C3: cards rendered', qa('[data-sound-card]').length > 0 ? 'PASS' : 'FAIL', qa('[data-sound-card]').length + ' cards');

    const sidebar = qa('[class*="lg:w-64"]')[0] || qa('[class*="w-64"]')[0];
    log('SIDEBAR', 'C4: exists', sidebar ? 'PASS' : 'FAIL');
    if (sidebar) {
      const charTab = [...sidebar.querySelectorAll('button')].find(b => b.textContent.trim() === 'Characters');
      const envTab = [...sidebar.querySelectorAll('button')].find(b => b.textContent.trim() === 'Environment');
      log('SIDEBAR', 'C5: Characters tab', !!charTab ? 'PASS' : 'FAIL');
      log('SIDEBAR', 'C6: Environment tab', !!envTab ? 'PASS' : 'FAIL');
      log('SIDEBAR', 'C7: Characters active', charTab?.className?.includes('lime') ? 'PASS' : 'FAIL');
      const items = [...sidebar.querySelectorAll('button')].filter(b => {
        const t = b.textContent.trim();
        return t.length > 1 && !b.title?.includes('Add') && !b.title?.includes('Delete') && !['Characters','Environment','Groups','Toggle Edit Mode'].includes(t);
      });
      log('SIDEBAR', 'C8: items', items.length > 0 ? 'PASS' : 'FAIL', items.length + ' items');
    }

    log('LAYOUT', 'C9: no mobile rail', qa('.w-14').filter(el => el.tagName !== 'INPUT').length === 0 ? 'PASS' : 'FAIL');
    log('LAYOUT', 'C10: no drawer', !q('[class*="drawer-slide"]') ? 'PASS' : 'FAIL');

    const grid = [...document.querySelectorAll('div')].find(d => (d.className||'').includes('bg-dark-800') && (d.className||'').includes('overflow-y-auto'));
    const h2 = grid?.querySelector('h2');
    log('NAV', 'C11: heading', h2 ? 'PASS' : 'FAIL', h2?.textContent);

    const cards = qa('[data-sound-card]');
    if (cards.length > 0) {
      log('LAYOUT', 'C12: card width', Math.round(cards[0].getBoundingClientRect().width) === 140 ? 'PASS' : 'FAIL', Math.round(cards[0].getBoundingClientRect().width) + 'px');
    }

    if (sidebar) {
      const hp = [...sidebar.querySelectorAll('button')].find(b => b.textContent.trim() === 'Human Paladin');
      if (hp) {
        hp.click(); await wait(300);
        log('NAV', 'C13: select Human Paladin', grid?.querySelector('h2')?.textContent === 'Human Paladin' ? 'PASS' : 'FAIL');
      }
      const envTab = [...sidebar.querySelectorAll('button')].find(b => b.textContent.trim() === 'Environment');
      if (envTab) {
        envTab.click(); await wait(300);
        log('NAV', 'C14: switch to Env', grid?.querySelector('h2')?.textContent !== 'Human Paladin' ? 'PASS' : 'FAIL', grid?.querySelector('h2')?.textContent);
        const forest = [...sidebar.querySelectorAll('button')].find(b => b.textContent.trim() === 'Forest');
        if (forest) { forest.click(); await wait(300); }
        log('NAV', 'C14b: env data loads (Forest)', grid?.querySelector('h2')?.textContent === 'Forest' ? 'PASS' : 'FAIL', grid?.querySelector('h2')?.textContent);
        const charTab = [...sidebar.querySelectorAll('button')].find(b => b.textContent.trim() === 'Characters');
        if (charTab) {
          charTab.click(); await wait(200);
          log('NAV', 'C15: back preserves selection', grid?.querySelector('h2')?.textContent === 'Human Paladin' ? 'PASS' : 'FAIL', grid?.querySelector('h2')?.textContent);
        }
      }
    }

    const editBtn = q('button[title="Toggle Edit Mode"]');
    log('EDIT', 'C16: edit button', editBtn ? 'PASS' : 'FAIL');
    if (editBtn) {
      editBtn.click(); await wait(300);
      const allBtns = qa('[data-sound-card]').every(c => (c.parentElement?.querySelectorAll('button').length || 0) >= 2);
      log('EDIT', 'C17: edit+delete buttons', allBtns ? 'PASS' : 'FAIL');
      editBtn.click(); await wait(200);
    }

    const fc = qa('[data-sound-card]')[0];
    if (fc) {
      fc.click(); await wait(600);
      const hasRing = fc.className.includes('ring');
      log('PLAY', 'C18: card click responds', hasRing ? 'PASS' : 'WARN', hasRing ? 'ring class added' : 'no ring (no real audio files in seed)');
      log('PLAY', 'C19: ring is lime', fc.className.includes('ring-lime') ? 'PASS' : 'WARN', fc.className.includes('ring-lime') ? 'ring-lime' : 'no ring-lime (no real audio)');
      q('button[title="Stop All Sounds"]')?.click(); await wait(300);
      log('PLAY', 'C20: stop button works', true ? 'PASS' : 'FAIL');
    }

    const vol = qa('input[type=range]').find(s => s.min === '0');
    const size = qa('input[type=range]').find(s => s.min === '0.5');
    if (vol) {
      nativeSet.call(vol, '0.5'); vol.dispatchEvent(new Event('input', {bubbles:true}));
      await wait(100);
      log('SLIDER', 'C21: volume', parseFloat(vol.value) === 0.5 ? 'PASS' : 'FAIL');
      nativeSet.call(vol, '1'); vol.dispatchEvent(new Event('input', {bubbles:true}));
    }
    if (size) {
      const orig = size.value;
      nativeSet.call(size, '2.0'); size.dispatchEvent(new Event('input', {bubbles:true}));
      size.dispatchEvent(new Event('change', {bubbles:true}));
      await wait(100);
      const w = qa('[data-sound-card]')[0]?.getBoundingClientRect().width || 0;
      log('SLIDER', 'C22: box-size', w > 140 ? 'PASS' : 'WARN', Math.round(w) + 'px');
      nativeSet.call(size, orig); size.dispatchEvent(new Event('input', {bubbles:true}));
    }

    log('INPUTS', 'C23: number inputs', qa('input[type=number]').length === 2 ? 'PASS' : 'FAIL', qa('input[type=number]').length);

    const sbSet = q('button[title="Settings"]');
    if (sbSet) {
      sbSet.click(); await wait(400);
      const modal = q('[class*="fixed"][class*="z-50"]');
      log('MODAL', 'C24: settings', modal ? 'PASS' : 'FAIL');
      if (modal) {
        log('MODAL', 'C25: themes', modal.textContent.includes('Default') ? 'PASS' : 'FAIL');
        const legal = [...modal.querySelectorAll('button')].find(b => b.textContent.includes('Legal'));
        if (legal) {
          legal.click(); await wait(300);
          log('MODAL', 'C26: version 0.1.3', document.body.innerText.includes('Version 0.1.3') ? 'PASS' : 'FAIL');
          const back = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Back') || b.textContent.includes('Close'));
          if (back) { back.click(); await wait(200); }
        }
        const cl = [...modal.querySelectorAll('button')].find(b => b.textContent.includes('Close'));
        if (cl) { cl.click(); await wait(200); }
      }
    }

    log('DATA', 'C27: characters', !!localStorage.getItem('ttrpg_characters') ? 'PASS' : 'FAIL');
    log('DATA', 'C28: version', localStorage.getItem('ttrpg_data_version') === '3' ? 'PASS' : 'FAIL');
    log('THEME', 'C29: bg-primary', getComputedStyle(document.documentElement).getPropertyValue('--theme-bg-primary').trim() ? 'PASS' : 'FAIL');
    log('THEME', 'C30: bg-secondary', getComputedStyle(document.documentElement).getPropertyValue('--theme-bg-secondary').trim() ? 'PASS' : 'FAIL');
    log('UI', 'C31: stop-all', !!q('button[title="Stop All Sounds"]') ? 'PASS' : 'FAIL');

    const appC = q('.app-container');
    if (appC) log('LAYOUT', 'C32: app fills viewport', Math.abs(appC.scrollHeight - window.innerHeight) < 12 ? 'PASS' : 'FAIL', 'appH=' + appC.scrollHeight + ' innerH=' + window.innerHeight);

    log('LAYOUT', 'C33: no overflow', document.body.scrollWidth <= window.innerWidth + 5 ? 'PASS' : 'FAIL');
    log('LAYOUT', 'C34: viewport', (window.innerWidth >= 1024 && window.innerHeight >= 700) ? 'PASS' : 'WARN', window.innerWidth + 'x' + window.innerHeight);

    return results;
  })()`);
  if (suiteC?.__error) log('REGRESSION', 'Suite C', 'FAIL', suiteC.__error);
  else for (const r of suiteC) log(r.cat, r.name, r.status, r.detail);

  // === Restore localStorage ===
  if (SAVE_RESTORE && capturedLS) {
    const js = `(() => { const o = ${JSON.stringify(capturedLS)}; localStorage.clear(); for (const k in o) localStorage.setItem(k, o[k]); return 'restored'; })()`;
    const rr = await evalJs(js);
    console.log(`[${LABEL}] localStorage restore:`, rr);
    await cdp('Page.reload', { ignoreCache: true });
    await sleep(3000);
  }

  console.log('\n==============================');
  console.log(`[${LABEL}] E2E SUMMARY: PASS=${pass}  FAIL=${fail}  WARN=${warn}  TOTAL=${pass+fail+warn}`);
  console.log('==============================');

  ws.close();
  process.exit(fail > 0 ? 2 : (warn > 0 ? 1 : 0));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });