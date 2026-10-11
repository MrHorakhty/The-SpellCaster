// Shared sound-into-group spec (Suite H, H1-H2).
//
// Closes the mobile "sound-into-group (H)" gap. A group category is a container
// shape the mobile board only reaches through the drawer, so the navigation is
// the platform-divergent part and lives in the entrypoints (ctx.navigateTo):
// desktop clicks a sidebar leaf, mobile opens the drawer and clicks the group
// then its category. Everything after that is identical - the group board's
// edit bar / drawer both offer Add Sound, the modal and the upload helper are
// platform-specific (CDP file input vs in-page DataTransfer, see ctx.upload),
// and the assertion reads ttrpg_groups straight out of localStorage.
//
// The fixture is the shared SEED (Tavern Pack > Ambience holds "Tavern Song").
// The name typed here MUST NOT already exist in that category.

import { PAGE_HELPERS } from '../lib/page.mjs';

export const soundIntoGroup = {
  title: 'SUITE H: SOUND INTO GROUP',
  async run(ctx) {
    const { log, evalJs, sleep, submitModal, upload, navigateTo, clickModalOpener, closeDrawer, driver } = ctx;

    // The suites that ran before this one may have reloaded (every load wipes
    // window globals), so make sure the helpers this spec uses are present.
    await evalJs(PAGE_HELPERS);

    const nav1 = await navigateTo('Tavern Pack');
    const nav2 = await navigateTo('Ambience');
    await driver.enterEditMode();

    const grpAddSoundOpen = await clickModalOpener('Add Sound');
    await sleep(700);

    let uploaded = null;
    if (String(grpAddSoundOpen).startsWith('OK')) {
      // Self-contained input write - do not depend on a surviving __setInput.
      await evalJs(`(() => {
        const el = document.querySelector('input[name="name"]');
        if (!el) return 'NO_INPUT';
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, 'Tavern Echo');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return 'OK';
      })()`);
      uploaded = await upload();
      await sleep(700);
      await submitModal('Add Sound');
      await sleep(1200);
    } else {
      log('GRP', 'H1: WAV uploaded to group', 'FAIL', 'Add Sound not reachable: ' + grpAddSoundOpen);
    }

    if (uploaded !== null) {
      log('GRP', 'H1: WAV uploaded to group', uploaded ? 'PASS' : 'FAIL',
        `nav1=${nav1} nav2=${nav2} open=${grpAddSoundOpen} upload=${uploaded}`);
    }

    const grpSoundAdded = await evalJs(`(() => {
      const g = JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups')) || '[]').find(x => x.name === 'Tavern Pack');
      const cat = g?.categories?.find(c => c.category === 'Ambience');
      return cat?.sounds?.some(s => s.name === 'Tavern Echo');
    })()`);
    log('GRP', 'H2: group sound persisted', grpSoundAdded === true ? 'PASS' : 'FAIL');

    await driver.exitEditMode();
    await closeDrawer();
  }
};