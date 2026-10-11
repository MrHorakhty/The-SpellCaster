// Shared single-view scroll spec (Suite R, R1-R10).
//
// Ported from e2e-run.mjs Suite A (SINGLE-VIEW SCROLL). It is the only coverage
// of the board's scroll containment, and that containment is laid out
// DIFFERENTLY on the two platforms:
//
//   desktop — the board is its own scroll container. The panel that holds the
//             cards carries overflow-y-auto (App.jsx:4696) and the sidebar sits
//             outside it, so it stays pinned while the grid scrolls.
//   mobile  — the board panel does NOT scroll (App.jsx:5186 has no
//             overflow-y-auto). The whole main-content column is the scroll
//             container (App.jsx:5044) and the icon rail is INSIDE it, so the
//             rail scrolls away with the content. That is the shipped design,
//             not a bug, and R8 asserts the correct expectation per platform
//             rather than pretending the desktop one applies everywhere.
//
// So the spec never hardcodes a selector for the scroll container: it walks up
// from a card to the nearest ancestor that actually scrolls. That is the one
// definition both layouts agree on.
//
// The board is deliberately large (60 sounds). One column of 60 cards overflows
// a phone far more reliably than a wrap of them does on a desktop, and a test
// that silently stops overflowing stops testing anything — R3 is the guard that
// says so out loud.

export const scroll = {
  title: 'SUITE R: SINGLE-VIEW SCROLL',
  async run(ctx) {
    const { log, evalJs, sleep, reload, driver } = ctx;
    const expectMobile = driver.platform === 'mobile';

    // 60 sounds on one character. boxSize and backgroundSettings are cleared so
    // the card size is the default, whatever a previous spec left behind.
    const seed = `(() => {
      const mk = (i) => ({ id:'r'+i, name:'Scroll '+i, type:'Generic', icon:'', loop:false, randomPlay:false,
        files:[{name:'Longbow_4.mp3', displayName:'Longbow_4.mp3'}], color:'#7cc113', duration:0, fadeIn:0, fadeOut:0 });
      const sounds = Array.from({length:60}, (_,i) => mk(i+1));
      localStorage.setItem('ttrpg_characters', JSON.stringify([{ id:'c1', name:'Human Paladin', sounds }]));
      localStorage.setItem('ttrpg_environment', JSON.stringify([]));
      localStorage.setItem('ttrpg_groups', JSON.stringify([]));
      localStorage.setItem('ttrpg_themes', JSON.stringify([]));
      localStorage.setItem('ttrpg_data_version', '3');
      localStorage.removeItem('backgroundSettings');
      localStorage.removeItem('boxSize');
      for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k.startsWith('sound_file_')) localStorage.removeItem(k);}
      return 'seeded';
    })()`;

    await evalJs(seed);
    await reload();

    // A settle beat: the grid has to lay out 60 cards before scrollHeight means
    // anything. Sizing can also settle a frame late after the reload.
    await sleep(1500);

    // The scroll container is the nearest ANCESTOR of a card that both scrolls
    // and has something to scroll. Walking up rather than matching a class is
    // what lets one spec cover a per-board panel and a whole-page column.
    const find = `(() => {
      const card = document.querySelector('[data-sound-card]');
      if (!card) return null;
      for (let el = card.parentElement; el && el !== document.body; el = el.parentElement) {
        const s = getComputedStyle(el);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el;
      }
      return null;
    })()`;

    // The card LAYOUT container is the nearest ancestor holding MORE than one
    // card. A card's own parentElement is not it: per-sound volume added a
    // wrapper level (outer = grid cell + volume row, inner = the card), so the
    // immediate parent is a single-card relative div.
    // NB: no backticks anywhere in this comment — the body is a JS template literal.
    const layoutOf = `(() => {
      const card = document.querySelector('[data-sound-card]');
      let el = card;
      while (el && el.querySelectorAll('[data-sound-card]').length < 2 && el.parentElement) el = el.parentElement;
      return el ? (el.className || '') : '';
    })()`;

    const r1 = await evalJs(`(() => {
      const scroller = ${find};
      const card = document.querySelector('[data-sound-card]');
      return {
        found: !!scroller,
        cls: scroller ? (scroller.className || '') : '',
        holdsCards: scroller ? scroller.contains(card) : false,
        scrollH: scroller?.scrollHeight, clientH: scroller?.clientHeight,
        layoutCls: ${layoutOf},
        cards: document.querySelectorAll('[data-sound-card]').length
      };
    })()`);
    log('SCROLL','R1: the board scrolls inside a container of its own',
      r1?.found===true && r1?.holdsCards===true?'PASS':'FAIL',
      r1?.found ? `cls="${(r1?.cls||'').substring(0,70)}" cards=${r1?.cards}` : `no scroll container; ${r1?.cards} cards on the page`);

    // Desktop wraps with flex; mobile lays out a grid whose column count follows
    // boxSize. Asserting the wrong one would fail on a platform that is correct.
    const layoutOk = expectMobile ? /grid-cols-/.test(r1?.layoutCls||'') : /flex-wrap/.test(r1?.layoutCls||'');
    log('SCROLL','R2: cards use the layout this platform expects',layoutOk?'PASS':'FAIL',`layout="${r1?.layoutCls}"`);

    log('SCROLL','R3: the board is big enough to overflow',(r1?.scrollH ?? 0) > (r1?.clientH ?? 0) + 1?'PASS':'FAIL',
      `scrollH=${r1?.scrollH} clientH=${r1?.clientH} — if this fails the rest of the suite is vacuous`);

    // ---- scroll to the bottom and back --------------------------------------
    const scrolled = await evalJs(`(() => {
      const scroller = ${find};
      if (!scroller) return { found:false };
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'instant' });
      const rail = document.querySelector('div.shrink-0.bg-dark-800.rounded-xl');
      return { found:true, scrollTop: scroller.scrollTop, clientH: scroller.clientHeight, scrollH: scroller.scrollHeight,
               pageY: window.scrollY, docH: document.documentElement.scrollHeight, innerH: window.innerHeight,
               bodyW: document.body.scrollWidth, innerW: window.innerWidth,
               railTop: rail ? rail.getBoundingClientRect().top : null,
               scrollerTop: scroller.getBoundingClientRect().top };
    })()`);
    log('SCROLL','R4: the board scrolls to the bottom',scrolled?.scrollTop>0?'PASS':'FAIL',`scrollTop=${scrolled?.scrollTop}`);
    log('SCROLL','R5: the bottom is actually reached',
      (scrolled?.scrollTop ?? 0) + (scrolled?.clientH ?? 0) >= (scrolled?.scrollH ?? 0) - 1 ? 'PASS':'FAIL',
      `scrollTop=${scrolled?.scrollTop} clientH=${scrolled?.clientH} scrollH=${scrolled?.scrollH}`);

    // The window itself must never scroll on either platform. If it does, the
    // layout is scrolling the document instead of a container, which is the bug
    // this whole suite exists to catch.
    log('SCROLL','R6: the PAGE did not scroll, only the board content',scrolled?.pageY===0?'PASS':'FAIL',`window.scrollY=${scrolled?.pageY}`);
    log('SCROLL','R7: no document-level vertical overflow',Math.abs((scrolled?.docH ?? 0)-(scrolled?.innerH ?? 0))<2?'PASS':'FAIL',
      `docH=${scrolled?.docH} innerH=${scrolled?.innerH}`);

    // ---- the nav chrome, which differs by platform --------------------------
    // Returning to the top and measuring again. Desktop: the sidebar is outside
    // the scroll container, so it must not have moved. Mobile: the rail is
    // inside the scrolling column by design (App.jsx:5044 wraps it), so it MUST
    // have moved with the content. Asserting the desktop expectation on mobile
    // would be asserting a layout this app does not have.
    const r8 = await evalJs(`(() => {
      const scroller = ${find};
      const nav = document.querySelector('div.shrink-0.bg-dark-800.rounded-xl');
      if (!scroller || !nav) return { nav: !!nav, scroller: !!scroller };
      const atBottom = nav.getBoundingClientRect().top;
      scroller.scrollTo({ top: 0, behavior: 'instant' });
      const atTop = nav.getBoundingClientRect().top;
      return { nav:true, atBottom, atTop, moved: Math.abs(atBottom - atTop) >= 2 };
    })()`);
    const pinnedOk = expectMobile ? r8?.moved === true : r8?.moved === false;
    log('SCROLL','R8: the nav chrome behaves as this layout intends',pinnedOk?'PASS':'FAIL',
      `top ${r8?.atBottom} -> ${r8?.atTop}; moved=${r8?.moved}; expectMobile=${expectMobile}` +
      (expectMobile ? ' (mobile: the rail lives inside the scrolling column)' : ' (desktop: the sidebar sits outside it)'));

    const r9 = await evalJs(`(() => {
      const scroller = ${find};
      if (!scroller) return { found:false };
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'instant' });
      return { found:true, scrollTop: scroller.scrollTop };
    })()`);
    log('SCROLL','R9: the board re-scrolls after returning to the top',r9?.scrollTop>0?'PASS':'FAIL',`scrollTop=${r9?.scrollTop}`);

    log('SCROLL','R10: no horizontal overflow',(scrolled?.bodyW ?? 0) <= (scrolled?.innerW ?? 0) + 5 ? 'PASS':'FAIL',
      `bodyW=${scrolled?.bodyW} innerW=${scrolled?.innerW}`);
  }
};
