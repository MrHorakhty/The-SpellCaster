// Shared drag-to-reorder spec (Suite X, X1-X2).
//
// Closes the mobile "drag reorder (X)" gap. The reorder is pointer-event based
// (App.jsx: onPointerDown arms a dragRef, the first move past 4px promotes to
// document-level pointermove/pointerup listeners, and pointerup commits
// moveSound), so the identical code path serves a mouse and a finger - a CDP
// touch drag synthesizes pointer events with pointerType 'touch'. Only the
// delivery differs, and that lives in driver.dragFromTo.
//
// Edit mode is mandatory: outside it the press arms the press-and-hold PRIME
// instead of a drag (the two share onPointerDown), and the drag branch bails on
// !editMode.
//
// Self-contained four-sound fixture, so the spec does not depend on an earlier
// suite having added a sound. Names match the old inline suite exactly so a
// regression stays comparable against an older log.

import { PAGE_HELPERS } from '../lib/page.mjs';

export const dragReorder = {
  title: 'SUITE X: DRAG REORDER',
  async run(ctx) {
    const { log, evalJs, sleep, reload, driver } = ctx;

    const seedX = `(() => {
      const snd = (id, name, color, opts) => Object.assign({
        id, name, type: 'Test', icon: 'Icon.png',
        files: [{ name: name.toLowerCase().replace(/\\s+/g, '_') + '.mp3', displayName: name + '.mp3' }],
        color, duration: 0, randomPlay: false, loop: false
      }, opts || {});
      localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([
        { id: 'c1', name: 'Human Paladin', sounds: [
          snd('x1', 'Smite', '#ff0000', { loop: true }),
          snd('x2', 'Shield Bash', '#3b82f6'),
          snd('x3', 'Healing Light', '#22c55e', { loop: true }),
          snd('x4', 'Divine Light', '#a855f7')
        ] }
      ]));
      localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_groups'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_themes'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_data_version'), '3');
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('profile:'+window.__pid()+':sound_file_')) localStorage.removeItem(k); }
      return 'seeded';
    })()`;

    const order = `(() => {
      const c = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')) || '[]');
      const pal = c.find(x => x.name === 'Human Paladin');
      return pal?.sounds?.map(s => s.name) || [];
    })()`;

    // A reload returns the app to the default Human Paladin board, so the four
    // cards are on screen whatever the previous suite navigated to.
    await evalJs(seedX);
    await reload();
    await evalJs(PAGE_HELPERS);

    await driver.enterEditMode();
    const orderBefore = await evalJs(order);
    log('DRAG', 'X1: order before drag', orderBefore?.length === 4 ? 'PASS' : 'FAIL', JSON.stringify(orderBefore));

    // Center both cards and take FRESH coordinates: CDP input is viewport
    // relative, and the mobile board is a 2-column grid where a later card can
    // start off-screen.
    const src = await driver.centeredCard('[data-sound-card][data-sound-id="x4"]');
    const tgt = await driver.centeredCard('[data-sound-card][data-sound-id="x1"]');

    if (src && tgt) {
      await driver.dragFromTo(src, tgt);
      await sleep(600);
      const orderAfter = await evalJs(order);
      const reordered = orderAfter?.[0] === 'Divine Light' || JSON.stringify(orderAfter) !== JSON.stringify(orderBefore);
      log('DRAG', 'X2: order changed', reordered ? 'PASS' : 'FAIL',
        'before=' + JSON.stringify(orderBefore) + ' after=' + JSON.stringify(orderAfter));
    } else {
      log('DRAG', 'X2: drag skipped', JSON.stringify({ src, tgt }));
    }

    await driver.exitEditMode();
  }
};