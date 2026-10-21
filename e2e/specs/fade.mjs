// Shared per-file fades spec (Suite FADE, FADE1-FADE10).
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

import { KNOWN_KEYS, awaitBoard } from '../lib/page.mjs';

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
      // The REAL shipped environment data, not a fixture: two categories keyed
      // by NAME (no id), seven sounds in the legacy single-"file" shape. The
      // user's board looks like this, and a save here has to edit the sound it
      // opened rather than append a copy.
      localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([
        { category:'Background Music', sounds:[
          { id:'env_1', name:'Forest Ambience', type:'Nature', icon:'Forest.png', file:'Forest_Ambience.mp3', color:'#499c12', duration:0, fadeIn:0, fadeOut:0, loop:true, isEnvironmental:true },
          { id:'env_2', name:'Tavern Music', type:'Music', icon:'Tavern.png', file:'Tavern_Music.mp3', color:'#499c12', duration:0, fadeIn:0, fadeOut:0, loop:true, isEnvironmental:true },
          { id:'env_3', name:'Dungeon Ambience', type:'Nature', icon:'Dungeon.png', file:'Dungeon_Ambience.mp3', color:'#499c12', duration:0, fadeIn:0, fadeOut:0, loop:true, isEnvironmental:true }
        ]},
        { category:'Environmental Effects', sounds:[
          { id:'env_4', name:'Rain', type:'Nature', icon:'Rain.png', file:'Rain.mp3', color:'#499c12', duration:0, fadeIn:0, fadeOut:0, loop:true, isEnvironmental:true }
        ]}
      ]));
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
    await awaitBoard(ctx, { min: 1, seed });
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
    await awaitBoard(ctx, { min: 1 });
    await evalJs(helpers);
    await driver.enterEditMode();
    await evalJs(`(() => {
      const c = document.querySelector('[data-sound-card][data-sound-id="fade_probe"]');
      const b = c?.parentElement?.querySelector('button[title="Edit Sound"]');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(800);
    // The sliders only exist once the file's LENGTH is known, and the emulator
    // takes longer than a fixed sleep to deliver it. Wait for the measurement
    // rather than for the clock - otherwise this asserts on a row that is
    // still saying "Measuring this file...".
    let f7len = null;
    for (let i = 0; i < 60 && !(f7len && f7len > 0); i++) {
      f7len = await evalJs('window.__measuredLength("Tavern_Music.mp3")');
      if (!f7len || f7len <= 0) await sleep(200);
    }
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
    // seam the user already fixed. The mirror case (a fade-out with no
    // fade-in) fades to silence and jumps back, so it warns too.
    const setLoop = async (on) => {
      await evalJs(`((on) => {
        const el = document.querySelector('input[name="loop"]');
        if (!el) return 'NO_LOOP';
        if (el.checked !== on) el.click();
        return 'OK';
      })(${on})`);
      await sleep(250);
    };
    const seamHint = async () => evalJs(`(() => {
      const el = document.querySelector('[data-fade-seam]');
      return el ? el.textContent.trim() : null;
    })()`);
    await setLoop(true);
    await setPair(2, 0);
    const f8a = await seamHint();
    await setPair(0, 2);
    const f8b = await seamHint();
    await setPair(2, 1);
    const f8c = await seamHint();
    await setLoop(false);
    log('FADE','FADE8: the loop seam hint appears for a fade-in without a fade-out, mirrors for a fade-out without a fade-in, and clears when both are set',
      f8a && /dips on every loop/.test(f8a) && f8b && /reaches silence/.test(f8b) && !f8c ? 'PASS' : 'FAIL',
      `fadeInOnly=${JSON.stringify(f8a)} fadeOutOnly=${JSON.stringify(f8b)} both=${JSON.stringify(f8c)}`);

    // ---- FADE9: the timeline draws the file, not just a scrubber ------
    // The bar is the design's centrepiece: the fade-in ramp, the full-volume
    // plateau, the fade-out ramp, the hatched part past Play Until and the
    // stop marker. A bar that only showed the played portion would look the
    // same whether or not the fades existed.
    const setUntil = async (v) => {
      await evalJs(`((v) => {
        const row = window.__fadeRow('Tavern_Music.mp3');
        const c = window.__fadeControl(row, 'playUntil');
        window.__setRange(c.box, v);
        return 'OK';
      })(${v})`);
      await sleep(300);
    };
    const readBar = async () => evalJs(`(() => {
      const row = window.__fadeRow('Tavern_Music.mp3');
      const bar = row?.querySelector('.fade-tl');
      if (!bar) return null;
      const vis = (sel) => { const el = bar.querySelector(sel); return el ? getComputedStyle(el).display !== 'none' : null; };
      return { fi: vis('.fade-seg-fi'), mid: vis('.fade-seg-mid'), tail: vis('.fade-seg-tail'),
               over: vis('.fade-seg-over'), stop: !!bar.querySelector('.fade-stop'),
               caption: (row.querySelector('[data-fade-caption]')?.textContent || '').trim() };
    })()`);
    await setPair(2, 0);
    await setUntil(0);
    const f9a = await readBar();
    await setUntil(10);
    const f9b = await readBar();
    await setPair(100, 100);
    const f9c = await readBar();
    log('FADE','FADE9: the timeline draws the fade-in ramp, the full-volume plateau, the never-played tail and the stop marker',
      f9a && f9a.fi === true && f9a.mid === true && f9a.tail === false && f9a.stop === true && f9a.over === false
        && /never - whole file plays/.test(f9a.caption)
        && f9b && f9b.tail === true && /stop at/.test(f9b.caption)
        && f9c && f9c.over === true ? 'PASS' : 'FAIL',
      `wholeFile=${JSON.stringify(f9a)} until10=${JSON.stringify(f9b)} overlapped=${JSON.stringify(f9c)}`);

    // ---- FADE10: a value off the slider's step grid still saves ---------
    // A trap that cost a whole E2E run: a number input carrying `step` (or
    // `max`) turns any value the slider cannot represent into an HTML5
    // step mismatch, and the browser then SILENTLY refuses to submit the form.
    // The sound's name never changed, the modal never closed, and every suite
    // after it ran against stacked modals. The slider here steps by whole
    // seconds over a 152 s file, so 0.5 s is not on its grid - and it still
    // has to save, because the number box is the authority.
    await setPair(0.5, 0);
    await setUntil(0);
    const f10a = await submitModal('Save Changes');
    await sleep(1000);
    await reload();
    await awaitBoard(ctx, { min: 1 });
    await evalJs(helpers);
    await driver.enterEditMode();
    await evalJs(`(() => {
      const c = document.querySelector('[data-sound-card][data-sound-id="fade_probe"]');
      const b = c?.parentElement?.querySelector('button[title="Edit Sound"]');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(900);
    // Same wait as FADE7: the number box only exists once the length is known.
    let f10len = null;
    for (let i = 0; i < 60 && !(f10len && f10len > 0); i++) {
      f10len = await evalJs('window.__measuredLength("Tavern_Music.mp3")');
      if (!f10len || f10len <= 0) await sleep(200);
    }
    const f10b = await evalJs(`(() => {
      const r = window.__fadeRow('Tavern_Music.mp3');
      const c = window.__fadeControl(r, 'fadeIn');
      return c.box ? c.box.value : null;
    })()`);
    // The saved sound is the other half of the provenance rule: a CHARACTER
    // sound with a BUNDLED file must still be a bundled asset after an edit.
    // The normaliser used to copy the file's name into `storedName`, which
    // means "upload" - and the profile bundle export then tried to carry the
    // bundled file as an upload, could not find it, and refused to export.
    const f10c = await evalJs(`(() => {
      const chars = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
      let found = null;
      for (const c of chars) for (const s of (c.sounds||[])) if (s.id === 'fade_probe') found = s;
      const f = (found?.files||[])[0] || null;
      return f ? { name: f.name, storedName: f.storedName || '', fadeIn: f.fadeIn } : null;
    })()`);
    log('FADE','FADE10: a fade value the slider cannot represent still saves and comes back',
      f10a === 'OK' && f10b === '0.5' ? 'PASS' : 'FAIL', `submit=${f10a} fadeIn=${f10b}`);
    log('FADE','FADE10b: an edited sound with a bundled file stays a BUNDLED asset, so the profile can still be exported',
      f10c && f10c.storedName === '' && f10c.name === 'Tavern_Music.mp3' ? 'PASS' : 'FAIL', JSON.stringify(f10c));

    // ---- FADE11: an ENVIRONMENT sound gets the same per-file row ---------
    // The user's hand-test found that only CHARACTER sounds had fade and Play
    // Until controls. The cause was not the fades: every shipped environment
    // sound is stored in the LEGACY shape (a single `file` field, not a
    // `files[]` array), and the modal's rows come from `files[]` - so an
    // environment sound opened with no file rows at all, and no file rows
    // means no per-file controls.
    //
    // This also pins the PROVENANCE rule: a legacy sound is a BUNDLED asset, so
    // editing it must not give its file a `storedName` (which means "upload"),
    // or the profile bundle export would try to carry a bundled file as an
    // upload and refuse to export.
    await driver.enterEditMode();
    await evalJs(`(() => {
      const b = document.querySelector('button[data-tab="environment"]');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(700);
    // Open the FIRST environment sound of the first category - the one the
    // user would have clicked. Its file is Forest_Ambience.mp3.
    await evalJs(`(() => {
      const c = document.querySelector('[data-sound-card][data-sound-id="env_1"]');
      const b = c?.parentElement?.querySelector('button[title="Edit Sound"]');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(900);
    let f11len = null;
    for (let i = 0; i < 40 && !(f11len && f11len > 0); i++) {
      f11len = await evalJs('window.__measuredLength("Forest_Ambience.mp3")');
      if (!f11len || f11len <= 0) await sleep(100);
    }
    const f11row = await evalJs(`(() => {
      const r = window.__fadeRow('Forest_Ambience.mp3');
      if (!r) return null;
      const c = window.__fadeControl(r, 'fadeIn');
      return { hasRow: true, box: c.box ? c.box.value : null };
    })()`);
    // Set a fade and a Play Until, then save.
    await evalJs(`(() => {
      const r = window.__fadeRow('Forest_Ambience.mp3');
      window.__setRange(window.__fadeControl(r, 'fadeIn').box, 2);
      window.__setRange(window.__fadeControl(r, 'playUntil').box, 30);
      return 'OK';
    })()`);
    await sleep(400);
    const f11save = await submitModal('Save Changes');
    await sleep(1200);
    const f11store = await evalJs(`(() => {
      const cats = JSON.parse(localStorage.getItem(window.__pk('ttrpg_environment'))||'[]');
      let found = null;
      let count = 0;
      let ids = [];
      for (const cat of cats) for (const s of (cat.sounds||[])) { count++; ids.push(cat.category+'/'+s.id+':'+s.name); if (s.id === 'env_1') found = s; }
      if (!found) return { count, ids };
      const f = (found.files||[])[0] || null;
      return { count, ids, file: found.file || null, hasFiles: (found.files||[]).length,
               fadeIn: f ? f.fadeIn : null, playUntil: f ? f.playUntil : null,
               storedName: f ? (f.storedName || '') : null, name: f ? f.name : null };
    })()`);
    log('FADE','FADE11: an environment sound (the legacy single-file shape) gets a file row, its fades save, and it stays a bundled asset',
      f11row && f11row.hasRow === true && f11len > 0 && f11save === 'OK'
        && f11store && f11store.hasFiles === 1 && f11store.fadeIn === 2 && f11store.playUntil === 30
        && f11store.storedName === '' && f11store.name === 'Forest_Ambience.mp3' ? 'PASS' : 'FAIL',
      `row=${JSON.stringify(f11row)} len=${f11len} submit=${f11save} store=${JSON.stringify(f11store)}`);
    // Saving must EDIT the sound, not append a second one. The environment tab
    // keys its categories by NAME while the other tabs key by id, and the two
    // halves of that used to disagree - which is how a save could add a copy
    // instead of editing the one that was open.
    log('FADE','FADE12: saving an environment sound edits it - it does not append a second copy',
      f11store && f11store.count === 4 ? 'PASS' : 'FAIL', `sounds=${f11store?.count} ids=${JSON.stringify(f11store?.ids)}`);

    // ---- FADE13: the modal shows ONE row for the file, and re-opening it
    // does not accumulate copies -------------------------------------------
    // The bug the user hit: the legacy `file` field AND the files[] entry
    // described the SAME file, so the modal built a second row for it - one
    // edited, one vanilla - and every save appended another. The row is the
    // sound as far as a player is concerned, so a second row for the same
    // file is a second sound.
    await evalJs(`(() => {
      const c = document.querySelector('[data-sound-card][data-sound-id="env_1"]');
      const b = c?.parentElement?.querySelector('button[title="Edit Sound"]');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(900);
    let f13len = null;
    for (let i = 0; i < 60 && !(f13len && f13len > 0); i++) {
      f13len = await evalJs('window.__measuredLength("Forest_Ambience.mp3")');
      if (!f13len || f13len <= 0) await sleep(200);
    }
    const f13a = await evalJs(`(() => {
      const rows = [...document.querySelectorAll('[data-fade-row]')].filter(r => r.textContent.includes('Forest_Ambience.mp3'));
      const c = window.__fadeControl(rows[0], 'fadeIn');
      return { rows: rows.length, fadeIn: c.box ? c.box.value : null };
    })()`);
    await submitModal('Save Changes');
    await sleep(1000);
    const f13b = await evalJs(`(() => {
      const cats = JSON.parse(localStorage.getItem(window.__pk('ttrpg_environment'))||'[]');
      let found = null;
      for (const cat of cats) for (const s of (cat.sounds||[])) if (s.id === 'env_1') found = s;
      return { files: (found?.files||[]).length, legacyFile: found?.file ?? null };
    })()`);
    log('FADE','FADE13: the sound keeps ONE row for its file, and saving retires the legacy file field instead of duplicating it',
      f13a && f13a.rows === 1 && f13a.fadeIn === '2' && f13b && f13b.files === 1 && f13b.legacyFile === null ? 'PASS' : 'FAIL',
      `rows=${JSON.stringify(f13a)} store=${JSON.stringify(f13b)}`);
  }
};
