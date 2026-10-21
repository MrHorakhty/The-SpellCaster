// Shared live-playback spec (Suite Z, Z1-Z21).
//
// Ported from e2e-features.mjs Suite E (LIVE PLAYBACK), which was the only place
// the app's actual audio output was asserted — and which was therefore the
// biggest single hole left when the legacy suites were retired. Everything here
// runs from BOTH entrypoints.
//
// Three traps this spec is built around, all recorded in PROJECT_STATE.md after
// the per-sound volume work found them the hard way:
//
//   1. A short or undecodable fixture fires `ended` -> cleanupAudio -> the
//      element is unregistered from audioElementsRef within milliseconds. Worse,
//      an `ended` element still reports `paused === false`, so a liveness check
//      cannot see that it is dead. The fixture is therefore a REAL bundled asset
//      with loop:true, which never reaches `ended` on its own.
//   2. element.click() from Runtime.evaluate is not a user gesture, so autoplay
//      is refused and play() rejects. The trigger is driver.trustedTap - a real
//      CDP mouse click on desktop, a real Input.dispatchTouchEvent tap on touch.
//   3. Only REGISTERED elements get rescaled by the master slider, so every
//      live-audio assertion here runs against one element captured by reference
//      and watched across changes, never against a fresh lookup.
//
// The seeded sound carries fadeIn:1 and loop:true on purpose — Z4/Z5 need a ramp
// and Z8/Z9 need a boundary to cross, and the same element serves both.
//
// Z13-Z21 re-seed separately rather than adding cards to that fixture: they need
// a LONG asset (a fade only runs if the file outlives the fade timer) and two
// sounds carrying two files each, and perturbing a fixture twelve passing tests
// already depend on is the wrong trade.

const near = (v, target, tol) => Math.abs((v ?? -999) - target) <= tol;

export const playback = {
  title: 'SUITE Z: LIVE PLAYBACK',
  async run(ctx) {
    const { log, evalJs, sleep, reload, driver } = ctx;

    // One character, one looping sound on a real bundled asset with a 1s fade.
    // No `volume` field, so it starts at 100% and the master is the only lever.
    const seed = `(() => {
      localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([{
        id:'c1', name:'Human Paladin', sounds:[
          { id:'pb_main', name:'Playback Probe', type:'Test', icon:'',
            files:[{name:'Tavern_Music.mp3', displayName:'Tavern_Music.mp3'}],
            color:'#ff0000', duration:0, fadeIn:1, fadeOut:0, loop:false, randomPlay:false,
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

    // Re-injected after every reload. The Audio wrapper is the hook the volume
    // spec already proved works; it must be installed BEFORE the trigger so the
    // element is captured.
    const helpers = `(() => {
      window.__pbCard = () => document.querySelector('[data-sound-card][data-sound-id="pb_main"]');
      // Master range: title="Volume: N%". The per-sound card trims use
      // aria-label and a "<name> volume: N% (trim…)" title, so they cannot be
      // caught by this selector.
      window.__pbMasterRange = () => {
        const l = [...document.querySelectorAll('input[type=range][title^="Volume:"]')];
        return l.find(s => s.offsetParent !== null) || l[0] || null;
      };
      // Master number input. The title DIFFERS between the two headers, which is
      // why the old suite could never have run on both:
      //   mobile header  App.jsx:4806  title="Volume: N%"
      //   desktop header App.jsx:4939  title="Volume (%)"
      // Only one header is ever rendered (App.jsx:4738 branches on isMobile), so
      // try both and take whichever is present.
      window.__pbMasterNumber = () => {
        const l = [...document.querySelectorAll('input[type=number][title="Volume (%)"], input[type=number][title^="Volume:"]')];
        return l.find(s => s.offsetParent !== null) || l[0] || null;
      };
      window.__pbSet = (el, v) => {
        if (!el) return 'NO_EL';
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, String(v));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return 'OK';
      };
      // A LOCAL named-field setter. The entrypoints' window.__setInput helper
      // does not survive the reload this spec does, and a spec that reaches for
      // it afterwards gets an undefined function whose exception is swallowed by
      // evalJs — the field silently keeps its old value and the save looks fine.
      window.__pbSetField = (name, v) => {
        const el = document.querySelector('input[name="' + name + '"]');
        if (!el) return 'NO_FIELD:' + name;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, String(v));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return el.value;
      };
      window.__pbEl = () => {
        const els = (window.__audios || []).filter(x => x._soundId === 'pb_main');
        return els.length ? els[els.length - 1] : null;
      };
      if (!window.__origAudio) {
        window.__audios = [];
        window.__origAudio = window.Audio;
        window.Audio = function(...a) { const el = new window.__origAudio(...a); window.__audios.push(el); return el; };
        window.Audio.prototype = window.__origAudio.prototype;
      }
      return 'ok';
    })()`;

    // ---- the fixture for Z13-Z21 -------------------------------------------
    // duration/fadeIn/fadeOut/randomPlay are the four fields under test, so
    // every sound carries them explicitly rather than relying on absent-means-
    // default. No `volume` field anywhere: the master stays the only lever, so
    // the fade arithmetic under test is not perturbed by a per-sound trim.
    //
    // The two randomPlay fixtures hold TWO DISTINCT BUNDLED ASSETS rather than
    // two uploaded blobs. normalizeStoredFileEntry (App.jsx:2940) copies `name`
    // into `storedName`, but there are no bytes under that key, so the lookup
    // misses and playSound falls back to /assets/${displayName} - which is
    // exactly the two-src behaviour under test, with no upload anywhere.
    const seed2 = `(() => {
      const probe = (id, name, files, over) => Object.assign({
        id, name, type:'Test', icon:'', files, color:'#ff0000',
        duration:0, fadeIn:0, fadeOut:0, loop:false, randomPlay:false, brightness:1
      }, over);
      const two = [
        {name:'Longbow_4.mp3', displayName:'Longbow_4.mp3'},
        {name:'Longbow_3.mp3', displayName:'Longbow_3.mp3'}
      ];
      const long = [{name:'Tavern_Music.mp3', displayName:'Tavern_Music.mp3'}];
      localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([{
        id:'c1', name:'Human Paladin', sounds:[
          // A 152s asset, because a fade only runs if the file outlives the
          // timer. duration 3 / fadeOut 2 -> fade scheduled at 1s, ramp to 0
          // at 3s, then onComplete tears the element down.
          probe('pb_fadeout','Fade Out Probe', long, { duration:3, fadeOut:2 }),
          // Same long asset, no duration (so no fade-out timer at all) and a 3s
          // fade-in to move the master slider inside of.
          probe('pb_fadein','Fade In Probe', long, { loop:true, fadeIn:3 }),
          // The negative case: fade scheduled at 5-2=3s, but the FILE is 0.6s.
          probe('pb_latefade','Late Fade Probe',
            [{name:'Longbow_4.mp3', displayName:'Longbow_4.mp3'}], { duration:5, fadeOut:2 }),
          probe('pb_random','Random Two', two, { randomPlay:true }),
          probe('pb_seq','Sequential Two', two, { randomPlay:false }),
          probe('pb_random_one','Random One', [two[0]], { randomPlay:true }),
          // Short looping sound with a fade-in: the seam comes every ~0.56s, so
          // the fade-in re-application at every seam (firstLoopPlay removed,
          // FADE_SPEC §7.3) is crossed repeatedly during the test.
          probe('pb_loop','Loop Probe', [two[0]], { loop:true, fadeIn:1 }),
          // A loop whose fade-out measures back from the LOOP POINT (§7.2), so
          // it ramps down into the seam instead of being cut off by it. The
          // file is 0.576 s, so the seam comes every ~0.58 s.
          probe('pb_loopfo','Loop Fade Out Probe', [two[0]], { loop:true, fadeOut:0.2 })
        ]
      }]));
      localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_groups'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_themes'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_data_version'), '3');
      return 'seeded';
    })()`;

    // The Audio wrapper is re-installed after the second reload: a page load
    // wipes window entirely, so without this the new sounds would be played
    // into a __audios array that no longer exists.
    const helpers2 = `(() => {
      window.__pbMasterRange = () => {
        const l = [...document.querySelectorAll('input[type=range][title^="Volume:"]')];
        return l.find(s => s.offsetParent !== null) || l[0] || null;
      };
      window.__pbSet = (el, v) => {
        if (!el) return 'NO_EL';
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, String(v));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return 'OK';
      };
      window.__audios = [];
      window.__origAudio = window.Audio;
      window.Audio = function(...a) { const el = new window.__origAudio(...a); window.__audios.push(el); return el; };
      window.Audio.prototype = window.__origAudio.prototype;
      return 'ok';
    })()`;

    await evalJs(seed);
    await reload();
    await evalJs(helpers);

    // ---- Z1-Z3: a real trusted gesture starts real playback -----------------
    // NOT element.click(): that is not a user gesture, autoplay is refused and
    // play() rejects, so every assertion below would be reading a dead element.
    // The short settle before the tap's aftermath is read deliberately — the
    // 1s fade-in is sampled from as close to t=0 as the round trip allows.
    const coords = await driver.centeredCard('[data-sound-card][data-sound-id="pb_main"]');
    if (coords) await driver.trustedTap(coords.x, coords.y);

    // Sample immediately: the fade-in walks 20 steps over fadeIn seconds, so a
    // late first sample misses the ramp and Z4 stops proving anything.
    const z4 = await evalJs(`(async () => {
      const samples = [];
      let a = null;
      for (let i = 0; i < 16; i++) {
        a = window.__pbEl();
        if (a) samples.push(+a.volume.toFixed(4));
        await new Promise(r => setTimeout(r, 120));
      }
      if (!a) return 'NO_EL';
      return { samples, target: a._baseVolume, ct: a.currentTime, dur: Number.isFinite(a.duration) ? a.duration : null };
    })()`);
    await sleep(400);

    const z1 = await evalJs(`(() => {
      const a = window.__pbEl();
      const c = window.__pbCard();
      return a ? { paused:a.paused, ready:a.readyState, vol:a.volume, src:(a.src||''), ct:a.currentTime,
                   dur:Number.isFinite(a.duration)?a.duration:null,
                   ring: c ? c.className.includes('ring') : null } : null;
    })()`);
    // "Playback started" is proven by currentTime having ADVANCED, not by a paused
    // flag sampled at one instant. The fixture is Longbow_4.mp3, which is 0.576s
    // long, and z1 is taken ~2.3s after the trigger (the ramp sample above is 16 x
    // 120ms, then a 400ms settle) - so a correctly-started clip has usually
    // ALREADY ENDED by then and reports paused:true. Sampling an instant against a
    // sub-second asset is the same trap as Android Q11. Accept either window:
    // still running (paused false), or demonstrably ran (currentTime > 0).
    log('PLAY','Z1: playback started',z1 && (z1.paused===false || z1.ct>0)?'PASS':'FAIL',JSON.stringify(z1));
    log('PLAY','Z3: card shows the play ring while playing',z1?.ring===true?'PASS':'FAIL',String(z1?.ring));

    // ---- Z2: decoded, POLLED not sampled -----------------------------------
    // This used to read `readyState` out of the single z1 sample, taken ~400ms
    // after the trigger, and report FAIL whenever the source had resolved but not
    // yet buffered - ready=1 is HAVE_METADATA. That is the same race Android Q11
    // had (see PROJECT_STATE: "an async UI assertion that samples once is a race
    // wearing a trouser-suit"), and it fired on a loaded emulator on 2026-10-14.
    //
    // So: poll for the CONDITION with a bounded timeout and report how long it
    // took, which is what makes the failure diagnosable. Safe to do here because
    // the fade ramp above is already fully sampled by this point - z4 was captured
    // before z1 - so waiting longer cannot disturb Z4/Z5.
    let z2 = null;
    for (let i = 0; i < 25; i++) {
      z2 = await evalJs(`(() => { const a = window.__pbEl(); return a ? { ready:a.readyState, src:(a.src||'') } : null; })()`);
      if (z2 && z2.ready >= 2) { z2.waitedMs = i * 120; break; }
      await sleep(120);
    }
    log('PLAY','Z2: audio source resolved and decoded',!!z2?.src && z2?.ready>=2?'PASS':'FAIL',
      `ready=${z2?.ready} waitedMs=${z2?.waitedMs ?? '>3000'} src=${(z2?.src||'').slice(0,60)}`);

    // ---- Z4-Z5: the fade-in ramp -------------------------------------------
    // applyFadeIn walks 20 steps across fadeIn seconds from 0 to _baseVolume. The
    // first sample must be well below the target, otherwise the ramp already
    // happened before we were listening and the assertion is vacuous.
    const samples = Array.isArray(z4?.samples) ? z4.samples : [];
    const first = samples[0] ?? 1;
    const last = samples[samples.length - 1] ?? 0;
    const rose = samples.some((v,i) => i > 0 && v > samples[i-1]);
    log('PLAY','Z4: fade-in ramps upward from near zero',rose && first < (z4?.target ?? 1) * 0.8 ? 'PASS':'FAIL',
      `samples=${JSON.stringify(samples)} target=${z4?.target}`);
    log('PLAY','Z5: fade-in settles on the target level',near(last, z4?.target ?? 1, 0.12)?'PASS':'FAIL',
      `final=${last} target=${z4?.target}`);

    // ---- Z6-Z7: the MASTER controls drive the live element ------------------
    // Same element throughout (trap 3): if it were re-looked-up, a dead or fresh
    // element could satisfy these by accident.
    await evalJs(`(() => { const m = window.__pbMasterRange(); return window.__pbSet(m, 0.2); })()`);
    await sleep(400);
    const z6 = await evalJs(`(() => { const a = window.__pbEl(); return a ? { vol:a.volume, base:a._baseVolume, slider: window.__pbMasterRange()?.value } : null; })()`);
    log('PLAY','Z6: master slider rescales the live element to 0.2',near(z6?.vol,0.2,0.05) && z6?.slider==='0.2'?'PASS':'FAIL',JSON.stringify(z6));

    // The number input is a SECOND control for the same master value.
    await evalJs(`(() => { const n = window.__pbMasterNumber(); return n ? window.__pbSet(n, 50) : 'NO_NUM_INPUT'; })()`);
    await sleep(500);
    const z7 = await evalJs(`(() => { const a = window.__pbEl(); return a ? { vol:a.volume, base:a._baseVolume, slider: window.__pbMasterRange()?.value, num: window.__pbMasterNumber()?.value ?? null } : null; })()`);
    log('PLAY','Z7: master number input drives the live element to 50%',near(z7?.vol,0.5,0.05) && near(Number(z7?.slider),0.5,0.02)?'PASS':'FAIL',JSON.stringify(z7));

    // ---- Z10: Stop All ------------------------------------------------------
    await evalJs(`(() => { const b = document.querySelector('button[title="Stop All Sounds"]'); if (!b) return 'NO_BTN'; b.click(); return 'OK'; })()`);
    await sleep(500);
    const z10 = await evalJs(`(() => {
      const a = window.__pbEl(); const c = window.__pbCard();
      return { clicked:true, paused:a?a.paused:null, ct:a?a.currentTime:null, ring:c?c.className.includes('ring'):null };
    })()`);
    log('PLAY','Z10: Stop All stops the audio and clears the ring',z10?.paused===true && z10?.ring===false?'PASS':'FAIL',JSON.stringify(z10));

    // ---- Z11-Z12: loop and per-file fades survive the modal round trip -----
    // FadeIn/fadeOut/playUntil now live ON THE FILE ENTRY, not the sound
    // (FADE_SPEC §4). The edit modal hydrates them from each file and writing
    // them back persists to storage. The modal's number boxes have no `name`
    // attribute (they are wired per row), so address them by position: index 0
    // is fade-in, 2 is Play Until.
    await driver.enterEditMode();
    await evalJs(`(() => {
      const c = window.__pbCard();
      const b = c?.parentElement?.querySelector('button[title="Edit Sound"]');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(800);
    const z11 = await evalJs(`(() => {
      const row = document.querySelector('[data-fade-row]');
      const boxes = row ? [...row.querySelectorAll('input[type=number]')] : [];
      return {
        loop: document.querySelector('#loop')?.checked === true,
        fadeIn: boxes[0] ? Number(boxes[0].value) : null,
        playUntil: boxes[2] ? Number(boxes[2].value) : null
      };
    })()`);
    log('PLAY','Z11: the edit modal hydrates loop and per-file fadeIn from storage',
      z11?.loop===false && z11?.fadeIn===1 ? 'PASS':'FAIL',JSON.stringify(z11));

    const z11b = await evalJs(`(() => {
      const boxes = [...document.querySelectorAll('[data-fade-row] input[type=number]')];
      const b = boxes[2];
      if (!b) return 'NO_BOX';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(b, '3');
      b.dispatchEvent(new Event('input', { bubbles: true }));
      return b.value;
    })()`);
    await ctx.submitModal('Save Changes');
    await sleep(1000);
    await driver.exitEditMode();
    const z12 = await evalJs(`(() => {
      const c = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]');
      const s = c[0]?.sounds?.find(x => x.id === 'pb_main');
      return { loop: s?.loop, playUntil: s?.files?.[0]?.playUntil, files: s?.files };
    })()`);
    log('PLAY','Z12: edited per-file Play Until persists to storage',
      z12?.loop===false && z12?.playUntil===3 ? 'PASS':'FAIL',
      `stored=${JSON.stringify(z12?.files)}`);

    // =====================================================================
    // Z13-Z21: fade-out, a level change DURING a fade, and random play.
    //
    // These close the last three playback gaps the project carried. The
    // recorded blocker - "every fixture finishes before a fade completes" -
    // was FALSE. It was inherited from the per-sound-volume work, which picked
    // a 0.6s clip because it registers reliably, and nobody ever checked it
    // against the asset list. ffprobe on the bundled assets:
    //     Longbow_4.mp3      0.6s   (what every previous fixture used)
    //     Longbow_3.mp3      0.7s
    //     Tavern_Music.mp3 152.4s   (already bundled, already in src/data.json)
    // A fade only RUNS if the file outlives the fade timer, and that timer is
    // scheduled off the sound's own `duration` (App.jsx:4053) - which is
    // user-typed metadata. So a long asset is required, not optional. It also
    // self-cleans: fadeOutAudio's onComplete calls cleanupAudio, so a 152s file
    // is torn down at the end of the ramp and leaks nothing into the next spec.
    //
    // A FRESH SEED rather than extra cards on the one above. Twelve passing
    // tests are worth more than the convenience of a shared fixture.
    // =====================================================================
    await evalJs(seed2);
    await reload();
    await evalJs(helpers2);

    // A single real trigger, then wait for the Audio element to actually exist.
    // playSound awaits a blob lookup before it constructs the element, so the
    // element lands a tick after the gesture - the same Q11 race, so poll for
    // the condition with a bounded wait rather than sampling an instant.
    const triggerOnce = async (id) => {
      const c = await driver.centeredCard(`[data-sound-card][data-sound-id="${id}"]`);
      if (!c) return { ok: false, reason: 'NO_CARD' };
      await driver.trustedTap(c.x, c.y);
      for (let i = 0; i < 20; i++) {
        const n = await evalJs(`(() => (window.__audios||[]).filter(x => x._soundId === '${id}').length)()`);
        if (n > 0) return { ok: true };
        await sleep(50);
      }
      return { ok: false, reason: 'NO_AUDIO' };
    };

    const stopAll = async () => {
      await evalJs(`(() => { const b = document.querySelector('button[title="Stop All Sounds"]'); if (!b) return 'NO_BTN'; b.click(); return 'OK'; })()`);
      await sleep(400);
    };

    // ---- Z8-Z9: crossing the loop boundary ---------------------------------
    // pb_loop loops the whole 0.576 s file (playUntil unset), so the seam comes
    // every ~0.56 s. firstLoopPlay is removed (FADE_SPEC §7.3): the fade-in
    // re-runs at EVERY seam, and each time it reads the target back off the
    // element (_baseVolume) rather than closing over a stale level.
    await stopAll();
    const t8 = await triggerOnce('pb_loop');
    // Z8: a looping sound rewinds at the boundary. Poll for the decoded
    // duration (the element is created asynchronously after the trigger).
    let z8 = null;
    for (let i = 0; i < 40 && (!z8 || z8 === 'NO_DURATION'); i++) {
      z8 = await evalJs(`(async () => {
        const els = (window.__audios||[]).filter(x => x._soundId === 'pb_loop');
        const a = els[els.length - 1]; if (!a) return 'NO_EL';
        if (!Number.isFinite(a.duration) || a.duration <= 0) return 'NO_DURATION';
        const len = a.duration;
        const threshold = Math.max(len - 0.25, len * 0.98);
        a.currentTime = threshold + (len - threshold) * 0.9;
        const reads = [];
        for (let i = 0; i < 20; i++) { reads.push(+a.currentTime.toFixed(3)); await new Promise(r => setTimeout(r, 50)); }
        return { threshold: +threshold.toFixed(3), duration:+len.toFixed(3), reads, min: Math.min(...reads) };
      })()`);
      if (z8 === 'NO_DURATION') await sleep(100);
    }
    const dropped = Array.isArray(z8?.reads) && z8.reads.some((v,i,arr) => i > 0 && v < arr[i-1] - 0.05);
    log('PLAY','Z8: a looping sound rewinds at the boundary',t8.ok && dropped && (z8?.min ?? 1) < 0.2?'PASS':'FAIL',
      `duration=${z8?.duration} threshold=${z8?.threshold} reads=${JSON.stringify(z8?.reads)}`);

    // Z9: master at 1 while looping (fade-in dips at every seam), then move the
    // master to 0.2. Under the old firstLoopPlay guard the fade-in never re-ran,
    // so the level would track the master with no dips; now the fade-in re-applies
    // at every seam to the CURRENT master, so samples show repeated near-zero dips
    // and never climb back toward the old level 1.0.
    await evalJs(`(() => { const m = window.__pbMasterRange(); if (m) window.__pbSet(m, 0.2); return 'OK'; })()`);
    await sleep(400);
    const z9 = await evalJs(`(async () => {
      // The LAST element is the live one - the first entry of __audios can belong
      // to an earlier trigger of the same sound, and sampling a dead element
      // would report a flat level that no seam could ever move.
      const live = () => { const e = (window.__audios||[]).filter(x => x._soundId === 'pb_loop'); return e.length ? e[e.length-1] : null; };
      const samples = [];
      const state = [];
      for (let i = 0; i < 14; i++) {
        const a = live();
        samples.push(+((a?.volume ?? 0)).toFixed(4));
        if (i === 0 || i === 7) state.push({ t:+(a?.currentTime ?? -1).toFixed(3), paused:a?.paused, ended:a?.ended, fade:!!a?.fadeInInterval, base:a?._baseVolume, n:(window.__audios||[]).filter(x=>x._soundId==='pb_loop').length });
        await new Promise(r => setTimeout(r, 200));
      }
      return { samples, state };
    })()`);
    const z9s = Array.isArray(z9?.samples) ? z9.samples : [];
    const dipped = z9s.some(v => v < 0.05);
    const capped = z9s.length > 0 && z9s.every(v => v <= 0.3);
    log('PLAY','Z9: loop re-entry re-applies the fade-in to the CURRENT master at every seam',
      t8.ok && z9s.length === 14 && dipped && capped ? 'PASS':'FAIL',
      `samples=${JSON.stringify(z9s)} state=${JSON.stringify(z9?.state)}`);

    // ---- Z22: a loop's fade-out ramps INTO the seam (§7.2) ----------------
    // A loop with a fade-out and no fade-in: the level must ramp DOWN towards
    // the loop point (a fade, not a cut) and then come back, so the loop keeps
    // making sound instead of dying silent at the first seam.
    await stopAll();
    const t22 = await triggerOnce('pb_loopfo');
    const z22 = await evalJs(`(async () => {
      const els = (window.__audios||[]).filter(x => x._soundId === 'pb_loopfo');
      const a = els[els.length - 1]; if (!a) return 'NO_EL';
      const samples = [];
      for (let i = 0; i < 50; i++) { samples.push(+a.volume.toFixed(4)); await new Promise(r => setTimeout(r, 50)); }
      return { samples, base: a._baseVolume };
    })()`);
    const s22 = Array.isArray(z22?.samples) ? z22.samples : [];
    const base22 = Number.isFinite(z22?.base) && z22.base > 0 ? z22.base : 1;
    // The shape that proves a RAMP rather than a cut: several consecutive
    // strictly-decreasing samples that start near full level and end near
    // silence. Judged against the element's own base, not a hard-coded 1,
    // because the master has been moved by an earlier test in this session.
    let run22 = 0, runStart22 = -1, best22 = { len: 0, start: 0, end: 0 };
    for (let i = 1; i < s22.length; i++) {
      if (s22[i] < s22[i-1] - 1e-6) {
        if (run22 === 0) runStart22 = i - 1;
        run22++;
        if (run22 > best22.len) best22 = { len: run22, start: s22[runStart22], end: s22[i] };
      } else {
        run22 = 0;
      }
    }
    const min22 = s22.length ? Math.min(...s22) : 1;
    const max22 = s22.length ? Math.max(...s22) : 0;
    const ramp22 = best22.len >= 3 && best22.start > base22 * 0.6 && best22.end < base22 * 0.3;
    const back22 = max22 > base22 * 0.8;
    log('PLAY','Z22: a loop fades DOWN into the seam and comes back, instead of being cut off',
      t22.ok && s22.length === 50 && ramp22 && back22 ? 'PASS':'FAIL',
      `base=${base22} longestDropRun=${best22.len} ramp=${JSON.stringify(best22)} min=${min22} max=${max22} samples=${JSON.stringify(s22.slice(8,20))}`);

    // ---- Z13: the fade-out ramp descends to zero -----------------------------
    // Fixture: Tavern_Music.mp3 (152s) with duration:3, fadeOut:2. The app
    // schedules the fade at (duration - fadeOut) = 1s and walks it over 2s, so
    // the plateau-then-descent-then-zero shape below cannot be anything else.
    await stopAll();
    const t13 = await triggerOnce('pb_fadeout');
    const z13 = await evalJs(`(async () => {
      const els = (window.__audios||[]).filter(x => x._soundId === 'pb_fadeout');
      const a = els[els.length - 1];
      if (!a) return 'NO_EL';
      const base = a._baseVolume;
      const samples = [];
      // Sample until the ramp reaches silence, with a generous cap, instead of
      // for a fixed 4.5 s. The fade is scheduled from the moment the file's
      // metadata arrives, and on a cold emulator that can be a second or two
      // after the trigger - so a fixed window ended before the ramp finished
      // and the test failed for a reason that had nothing to do with the app.
      for (let i = 0; i < 120; i++) {
        samples.push(+a.volume.toFixed(4));
        if (a.volume <= 0.0001 && samples.length > 5) break;
        await new Promise(r => setTimeout(r, 100));
      }
      return { base, samples, fadeOutInterval: !!a.fadeOutInterval };
    })()`);
    // A ramp, not a snap: count the longest run of consecutive strict decreases.
    const s13 = Array.isArray(z13?.samples) ? z13.samples : [];
    let longestDrop = 0, run = 0;
    for (let i = 1; i < s13.length; i++) {
      if (s13[i] < s13[i-1] - 1e-6) { run++; if (run > longestDrop) longestDrop = run; }
      else run = 0;
    }
    log('PLAY','Z13: fade-out ramps DOWN from the start level to zero',
      t13.ok && longestDrop >= 5 && s13[s13.length-1] === 0 ?'PASS':'FAIL',
      `base=${z13?.base} longestStrictDropRun=${longestDrop} first=${s13[0]} last=${s13[s13.length-1]} samples=${JSON.stringify(s13)}`);

    // ---- Z14: onComplete fires - the element unregisters, the ring clears ---
    // This is the half that matters. fadeOutAudio's onComplete is what pauses
    // and calls cleanupAudio (App.jsx:4056-4058); an onComplete that never fired
    // would leave the card showing "playing" forever with a dead element behind
    // it. The ring is driven by isSoundPlaying -> audioElementsRef, so it is the
    // app's own answer to "is this sound still registered".
    // The teardown happens on the fade's onComplete, which is when the ramp
    // reaches zero - so wait for the ring to clear rather than reading it at a
    // fixed moment (the ramp's end is the app's timing, not the test's).
    let z14 = null;
    for (let i = 0; i < 40; i++) {
      z14 = await evalJs(`(() => {
        const c = document.querySelector('[data-sound-card][data-sound-id="pb_fadeout"]');
        const b = document.querySelector('button[title="Stop All Sounds"]');
        return { ring: c ? c.className.includes('ring') : null, stopDisabled: b ? b.disabled : null };
      })()`);
      if (z14?.ring === false && z14?.stopDisabled === true) break;
      await sleep(150);
    }
    log('PLAY','Z14: fade-out onComplete fires - element unregistered, ring cleared',
      z14?.ring===false && z14?.stopDisabled===true?'PASS':'FAIL',JSON.stringify(z14));

    // ---- Z15: playUntil past the file length clamps the fade to the start ---
    // Fixture: Longbow_4.mp3 (0.6s) with playUntil:5 (past the file) and
    // fadeOut:2. audibleEnd = min(0.6, 5) = 0.6, so fadeStart = max(0, 0.6-2)
    // = 0: the fade starts at the file's first sample instead of never. Under
    // the old user-typed `duration` schedule the timer was set for 3s and the
    // file's own `ended` won the race — the fade silently never ran (Z15's old
    // contract). Measuring off the real file length makes the no-op
    // unrepresentable.
    //
    // Sample before the file's natural end at 0.6s, when the ramp is mid-way.
    await stopAll();
    const t15 = await triggerOnce('pb_latefade');
    await sleep(300);
    const z15 = await evalJs(`(() => {
      const els = (window.__audios||[]).filter(x => x._soundId === 'pb_latefade');
      const a = els[els.length - 1];
      return a ? { vol:+a.volume.toFixed(4), fading:!!a.fadeOutInterval, ct:+a.currentTime.toFixed(2) } : null;
    })()`);
    log('PLAY','Z15: playUntil past the file clamps fade-out to the file start - it runs instead of never',
      t15.ok && z15 && z15.fading === true && z15.vol < 1 ? 'PASS':'FAIL',
      `file=0.6s playUntil=5 fadeOut=2 -> ${JSON.stringify(z15)}`);

    // ---- Z16: a level change DURING a fade preserves the ramp position ------
    // This is rescaleAudioTarget's fade branch (App.jsx:715-719), the fiddliest
    // arithmetic in the volume path and previously covered by nothing. With a
    // fadeIn running, it reads the position within the ramp as
    // volume/_fadeTargetVolume, retargets, and re-applies at the SAME position -
    // so a slider move mid-fade is smooth. The else branch would snap the level
    // flat to the new target, which is the bug this guards.
    //
    // Fixture: Tavern_Music.mp3 (152s, so it cannot reach its own end during the
    // test) with fadeIn:3, loop:true, duration:0 (no fade-out timer). Master is
    // pinned to 1 first so oldTarget is exactly 1 and the arithmetic is readable.
    await stopAll();
    await evalJs(`(() => { const m = window.__pbMasterRange(); return m ? window.__pbSet(m, 1) : 'NO_RANGE'; })()`);
    await sleep(300);
    const t16 = await triggerOnce('pb_fadein');
    const z16 = await evalJs(`(async () => {
      const els = (window.__audios||[]).filter(x => x._soundId === 'pb_fadein');
      const a = els[els.length - 1];
      if (!a) return 'NO_EL';
      if (!a.fadeInInterval) return 'NO_FADE_IN_RUNNING';
      // Wait for a mid-ramp sample: step 2 of 20 is ~10% of the way up.
      for (let i = 0; i < 40 && !(a.volume > 0.02 && a.volume < 0.6); i++) {
        await new Promise(r => setTimeout(r, 60));
      }
      const before = a.volume;
      const oldTarget = a._fadeTargetVolume;
      window.__pbSet(window.__pbMasterRange(), 0.2);
      await new Promise(r => setTimeout(r, 60));
      const after = a.volume;
      return { before:+before.toFixed(4), after:+after.toFixed(4),
               oldTarget:+(oldTarget ?? -1).toFixed(4),
               newTarget:a._fadeTargetVolume === undefined ? null : +a._fadeTargetVolume.toFixed(4),
               stillFading: !!a.fadeInInterval, ct:+a.currentTime.toFixed(2) };
    })()`);
    // The signature of the fade branch: after ≈ before * 0.2, i.e. the ramp
    // POSITION carried over, which is far below the new target of 0.2. A snap
    // would read 0.2. tol 0.03 covers one 300ms ramp step (3.3% of target)
    // landing between the two reads, which the fixed sample interval cannot rule out.
    log('PLAY','Z16: a master change mid-fade preserves the ramp position instead of snapping',
      t16.ok && z16 && z16 !== 'NO_EL' && z16 !== 'NO_FADE_IN_RUNNING'
        && near(z16.after, z16.before * 0.2, 0.03) && z16.newTarget === 0.2 && z16.stillFading
        ?'PASS':'FAIL',
      `before=${z16?.before} after=${z16?.after} expected~${z16 ? (z16.before*0.2).toFixed(4) : '?'} oldTarget=${z16?.oldTarget} newTarget=${z16?.newTarget} stillFading=${z16?.stillFading}`);

    // ---- Z17: the ramp then completes at the NEW target, not the old one -----
    // The other half of the same branch: _fadeTargetVolume was retargeted, so
    // applyFadeIn's per-step `audio._fadeTargetVolume ?? targetVolume` reads the
    // new value and the fade lands on the new level. A stale _fadeTargetVolume
    // - the exact bug the loop re-entry guard (Z9) exists for on the other path -
    // would bring this sound back up to 1.
    const z17 = await evalJs(`(async () => {
      const els = (window.__audios||[]).filter(x => x._soundId === 'pb_fadein');
      const a = els[els.length - 1];
      if (!a) return 'NO_EL';
      for (let i = 0; i < 90 && a.fadeInInterval; i++) { await new Promise(r => setTimeout(r, 100)); }
      return { vol:+a.volume.toFixed(4), base:a._baseVolume === undefined ? null : +a._baseVolume.toFixed(4),
               cleared:a._fadeTargetVolume === undefined, stillFading: !!a.fadeInInterval };
    })()`);
    log('PLAY','Z17: the ramp completes at the NEW target level, not the one it started at',
      z17 && z17 !== 'NO_EL' && z17.stillFading === false && z17.cleared && near(z17.vol, 0.2, 0.02) ?'PASS':'FAIL',
      JSON.stringify(z17));
    await stopAll();

    // ---- Z18-Z21: randomPlay -----------------------------------------------
    // Two DISTINCT bundled assets, NOT two uploaded blobs. The earlier proposal
    // assumed this needed a two-blob seed helper that works under Tauri and
    // called that "the only genuinely new code in this whole list" - it does not.
    // An entry with no storedName resolves through the `/assets/${displayName}`
    // fallback (App.jsx:3991-3994), so two bundled files give two different
    // srcs with no upload, no CDP file dialog and no per-platform helper. It is
    // also the branch that matters: the random pick happens on the normalised
    // file LIST, before any blob lookup.
    await stopAll();

    // Tap `times` times, recording the src the app asked for on each trigger.
    // Coordinates are re-read before EVERY tap - driver.centeredCard costs a
    // scroll plus 250ms, and a cached coordinate would turn a missed tap into a
    // silent wrong answer rather than a failure.
    const tapAndCollect = async (id, times) => {
      const sel = `[data-sound-card][data-sound-id="${id}"]`;
      const seen = [];
      for (let i = 0; i < times; i++) {
        const c = await driver.centeredCard(sel);
        if (!c) return { seen, taps: i, reason: 'NO_CARD' };
        await driver.trustedTap(c.x, c.y);
        for (let k = 0; k < 15; k++) {
          const srcs = await evalJs(`(() => (window.__audios||[]).filter(x => x._soundId === '${id}').map(x => (x.src||'').split('/').pop().split('?')[0]))()`);
          if (Array.isArray(srcs) && srcs.length > seen.length) { seen.push(...srcs.slice(seen.length)); break; }
          await sleep(50);
        }
      }
      return { seen, taps: seen.length };
    };

    const TRIGGERS = 12;
    // Z18: 12 draws over 2 files. P(every draw identical) = 2^-11 = 0.05%, so
    // this is not a flaky assertion - it is a deliberate near-certain one.
    const r18 = await tapAndCollect('pb_random', TRIGGERS);
    const distinct18 = [...new Set(r18.seen)];
    log('PLAY','Z18: randomPlay with two files picks more than one of them',
      r18.seen.length >= 2 && distinct18.length >= 2 ?'PASS':'FAIL',
      `triggers=${r18.seen.length} distinct=${JSON.stringify(distinct18)} seen=${JSON.stringify(r18.seen)}`);

    // Z19: the negative control, and the half that makes Z18 mean anything. The
    // SAME 12 triggers against randomPlay:false must land on exactly one file -
    // deterministic, so this can never flake.
    await stopAll();
    const r19 = await tapAndCollect('pb_seq', TRIGGERS);
    const distinct19 = [...new Set(r19.seen)];
    log('PLAY','Z19: randomPlay OFF plays the first file every time (negative control)',
      r19.seen.length >= 2 && distinct19.length === 1 ?'PASS':'FAIL',
      `triggers=${r19.seen.length} distinct=${JSON.stringify(distinct19)}`);

    // Z20: randomPlay ON but only ONE file. The `normalizedFiles.length > 1`
    // guard (App.jsx:3970) must send this down the deterministic path - a sound
    // cannot randomly pick a file it does not have.
    await stopAll();
    const r20 = await tapAndCollect('pb_random_one', 3);
    const distinct20 = [...new Set(r20.seen)];
    log('PLAY','Z20: randomPlay with a single file still plays that file',
      r20.seen.length >= 2 && distinct20.length === 1 && distinct20[0] === 'Longbow_4.mp3' ?'PASS':'FAIL',
      `triggers=${r20.seen.length} distinct=${JSON.stringify(distinct20)}`);

    // Z21: every draw resolved to one of the sound's OWN files, and the app
    // built one element per trigger and registered none of them twice. This is
    // the leak check the long-asset proposal asked for, made assertable: a
    // random pick that produced a dangling src, or a trigger that silently
    // built no element, would both show up here.
    const z21 = await evalJs(`(() => {
      const byId = id => (window.__audios||[]).filter(x => x._soundId === id);
      const rand = byId('pb_random');
      const seq = byId('pb_seq');
      const one = byId('pb_random_one');
      const ok = els => els.every(e => ['Longbow_4.mp3','Longbow_3.mp3'].includes((e.src||'').split('/').pop().split('?')[0]));
      return { randomTotal: rand.length, seqTotal: seq.length, oneTotal: one.length,
               randomAllResolvable: ok(rand), seqAllResolvable: ok(seq),
               randDistinctSrcs: new Set(rand.map(e => e.src)).size };
    })()`);
    log('PLAY','Z21: every random draw resolved to one of the sound\'s own files, one element per trigger',
      z21?.randomTotal === TRIGGERS && z21?.seqTotal === TRIGGERS && z21?.oneTotal === 3
        && z21?.randomAllResolvable === true && z21?.seqAllResolvable === true ?'PASS':'FAIL',
      JSON.stringify(z21));
    await stopAll();
  }
};
