// Shared per-file fades spec (Suite FADE, FADE1-FADE7).
//
// Runs from BOTH entrypoints (web + win via e2e-full.mjs, android via
// e2e-mobile.mjs). It drives the sound modal's per-file fade rows, which only
// exist in edit mode, so it enters edit mode, opens a sound's modal, asserts
// the model, saves, then drives live playback of the edited sound.
//
// The fades model is `audibleEnd = min(fileLength, playUntil)` with both fades
// measuring back from that end (FADE_SPEC §2). A long shipped asset
// (Tavern_Music.mp3, 152.4 s) is the fixture because a fade only runs if the
// file outlives the fade timer — the whole reason the old sound-level
// `duration` schedule produced Z15's four silent no-ops. Those no-ops are the
// defect this spec replaces: they are now unrepresentable, so the negative
// cases assert the new clamped behaviour instead.
//
// element.click() is not a user gesture, so live playback is driven with
// driver.trustedTap (real CDP mouse on desktop, real touch on Android).

import { KNOWN_KEYS } from '../lib/page.mjs';

export const fade = {
  title: 'SUITE FADE: PER-FILE FADES',
  async run(ctx) {
    const { log, evalJs, sleep, reload, submitModal, driver } = ctx;

    const seed = `(() => {
      localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([{
        id:'c1', name:'Human Paladin', sounds:[
          // Long file: a fade only runs if the file outlives the fade timer.
          { id:'fade_probe', name:'Fade Probe', type:'Test', icon:'',
            files:[{name:'Tavern_Music.mp3', displayName:'Tavern_Music.mp3',
                     fadeIn:0, fadeOut:0, playUntil:0}],
            color:'#ff0000', loop:false, randomPlay:false, brightness:1 },
          // Short file (0.6 s) with playUntil past the file length and a fade
          // longer than the file - the old "duration past the file" no-op,
          // now clamped so the fade starts at the file's start instead.
          { id:'clamp_probe', name:'Clamp Probe', type:'Test', icon:'',
            files:[{name:'Longbow_4.mp3', displayName:'Longbow_4.mp3',
                     fadeIn:0, fadeOut:2, playUntil:5}],
            color:'#00ff00', loop:false, randomPlay:false, brightness:1 }
        ]
      }]));
      localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_groups'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_themes'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_data_version'), '3');
      for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k.startsWith('profile:'+window.__pid()+':sound_file_')) localStorage.removeItem(k);}
      return 'seeded';
    })()`;

    const helpers = `(() => {
      window.__fadeRow = (fileName) => {
        const rows = [...document.querySelectorAll('[data-fade-row]')];
        return rows.find(r => r.textContent.includes(fileName)) || null;
      };
      // Within a row the three ranges are fade-in, fade-out, play until.
      window.__fadeControl = (row, which) => {
        const idx = { fadeIn:0, fadeOut:1, playUntil:2 }[which];
        const sliders = [...row.querySelectorAll('input[type=range]')];
        const boxes = [...row.querySelectorAll('input[type=number]')];
        return { slider: sliders[idx] || null, box: boxes[idx] || null };
      };
      window.__setRange = (el, v) => {
        if (!el) return 'NO_EL';
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, String(v));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return el.value;
      };
      // The preview audio element reports the real, measured length once
      // metadata loads - the same element the modal already renders (§3).
      window.__measuredLength = (fileName) => {
        const row = window.__fadeRow(fileName);
        if (!row) return null;
        const a = row.querySelector('audio');
        return a ? +a.duration.toFixed(1) : null;
      };
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
    await evalJs(helpers);

    // ------------------------------------------------------------------
    // Open the edit modal on Fade Probe. All fades UI lives there.
    // ------------------------------------------------------------------
    await driver.enterEditMode();
    await evalJs(`(() => {
      const c = document.querySelector('[data-sound-card][data-sound-id="fade_probe"]');
      const b = c?.parentElement?.querySelector('button[title="Edit Sound"]');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(800);

    // ---- FADE1: the row shows the REAL measured length ---------------
    let measured = null;
    for (let i = 0; i < 40 && !(measured && measured > 0); i++) {
      measured = await evalJs('window.__measuredLength("Tavern_Music.mp3")');
      if (!measured || measured <= 0) await sleep(100);
    }
    log('FADE','FADE1: the file row shows the real measured length',
      measured && measured > 0 ? 'PASS' : 'FAIL', `measured=${measured}`);

    // ---- FADE2: every slider spans the file length, ~200 steps -------
    const f2 = await evalJs(`(() => {
      const row = window.__fadeRow('Tavern_Music.mp3');
      if (!row) return null;
      const c = (which) => {
        const ctrl = window.__fadeControl(row, which);
        return ctrl && ctrl.slider ? { max: ctrl.slider.max, step: ctrl.slider.step, val: ctrl.slider.value } : null;
      };
      return { fadeIn: c('fadeIn'), fadeOut: c('fadeOut'), playUntil: c('playUntil') };
    })()`);
    const lenOk = f2 && Object.values(f2).every(c => c && Math.abs(parseFloat(c.max) - measured) < 0.1 && c.step === '1');
    log('FADE','FADE2: every slider spans the file length (~200 steps)',
      lenOk ? 'PASS' : 'FAIL', JSON.stringify(f2));

    // ---- FADE3: the ONE red state, both directions -------------------
    // fadeIn 100 + fadeOut 100 on a 152 s file -> red (overlap). Then fadeIn
    // back to 0 -> 100 < 152 -> not red.
    const setPair = async (fi, fo) => {
      await evalJs(`((fi, fo) => {
        const row = window.__fadeRow('Tavern_Music.mp3');
        const a = window.__fadeControl(row, 'fadeIn');
        const b = window.__fadeControl(row, 'fadeOut');
        window.__setRange(a.box, String(fi));
        window.__setRange(b.box, String(fo));
        return 'OK';
      })(${fi}, ${fo})`);
      await sleep(300);
    };
    await setPair(100, 100);
    const f3a = await evalJs(`(() => {
      const row = window.__fadeRow('Tavern_Music.mp3');
      return row ? !!row.querySelector('[data-fade-warning]') : null;
    })()`);
    await setPair(0, 100);
    const f3b = await evalJs(`(() => {
      const row = window.__fadeRow('Tavern_Music.mp3');
      return row ? !!row.querySelector('[data-fade-warning]') : null;
    })()`);
    // 100 + 100 >= 152 -> red; 0 + 100 < 152 -> not red.
    log('FADE','FADE3a: fadeIn+fadeOut past audibleEnd turns red', f3a === true ? 'PASS' : 'FAIL', String(f3a));
    log('FADE','FADE3b: fadeIn+fadeOut below audibleEnd is not red', f3b === false ? 'PASS' : 'FAIL', String(f3b));

    // ---- FADE4: Play Until is per-file and clamps at the file length ---
    const row4 = await evalJs(`(() => {
      const r = window.__fadeRow('Tavern_Music.mp3');
      const c = window.__fadeControl(r, 'playUntil');
      window.__setRange(c.box, 3);
      return { slider: c.slider ? c.slider.value : null, box: c.box ? c.box.value : null };
    })()`);
    log('FADE','FADE4: Play Until is per-file and reads back what was typed',
      row4 && row4.slider === '3' && row4.box === '3' ? 'PASS' : 'FAIL', JSON.stringify(row4));

    // Leave the modal set to values that play cleanly: playUntil 3 s, fade-out
    // the last 1 s, so the fade runs at 2 s and lands at 3 s.
    await setPair(0, 1);
    await evalJs(`(() => {
      const r = window.__fadeRow('Tavern_Music.mp3');
      const c = window.__fadeControl(r, 'playUntil');
      window.__setRange(c.box, 3);
      return 'OK';
    })()`);
    await sleep(300);
    await submitModal('Save Changes');
    await sleep(1000);
    await driver.exitEditMode();

    // ---- FADE5: fade-out measures back from the audible end ----------
    // Fixture: Tavern_Music (152 s), playUntil 3, fadeOut 1. The fade starts
    // at 2 s (audibleEnd - fadeOut) and ramps to 0 at 3 s - the ramp is the
    // scheduled fadeOutAudio ramp, not the file's natural end.
    const cardA = await driver.centeredCard('[data-sound-card][data-sound-id="fade_probe"]');
    if (cardA) await driver.trustedTap(cardA.x, cardA.y);
    await sleep(2600);
    const f5a = await evalJs(`(() => {
      const els = (window.__audios||[]).filter(x => x._soundId === 'fade_probe');
      const a = els[els.length-1];
      return a ? { vol:+a.volume.toFixed(4), fading:!!a.fadeOutInterval, ct:+a.currentTime.toFixed(2) } : null;
    })()`);
    await sleep(1200);
    const f5b = await evalJs(`(() => {
      const els = (window.__audios||[]).filter(x => x._soundId === 'fade_probe');
      const a = els[els.length-1];
      const card = document.querySelector('[data-sound-card][data-sound-id="fade_probe"]');
      return a ? { vol:+a.volume.toFixed(4), paused:a.paused, fading:!!a.fadeOutInterval,
               ring: card ? card.className.includes('ring') : null } : null;
    })()`);
    // At 2.6 s the ramp is under way (volume below 1, fading flag set). By
    // ~4 s the ramp completed and onComplete tore the element down.
    const fade5ok = f5a && f5a.vol < 1 && f5a.vol > 0 && f5a.fading === true
      && f5b && f5b.vol === 0 && f5b.paused === true && f5b.fading === false && f5b.ring === false;
    log('FADE','FADE5: fade-out ramps down from audibleEnd - fadeOut to zero at playUntil',
      fade5ok ? 'PASS' : 'FAIL', `at2.6s=${JSON.stringify(f5a)} at4s=${JSON.stringify(f5b)}`);

    // ---- FADE6: playUntil past the file clamps the fade to the start ---
    // Fixture: Longbow_4 (0.6 s), playUntil 5 (> file), fadeOut 2.
    // audibleEnd = 0.6, fadeStart = max(0, 0.6 - 2) = 0: the fade starts
    // immediately instead of never. This replaces Z15's "fade silently never
    // happens" with a clamp.
    const cardB = await driver.centeredCard('[data-sound-card][data-sound-id="clamp_probe"]');
    if (cardB) await driver.trustedTap(cardB.x, cardB.y);
    await sleep(350);
    const f6 = await evalJs(`(() => {
      const els = (window.__audios||[]).filter(x => x._soundId === 'clamp_probe');
      const a = els[els.length-1];
      return a ? { vol:+a.volume.toFixed(4), fading:!!a.fadeOutInterval, ct:+a.currentTime.toFixed(2) } : null;
    })()`);
    log('FADE','FADE6: fade-out past the file length clamps to the file start and runs',
      f6 && f6.fading === true && f6.vol < 1 ? 'PASS' : 'FAIL', JSON.stringify(f6));

    // ---- FADE7: values survive reload and re-hydrate in the modal ----
    await reload();
    await evalJs(helpers);
    await driver.enterEditMode();
    await evalJs(`(() => {
      const c = document.querySelector('[data-sound-card][data-sound-id="fade_probe"]');
      const b = c?.parentElement?.querySelector('button[title="Edit Sound"]');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(800);
    const f7 = await evalJs(`(() => {
      const r = window.__fadeRow('Tavern_Music.mp3');
      const c = window.__fadeControl(r, 'playUntil');
      const o = window.__fadeControl(r, 'fadeOut');
      return { playUntil: c.box ? c.box.value : null, fadeOut: o.box ? o.box.value : null,
               len: window.__measuredLength('Tavern_Music.mp3') };
    })()`);
    log('FADE','FADE7: per-file fades persist and re-hydrate in the modal',
      f7 && f7.playUntil === '3' && f7.fadeOut === '1' ? 'PASS' : 'FAIL', JSON.stringify(f7));

    // ---- FADE8: the loop seam hint appears and clears -------------------
    // A loop whose fade-in has no matching fade-out clicks on every repeat
    // (§7.4). It is a hint, not a graded state, so the file must stay usable -
    // but the sentence has to track the real values, or it would nag about a
    // seam the user already fixed.
    const setLoop = async (on) => {
      await evalJs(`((on) => {
        const el = document.querySelector('input[name="loop"]');
        if (!el) return 'NO_LOOP';
        if (el.checked !== on) el.click();
        return 'OK';
      })(${on})`);
      await sleep(250);
    };
    await setLoop(true);
    await setPair(2, 0);
    const f8a = await evalJs(`(() => {
      const el = document.querySelector('[data-fade-seam]');
      return el ? el.textContent.trim() : null;
    })()`);
    await setPair(2, 1);
    const f8b = await evalJs(`(() => !!document.querySelector('[data-fade-seam]'))()`);
    await setLoop(false);
    log('FADE','FADE8: loop + fade-in with no fade-out warns about the seam, and adding a fade-out clears it',
      f8a && f8a.length > 0 && f8b === false ? 'PASS' : 'FAIL', `hint=${JSON.stringify(f8a)} afterFadeOut=${f8b}`);
  }
};
