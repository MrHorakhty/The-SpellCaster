// Shared sound-card indicator spec (Suite U, U1-U7).
//
// This replaces the inline Suite U in e2e-full.mjs and the overlapping Suite R
// ("sound grid") in e2e-mobile.mjs. Mobile R covered R1-R6, which are U1, U2,
// U3, U4 and U6 in a different order; the two suites disagreed only on two
// checks the mobile suite never had: U5 (the multi-file "files available" icon
// on Shield Bash, which carries two files) and U7 (the total count of loop
// icons). Running one spec from both entrypoints therefore closes the mobile
// "card indicators (U, partial)" gap without adding a near-duplicate suite.
//
// The fixture is the shared SEED: Smite loops and glows, Shield Bash has two
// files and does not loop, Healing Light loops. That gives exactly the two loop
// icons U7 expects.
//
// After the reload the window helpers are gone (every load wipes them), so
// PAGE_HELPERS is re-injected: the suites that run after this one still expect
// __setInput and friends to be present.

import { PAGE_HELPERS, SEED, awaitBoard } from '../lib/page.mjs';

export const indicators = {
  title: 'SUITE U: CARD INDICATORS',
  async run(ctx) {
    const { log, evalJs, reload } = ctx;

    await evalJs(SEED);
    await reload();
    await awaitBoard(ctx, { min: 1, seed: SEED });
    await evalJs(PAGE_HELPERS);

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

    if (suiteU?.__error) log('INDICATOR', 'Suite U', 'FAIL', suiteU.__error);
    else for (const r of suiteU) log(r.cat, r.n, r.s, r.d);
  }
};