// Shared sound-into-group and glow persistence spec (Suite H, H1-H13).
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
    const { log, evalJs, sleep, reload, submitModal, upload, navigateTo, clickModalOpener, closeDrawer, driver } = ctx;

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
      uploaded = await upload(3);
      await sleep(700);
      await evalJs(`(() => {
        const label = [...document.querySelectorAll('span')].find(s => s.textContent === 'Enable Glow Effect');
        label?.parentElement?.parentElement?.querySelector('button')?.click();
      })()`);
      await sleep(200);
      await evalJs(`(() => {
        const el = document.querySelector('input[name="glowProminence"]');
        if (!el) return 'NO_GLOW';
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '0.73');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      const layout = await evalJs(`(() => {
        const first = document.querySelector('[data-fade-row]');
        const tint = document.querySelector('input[name="color"]');
        const glow = document.querySelector('[data-glow-controls]');
        const before = (a,b) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
        return { rows:document.querySelectorAll('[data-fade-row]').length,
          random:before(document.querySelector('#randomPlay'),first), loop:before(document.querySelector('#loop'),first),
          glow:before(tint,glow) && before(glow,document.querySelector('[data-playback-options]')) };
      })()`);
      log('GRP','H9: playback options stay above multiple files and glow follows tint',layout?.rows===3 && layout?.random && layout?.loop && layout?.glow ? 'PASS':'FAIL',JSON.stringify(layout));
      await evalJs(`(() => {
        const el = document.querySelector('input[name="color"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'#ff0000');
        el.dispatchEvent(new Event('input',{bubbles:true}));
      })()`);
      await evalJs(`(() => {
        const el = document.querySelector('[aria-label="Glow color hue"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'240');
        el.dispatchEvent(new Event('input',{bubbles:true}));
      })()`);
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

    const storedGlow = `(() => {
      const g = JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups')) || '[]').find(x => x.name === 'Tavern Pack');
      return g?.categories?.find(c => c.category === 'Ambience')?.sounds?.find(s => s.name === 'Tavern Echo');
    })()`;
    const added = await evalJs(storedGlow);
    log('GRP', 'H3: new sound saves enabled glow and chosen prominence', added?.glowEnabled === true && Number(added?.glowProminence) === 0.73 ? 'PASS' : 'FAIL', JSON.stringify(added));
    log('GRP','H10: new sound stores independent tint and glow colors',added?.color==='#ff0000' && added?.glowColor==='#0000ff' ? 'PASS':'FAIL',JSON.stringify({tint:added?.color,glow:added?.glowColor}));
    const actionSizes = await evalJs(`(() => {
      const card=[...document.querySelectorAll('[data-sound-card]')].find(c=>c.textContent.includes('Tavern Echo'));
      return ['Edit Sound','Delete Sound','Move or Copy Sound'].map(title=>{
        const b=card?.parentElement?.querySelector('button[title="'+title+'"]');
        return {title,width:b?.getBoundingClientRect().width,height:b?.getBoundingClientRect().height,icon:b?.querySelector('svg')?.getAttribute('width')};
      });
    })()`);
    log('GRP','H11: action hit areas and icons use platform sizing',actionSizes?.length===3 && actionSizes.every(b=>b.width>=(driver.isDesktop?30:26) && b.height>=(driver.isDesktop?30:26) && b.icon===(driver.isDesktop?'16':'10')) ? 'PASS':'FAIL',JSON.stringify(actionSizes));

    await reload();
    await navigateTo('Tavern Pack');
    await navigateTo('Ambience');
    await closeDrawer();
    const reloaded = await evalJs(storedGlow);
    const shadow = await evalJs(`(() => {
      const card = [...document.querySelectorAll('[data-sound-card]')].find(c => c.textContent.includes('Tavern Echo'));
      return card?.style.boxShadow;
    })()`);
    log('GRP', 'H4: new glow survives reload and renders on the card', reloaded?.glowEnabled === true && Number(reloaded?.glowProminence) === 0.73 && shadow && shadow !== 'none' ? 'PASS' : 'FAIL', String(shadow));
    log('GRP','H12: independent glow color survives reload and renders blue',reloaded?.glowColor==='#0000ff' && String(shadow).includes('rgb(0, 0, 255)') ? 'PASS':'FAIL',String(shadow));

    await driver.enterEditMode();
    await evalJs(`(() => {
      const card = [...document.querySelectorAll('[data-sound-card]')].find(c => c.textContent.includes('Tavern Echo'));
      card?.parentElement?.querySelector('button[title="Edit Sound"]')?.click();
    })()`);
    await sleep(500);
    const reopened = await evalJs(`document.querySelector('input[name="glowProminence"]')?.value`);
    log('GRP', 'H5: edit modal restores saved glow prominence', reopened === '0.73' ? 'PASS' : 'FAIL', String(reopened));
    const colorRestored = await evalJs(`document.querySelector('#glowColor')?.value`);
    await evalJs(`(() => {
      const el=document.querySelector('input[name="color"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'#00ff00');
      el.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    log('GRP','H13: changing tint leaves saved glow color alone',colorRestored==='#0000ff' && await evalJs(`document.querySelector('#glowColor')?.value`)==='#0000ff' ? 'PASS':'FAIL',String(colorRestored));
    await evalJs(`(() => {
      const el = document.querySelector('input[name="glowProminence"]');
      if (!el) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '0');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await submitModal('Save Changes');
    await sleep(700);
    await reload();
    await navigateTo('Tavern Pack');
    await navigateTo('Ambience');
    await driver.enterEditMode();
    await evalJs(`(() => {
      const card = [...document.querySelectorAll('[data-sound-card]')].find(c => c.textContent.includes('Tavern Echo'));
      card?.parentElement?.querySelector('button[title="Edit Sound"]')?.click();
    })()`);
    await sleep(500);
    const zero = await evalJs(`document.querySelector('input[name="glowProminence"]')?.value`);
    const savedZero = await evalJs(storedGlow);
    log('GRP', 'H6: zero prominence survives save reload and reopening', zero === '0' && Number(savedZero?.glowProminence) === 0 ? 'PASS' : 'FAIL', String(zero));
    await evalJs(`(() => {
      const label = [...document.querySelectorAll('span')].find(s => s.textContent === 'Enable Glow Effect');
      label?.parentElement?.parentElement?.querySelector('button')?.click();
    })()`);
    await submitModal('Save Changes');
    await sleep(700);
    const disabled = await evalJs(storedGlow);
    log('GRP', 'H7: disabling glow persists without resetting zero prominence', disabled?.glowEnabled === false && Number(disabled?.glowProminence) === 0 ? 'PASS' : 'FAIL');

    // Imported/seeded JSON may contain a numeric zero, while the range writes
    // strings. Both are valid: numeric 0 must not take the legacy `|| 0.5` path.
    await evalJs(`(() => {
      const groups = JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups')));
      const sound = groups.find(g => g.name === 'Tavern Pack').categories.find(c => c.category === 'Ambience').sounds.find(s => s.name === 'Tavern Echo');
      sound.glowEnabled = true;
      sound.glowProminence = 0;
      localStorage.setItem(window.__pk('ttrpg_groups'), JSON.stringify(groups));
    })()`);
    await reload();
    await navigateTo('Tavern Pack');
    await navigateTo('Ambience');
    await closeDrawer();
    const numericShadow = await evalJs(`(() => {
      const card = [...document.querySelectorAll('[data-sound-card]')].find(c => c.textContent.includes('Tavern Echo'));
      return card?.style.boxShadow;
    })()`);
    await driver.enterEditMode();
    await evalJs(`(() => {
      const card = [...document.querySelectorAll('[data-sound-card]')].find(c => c.textContent.includes('Tavern Echo'));
      card?.parentElement?.querySelector('button[title="Edit Sound"]')?.click();
    })()`);
    await sleep(500);
    const numericZero = await evalJs(`document.querySelector('input[name="glowProminence"]')?.value`);
    log('GRP', 'H8: numeric zero renders minimum glow and reopens as zero', numericZero === '0' && String(numericShadow).includes('5px 0.1px') ? 'PASS' : 'FAIL', JSON.stringify({numericZero, numericShadow}));
    await submitModal('Save Changes');
    await sleep(700);

    await driver.exitEditMode();
    await closeDrawer();
  }
};
