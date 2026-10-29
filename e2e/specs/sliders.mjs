// Shared box-size spec (Suite B, B1-B4).
//
// Closes the mobile "sliders/persistence (B)" gap: the box-size slider lives in
// both headers (mobile App.jsx renders it in the mobile header, not just the
// desktop one), but only the desktop suite ever drove it.
//
// One real assertion differs by platform, and deliberately:
//   desktop - a card is 140 * boxSize px wide, so 1.8 => ~252px.
//   mobile  - the card is w-full; boxSize instead picks the grid column count
//             (App.jsx: boxSize>=1.5 => 1 col, >=0.7 => 2, else 3), so 1.8
//             collapses the board to a single column.
// Everything else - the write, the persisted key, the reload round-trip and the
// reset - is identical, because it is all app logic rather than layout.
//
// The seed is re-applied first so boxSize starts from its default regardless of
// what earlier suites left behind (SEED removes the key).

import { PAGE_HELPERS, SEED, awaitBoard } from '../lib/page.mjs';

export const sliders = {
  title: 'SUITE B: SLIDERS & PERSISTENCE',
  async run(ctx) {
    const { log, evalJs, sleep, reload, driver } = ctx;

    await evalJs(SEED);
    await reload();
    // Wait for the board rather than assuming the reload painted it - see
    // awaitBoard in lib/page.mjs. This spec measures a card's width, so an
    // empty page would fail every assertion for the wrong reason.
    const seededCards = await awaitBoard(ctx, { min: 3, seed: SEED });
    if (seededCards < 3) {
        log('SLIDER', 'B0: the seeded board came up', 'FAIL', `cards=${seededCards} expected=3`);
    }
    await evalJs(PAGE_HELPERS);

    // React tracks the range's value on the DOM node, so assigning .value is
    // not seen; the writes below go through the native setter and fire bubbling
    // input/change events.
    const sliderSet = await evalJs(`(() => {
      const size = [...document.querySelectorAll('input[type=range]')].find(s => s.min === '0.5');
      const vol = [...document.querySelectorAll('input[type=range]')].find(s => s.min === '0');
      if (size) { const n = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; n.call(size, '1.8'); size.dispatchEvent(new Event('input', { bubbles: true })); size.dispatchEvent(new Event('change', { bubbles: true })); }
      return { sizeOk: size?.value === '1.8', volExists: !!vol };
    })()`);
    log('SLIDER', 'B1: box-size set to 1.8', sliderSet?.sizeOk ? 'PASS' : 'FAIL', JSON.stringify(sliderSet));

    if (driver.isDesktop) {
      const boxWidth = await evalJs(`Math.round(document.querySelector('[data-sound-card]')?.getBoundingClientRect().width || 0)`);
      const pass = boxWidth >= 248 && boxWidth <= 260;
      log('SLIDER', 'B2: card width ~252px', pass ? 'PASS' : 'FAIL', boxWidth + 'px');
    } else {
      const cols = await evalJs(`(() => {
        const g = document.querySelector('.grid.gap-3');
        if (!g) return 'NO_GRID';
        return getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length;
      })()`);
      log('SLIDER', 'B2: grid collapses to 1 column at 1.8', cols === 1 ? 'PASS' : 'FAIL', 'cols=' + cols);
    }

    const boxSizePersisted = await evalJs(`localStorage.getItem(window.__pk('boxSize'))`);
    log('SLIDER', 'B3: boxSize persisted', boxSizePersisted === '1.8' ? 'PASS' : 'FAIL', boxSizePersisted);

    // Reload -> box-size preserved
    await reload();
    await evalJs(PAGE_HELPERS);
    const afterReload = await evalJs(`(() => {
      const size = [...document.querySelectorAll('input[type=range]')].find(s => s.min === '0.5');
      return { size: size?.value, bs: localStorage.getItem(window.__pk('boxSize')) };
    })()`);
    log('SLIDER', 'B4: box-size survives reload', afterReload?.size === '1.8' || afterReload?.bs === '1.8' ? 'PASS' : 'FAIL', JSON.stringify(afterReload));

    await driver.enterEditMode();
    const setSize = async value => {
      await evalJs(`(() => {const s=[...document.querySelectorAll('input[type=range]')].find(s=>s.min==='0.5');const n=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;n.call(s,'${value}');s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await sleep(200);
      return evalJs(`['Edit Sound','Delete Sound','Move or Copy Sound'].map(title=>{const b=document.querySelector('[data-sound-card]')?.parentElement?.querySelector('button[title="'+title+'"]');return {width:b?.getBoundingClientRect().width,icon:Number(b?.querySelector('svg')?.getAttribute('width'))};})`);
    };
    const small=await setSize(0.5), large=await setSize(2);
    log('SLIDER','B5: action buttons scale with desktop boxes and preserve mobile sizing',
      small?.length===3 && large?.length===3 && small.every(b=>b.width===(driver.isDesktop?22:26) && b.icon===(driver.isDesktop?12:10)) && large.every(b=>b.width===(driver.isDesktop?44:26) && b.icon===(driver.isDesktop?24:10)) ? 'PASS':'FAIL',JSON.stringify({small,large}));
    await driver.exitEditMode();
    // Reset box-size back to 1.0
    await evalJs(`(() => { const s=[...document.querySelectorAll('input[type=range]')].find(s=>s.min==='0.5'); if(s){ const n=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; n.call(s,'1'); s.dispatchEvent(new Event('input',{bubbles:true})); s.dispatchEvent(new Event('change',{bubbles:true})); }})()`);
    await sleep(200);
  }
};
