// Shared per-sound volume spec (Suite P, P1-P16).
//
// Extracted from e2e-full.mjs Suite P and e2e-mobile.mjs Suite P, which were
// line-for-line the same assertions with two platform divergences: the trusted
// P9 gesture (desktop CDP mouse vs mobile touch) and the edit-mode toggle
// (sidebar vs grid header). Both now flow through the platform driver.
//
// The seed is deliberately self-contained: one sound with an explicit 0.5 trim
// and one with NO `volume` field at all (absent === 100%), both loop:true on a
// REAL bundled asset so they stay registered (a tiny data: clip loops never
// engage). Requires per-sound volume support (PER_SOUND_VOLUME_SPEC.md).

import { KNOWN_KEYS } from '../lib/page.mjs';

export const volume = {
  title: 'SUITE P: PER-SOUND VOLUME',
  async run(ctx) {
    const { log, evalJs, sleep, reload, submitModal, driver } = ctx;

    // Same seed as the original suites: trimmed sound plus one with no field.
    const seed = `(() => {
      localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([{
        id:'c1', name:'Human Paladin', sounds:[
          { id:'vol_half', name:'Half Volume', type:'Test', icon:'',
            files:[{name:'Longbow_4.mp3', displayName:'Longbow_4.mp3'}],
            color:'#ff0000', duration:0, fadeIn:0, fadeOut:0, loop:true, randomPlay:false,
            brightness:1, volume:0.5 },
          { id:'vol_none', name:'No Field', type:'Test', icon:'',
            files:[{name:'Frostbite_3.mp3', displayName:'Frostbite_3.mp3'}],
            color:'#00ff00', duration:0, fadeIn:0, fadeOut:0, loop:true, randomPlay:false,
            brightness:1 }
        ]
      }]));
      localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_groups'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_themes'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_data_version'), '3');
      for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k.startsWith('profile:'+window.__pid()+':sound_file_')) localStorage.removeItem(k);}
      return 'seeded';
    })()`;

    // Re-injected after every reload (window state does not survive one).
    // React tracks the range's value on the DOM node, so setting .value directly
    // is not seen; go through the native setter and fire a bubbling input event.
    // The master lookup keeps BOTH header sliders out of the picture: on mobile
    // one title="Volume:" range is visible, on desktop exactly one exists.
    const volHelpers = `(() => {
      window.__setRange = (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, String(v));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      window.__master = () => {
        const list = [...document.querySelectorAll('input[type=range][title^="Volume:"]')];
        return list.find(s => s.offsetParent !== null) || list[0] || null;
      };
      window.__volSlider = (name) => {
        const card = [...document.querySelectorAll('[data-sound-card]')].find(c => c.textContent.includes(name));
        if (!card) return null;
        return document.querySelector('[data-sound-volume="' + card.dataset.soundId + '"]');
      };
      window.__commitVol = (name, v) => {
        const s = window.__volSlider(name);
        if (!s) return 'NO_SLIDER';
        window.__setRange(s, v);
        s.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        return s.value;
      };
      window.__volCard = (id) => document.querySelector('[data-sound-card][data-sound-id="' + id + '"]');
      window.__playCard = (id) => { const c = window.__volCard(id); if (!c) return 'NO_CARD'; c.click(); return 'OK'; };
      // Capture every Audio the app constructs so playback internals are assertable.
      if (!window.__origAudio) {
        window.__audios = [];
        window.__origAudio = window.Audio;
        window.Audio = function(...a) { const el = new window.__origAudio(...a); window.__audios.push(el); return el; };
        window.Audio.prototype = window.__origAudio.prototype;
      }
      return 'ok';
    })()`;

    await evalJs(seed);
    await reload();
    await evalJs(volHelpers);

    // P1-P4: the control exists on every card, sits OUTSIDE the role="button"
    // card (so dragging it cannot play the sound and it is not a nested
    // interactive control inside a button role), and defaults to 100% when the
    // field is absent.
    const p1 = await evalJs(`(() => {
      const cards = [...document.querySelectorAll('[data-sound-card]')];
      const sliders = [...document.querySelectorAll('[data-sound-volume]')];
      return {
        cards: cards.length,
        sliders: sliders.length,
        nested: sliders.filter(s => s.closest('[data-sound-card]')).length,
        outside: sliders.length > 0 && sliders.every(s => !s.closest('[data-sound-card]')),
        values: sliders.map(s => s.value),
        aria: sliders.map(s => s.getAttribute('aria-label'))
      };
    })()`);
    log('VOL','P1: every card exposes a volume slider',p1?.cards>0 && p1?.sliders===p1?.cards?'PASS':'FAIL',JSON.stringify(p1));
    log('VOL','P2: slider is outside the role=button card',p1?.outside && p1?.nested===0?'PASS':'FAIL',`nested=${p1?.nested}`);
    log('VOL','P3: absent volume field reads 100%',p1?.values?.includes('1')?'PASS':'FAIL',JSON.stringify(p1?.values));
    log('VOL','P4: slider carries an aria-label',p1?.aria?.every(a=>!!a)?'PASS':'FAIL',JSON.stringify(p1?.aria));

    // P5-P7: playback internals. element.click() is enough here - _soundVolume,
    // _baseVolume and volume are set at construction, before play() can be refused.
    await evalJs(`window.__playCard('vol_half')`);
    await sleep(1200);
    const p5 = await evalJs(`(() => {
      const els = (window.__audios||[]).filter(x => x._soundId === 'vol_half');
      const a = els[els.length-1];
      return a ? { trim:a._soundVolume, base:a._baseVolume, vol:a.volume } : null;
    })()`);
    log('VOL','P5: element records the sound own trim',p5?.trim===0.5?'PASS':'FAIL',JSON.stringify(p5));
    log('VOL','P6: level is master x trim (1 x 0.5)',p5?.base===0.5 && p5?.vol===0.5?'PASS':'FAIL',JSON.stringify(p5));

    // P7: a sound with no field at all plays at 100%.
    await evalJs(`window.__playCard('vol_none')`);
    await sleep(1000);
    const p7 = await evalJs(`(() => {
      const els = (window.__audios||[]).filter(x => x._soundId === 'vol_none');
      const a = els[els.length-1];
      return a ? { trim:a._soundVolume, base:a._baseVolume, vol:a.volume } : null;
    })()`);
    log('VOL','P7: sound with no field plays at 100%',p7?.trim===1 && p7?.base===1?'PASS':'FAIL',JSON.stringify(p7));

    // P8: master x trim is the audible product - master 0.4 with a 0.5 trim = 0.2.
    await evalJs(`(() => { const m=window.__master(); if(!m) return 'NO_MASTER'; window.__setRange(m, 0.4); return 'OK'; })()`);
    await sleep(400);
    await evalJs(`window.__playCard('vol_half')`);
    await sleep(1000);
    const p8 = await evalJs(`(() => {
      const els = (window.__audios||[]).filter(x => x._soundId === 'vol_half');
      const a = els[els.length-1];
      return a ? { base:a._baseVolume, vol:a.volume, trim:a._soundVolume } : null;
    })()`);
    log('VOL','P8: master 0.4 x trim 0.5 = 0.2',p8?.base===0.2 && p8?.vol===0.2?'PASS':'FAIL',JSON.stringify(p8));

    // P9: the master path multiplies by each element's OWN trim, and keeps
    // _baseVolume in step. Self-contained on purpose: it creates one fresh
    // element and walks it through two master values. Only REGISTERED elements
    // get rescaled, so the two-step below is self-discriminating - a fresh
    // element created at master 1 starts at 0.5, so seeing it drop to 0.2 proves
    // it was still registered when the master changed. The seeded sounds loop,
    // so it is. The tap is a REAL platform gesture (desktop mouse / mobile
    // touch), not element.click(): a synthetic click is not a user gesture, so
    // autoplay is refused and play() rejects.
    const halfCoords = await driver.centeredCard('[data-sound-card][data-sound-id="vol_half"]');
    await evalJs(`(() => { const m=window.__master(); if(m) window.__setRange(m, 1); return 'OK'; })()`);
    await sleep(300);
    const before9 = await evalJs(`(() => { window.__n9 = (window.__audios||[]).filter(x => x._soundId === 'vol_half').length; return { n: window.__n9 }; })()`);
    log('VOL','P9-setup: trusted gesture path available',halfCoords && before9?.n>=0?'PASS':'FAIL',JSON.stringify({coords:halfCoords,prior:before9}));
    if (halfCoords) { await driver.trustedTap(halfCoords.x, halfCoords.y); }
    await sleep(700);
    const fresh = await evalJs(`(() => {
      const els = (window.__audios||[]).filter(x => x._soundId === 'vol_half');
      if (els.length <= window.__n9) return null;
      window.__p9el = els[els.length-1];
      return { base: window.__p9el._baseVolume, vol: window.__p9el.volume, trim: window.__p9el._soundVolume };
    })()`);
    log('VOL','P9a: fresh element starts at master 1 x trim 0.5',fresh?.base===0.5 && fresh?.vol===0.5?'PASS':'FAIL',JSON.stringify(fresh));

    // Master down to 0.4 -> the live element must become 0.2 (and _baseVolume
    // too, because playSound reads it back at loop re-entry).
    await evalJs(`(() => { const m=window.__master(); if(m) window.__setRange(m, 0.4); return 'OK'; })()`);
    await sleep(300);
    const p9down = await evalJs(`window.__p9el ? { base: window.__p9el._baseVolume, vol: window.__p9el.volume } : null`);
    log('VOL','P9b: master 0.4 rescales the live element to 0.2',Math.abs((p9down?.vol ?? 0) - 0.2) < 0.001?'PASS':'FAIL',JSON.stringify(p9down));

    // Back to 1 -> 0.5 again. A stale _baseVolume would leave the loop re-entry
    // fading this sound to the level it started at.
    await evalJs(`(() => { const m=window.__master(); if(m) window.__setRange(m, 1); return 'OK'; })()`);
    await sleep(300);
    const p9up = await evalJs(`window.__p9el ? { base: window.__p9el._baseVolume, vol: window.__p9el.volume } : null`);
    log('VOL','P9c: master back to 1 restores 0.5',Math.abs((p9up?.vol ?? 0) - 0.5) < 0.001?'PASS':'FAIL',JSON.stringify(p9up));
    log('VOL','P9d: _baseVolume tracks the master change (loop re-entry)',Math.abs((p9up?.base ?? 0) - 0.5) < 0.001?'PASS':'FAIL',JSON.stringify(p9up));

    // P10-P12: persistence. 0 is the regression guard for the `||` trap: a muted
    // sound must still be muted after the save/reload cycle.
    const p10pre = await evalJs(`window.__commitVol('Half Volume', 0)`);
    await sleep(600);
    const p10stored = await evalJs(`(() => {
      const c = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
      return c[0]?.sounds?.map(s => [s.id, s.volume]);
    })()`);
    log('VOL','P10: commit wrote 0 to storage',p10pre==='0' && JSON.stringify(p10stored)?.includes('["vol_half",0]')?'PASS':'FAIL',`slider=${p10pre} stored=${JSON.stringify(p10stored)}`);

    await reload();
    await evalJs(volHelpers);

    const p11 = await evalJs(`(() => {
      const c = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
      const s = window.__volSlider('Half Volume');
      const none = window.__volSlider('No Field');
      return {
        stored: c[0]?.sounds?.find(x=>x.id==='vol_half')?.volume,
        slider: s?.value,
        noneSlider: none?.value,
        version: localStorage.getItem(window.__pk('ttrpg_data_version')),
        oldKeys: window.__bareKeys().filter(k=>k.endsWith('_old'))
      };
    })()`);
    log('VOL','P11: 0 SURVIVES reload (the || trap)',p11?.stored===0 && p11?.slider==='0'?'PASS':'FAIL',JSON.stringify(p11));
    log('VOL','P12: untouched sound still reads 100% after reload',p11?.noneSlider==='1'?'PASS':'FAIL',p11?.noneSlider);
    log('VOL','P13: DATA_VERSION still 3, no *_old keys',p11?.version==='3' && p11?.oldKeys?.length===0?'PASS':'FAIL',JSON.stringify({v:p11?.version,old:p11?.oldKeys}));

    // P14: the feature added no storage key. The sound's level rides INSIDE the
    // existing sound objects, and the master volume stays session-only.
    // `ttrpg_themes` is in the expected set because the suites themselves still
    // seed it - the app has no such key (docs/session-history.md:979).
    const p14 = await evalJs(`window.__bareKeys()`);
    const unexpected = (p14||[]).filter(k => !KNOWN_KEYS.includes(k));
    const volumeKeys = (p14||[]).filter(k => /volume/i.test(k));
    log('VOL','P14a: no new localStorage key added',unexpected.length===0?'PASS':'FAIL',JSON.stringify(unexpected));
    log('VOL','P14b: no key holds volume (it rides the sound object)',volumeKeys.length===0?'PASS':'FAIL',JSON.stringify(volumeKeys));

    // P15-P16: the edit modal reads the same field and writing it updates the card.
    await driver.enterEditMode();
    await evalJs(`(() => {
      const c = window.__volCard('vol_half');
      const b = c?.parentElement?.querySelector('button[title="Edit Sound"]');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(800);
    const p15 = await evalJs(`(() => ({
      range: document.querySelector('#soundVolumeRange')?.value,
      number: document.querySelector('#soundVolumeNumber')?.value
    }))()`);
    log('VOL','P15: modal slider mirrors the persisted level',p15?.range==='0' && p15?.number==='0'?'PASS':'FAIL',JSON.stringify(p15));

    await evalJs(`(() => {
      const el = document.querySelector('#soundVolumeRange');
      if (!el) return 'NO_RANGE';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, '0.5');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return 'OK';
    })()`);
    await submitModal('Save Changes');
    await sleep(1000);
    await driver.exitEditMode();
    const p16 = await evalJs(`(() => {
      const c = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
      return {
        stored: c[0]?.sounds?.find(x=>x.id==='vol_half')?.volume,
        slider: window.__volSlider('Half Volume')?.value
      };
    })()`);
    log('VOL','P16: modal write persists and the card slider follows',p16?.stored===0.5 && p16?.slider==='0.5'?'PASS':'FAIL',JSON.stringify(p16));
  }
};