// Shared live-playback spec (Suite Z, Z1-Z10).
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

const near = (v, target, tol) => Math.abs((v ?? -999) - target) <= tol;

export const playback = {
  title: 'SUITE Z: LIVE PLAYBACK',
  async run(ctx) {
    const { log, evalJs, sleep, reload, driver } = ctx;

    // One character, one looping sound on a real bundled asset with a 1s fade.
    // No `volume` field, so it starts at 100% and the master is the only lever.
    const seed = `(() => {
      localStorage.setItem('ttrpg_characters', JSON.stringify([{
        id:'c1', name:'Human Paladin', sounds:[
          { id:'pb_main', name:'Playback Probe', type:'Test', icon:'',
            files:[{name:'Longbow_4.mp3', displayName:'Longbow_4.mp3'}],
            color:'#ff0000', duration:0, fadeIn:1, fadeOut:0, loop:true, randomPlay:false,
            brightness:1 }
        ]
      }]));
      localStorage.setItem('ttrpg_environment', JSON.stringify([]));
      localStorage.setItem('ttrpg_groups', JSON.stringify([]));
      localStorage.setItem('ttrpg_themes', JSON.stringify([]));
      localStorage.setItem('ttrpg_data_version', '3');
      for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k.startsWith('sound_file_')) localStorage.removeItem(k);}
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
    log('PLAY','Z1: playback started',z1?.paused===false?'PASS':'FAIL',JSON.stringify(z1));
    log('PLAY','Z2: audio source resolved and decoded',!!z1?.src && z1?.ready>=2?'PASS':'FAIL',`ready=${z1?.ready} src=${(z1?.src||'').slice(0,60)}`);
    log('PLAY','Z3: card shows the play ring while playing',z1?.ring===true?'PASS':'FAIL',String(z1?.ring));

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

    // ---- Z8-Z9: crossing the loop boundary ---------------------------------
    // The app does NOT use the native loop: it rewinds in a `timeupdate` handler
    // once currentTime >= max(duration - 0.25, duration * 0.98). Seeking to
    // duration - 0.2 does NOT reliably cross that on a short clip, so seek past
    // 98% instead. The `ended` path rewinds identically, so either route works.
    //
    // A rewind is a DROP in currentTime, so detect the drop rather than reading
    // a single sample: the bundled fixture is short, so one late read can easily
    // land just past the boundary with nothing to show for it.
    const z8 = await evalJs(`(async () => {
      const a = window.__pbEl(); if (!a) return 'NO_EL';
      if (!Number.isFinite(a.duration) || a.duration <= 0) return 'NO_DURATION';
      const threshold = Math.max(a.duration - 0.25, a.duration * 0.98);
      const before = a.currentTime;
      a.currentTime = threshold + (a.duration - threshold) * 0.9;
      const reads = [];
      for (let i = 0; i < 20; i++) { reads.push(+a.currentTime.toFixed(3)); await new Promise(r => setTimeout(r, 50)); }
      return { before, threshold: +threshold.toFixed(3), duration:+a.duration.toFixed(3), reads, min: Math.min(...reads) };
    })()`);
    const dropped = Array.isArray(z8?.reads) && z8.reads.some((v,i,arr) => i > 0 && v < arr[i-1] - 0.05);
    log('PLAY','Z8: a looping sound rewinds at the boundary',dropped && (z8?.min ?? 1) < 0.2?'PASS':'FAIL',
      `duration=${z8?.duration} threshold=${z8?.threshold} reads=${JSON.stringify(z8?.reads)}`);

    // Z9 is the loop-re-entry regression guard PER_SOUND_VOLUME_SPEC.md §8 left
    // open. On the first boundary crossing the app re-applies the fade-in, and
    // it reads the target back off the element (_baseVolume) rather than closing
    // over the level the sound started at. A stale _baseVolume would fade this
    // sound back up to 1.0 instead of whatever the master is on now.
    //
    // The expected level is read back from the master rather than hardcoded, so
    // this stays honest if Z6/Z7 ever stop driving the master to a fixed value.
    const z9 = await evalJs(`(async () => {
      const a = window.__pbEl(); if (!a) return 'NO_EL';
      const samples = [];
      for (let i = 0; i < 12; i++) { samples.push(+a.volume.toFixed(4)); await new Promise(r => setTimeout(r, 250)); }
      return { samples, base:a._baseVolume, master: window.__pbMasterRange()?.value };
    })()`);
    const settled = Array.isArray(z9?.samples) ? z9.samples.slice(-3) : [];
    const masterLevel = Number(z9?.master ?? NaN);
    log('PLAY','Z9: loop re-entry returns to the CURRENT master level, not the level it started at',
      settled.length===3 && Number.isFinite(masterLevel) && settled.every(v => near(v, masterLevel, 0.12)) ? 'PASS':'FAIL',
      `settled=${JSON.stringify(settled)} master=${z9?.master} _baseVolume=${z9?.base}`);

    // ---- Z10: Stop All ------------------------------------------------------
    await evalJs(`(() => { const b = document.querySelector('button[title="Stop All Sounds"]'); if (!b) return 'NO_BTN'; b.click(); return 'OK'; })()`);
    await sleep(500);
    const z10 = await evalJs(`(() => {
      const a = window.__pbEl(); const c = window.__pbCard();
      return { clicked:true, paused:a?a.paused:null, ct:a?a.currentTime:null, ring:c?c.className.includes('ring'):null };
    })()`);
    log('PLAY','Z10: Stop All stops the audio and clears the ring',z10?.paused===true && z10?.ring===false?'PASS':'FAIL',JSON.stringify(z10));

    // ---- Z11-Z12: loop and fadeIn survive the modal round trip -------------
    // Ported from e2e-features.mjs D11/D12, the last two assertions that only
    // the legacy suite made. Suite J checks that the modal PREFILLS these fields
    // and that a sound saves at all; nothing checked that a stored loop/fadeIn
    // comes back out of the modal and that writing them lands in storage. That
    // is the hydrate/write pair, and it is the half a field added to the
    // new-sound allowlist would silently break.
    await driver.enterEditMode();
    await evalJs(`(() => {
      const c = window.__pbCard();
      const b = c?.parentElement?.querySelector('button[title="Edit Sound"]');
      if (b) b.click();
      return 'OK';
    })()`);
    await sleep(800);
    const z11 = await evalJs(`(() => ({
      loop: document.querySelector('#loop')?.checked,
      fadeIn: document.querySelector('input[name="fadeIn"]')?.value
    }))()`);
    log('PLAY','Z11: the edit modal hydrates loop and fadeIn from storage',
      z11?.loop===true && Number(z11?.fadeIn)===1?'PASS':'FAIL',JSON.stringify(z11));

    const z11b = await evalJs(`(() => {
      const loop = document.querySelector('#loop');
      if (loop && loop.checked) loop.click();
      return window.__pbSetField('fadeIn', 2);
    })()`);
    await ctx.submitModal('Save Changes');
    await sleep(1000);
    await driver.exitEditMode();
    const z12 = await evalJs(`(() => {
      const c = JSON.parse(localStorage.getItem('ttrpg_characters')||'[]');
      const s = c[0]?.sounds?.find(x => x.id === 'pb_main');
      return { loop: s?.loop, fadeIn: s?.fadeIn, written: window.__pbSetField ? undefined : 'NO_SETTER' };
    })()`);
    log('PLAY','Z12: edited loop and fadeIn persist to storage',
      z12?.loop===false && Number(z12?.fadeIn)===2 && z11b==='2'?'PASS':'FAIL',
      `formReadBack=${z11b} stored=${JSON.stringify({loop:z12?.loop,fadeIn:z12?.fadeIn})}`);
  }
};
