import { awaitBoard } from '../lib/page.mjs'

export const hotkeys = {
  title: 'SUITE HK: PROFILE HOTKEYS',
  async run(ctx) {
    const { evalJs, sleep, reload, cdpInput, driver, isTauri } = ctx
    const record = async (code = 'Digit1', key = '1', extra = {}) => {
      await cdpInput('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: key === 'Escape' ? 27 : key.toUpperCase().charCodeAt(0), ...extra })
      await cdpInput('Input.dispatchKeyEvent', { type: 'keyUp', code, key })
      await sleep(250)
    }
    const click = async selector => { const result = await evalJs(`(() => { const b=document.querySelector(${JSON.stringify(selector)}); if(!b) return false; b.click(); return true })()`); await sleep(180); return result }
    const settings = async () => {
      await ctx.closeDrawer()
      await evalJs(`document.querySelector('button[title="Settings"]')?.click()`)
      await sleep(250)
    }
    const close = async () => { await evalJs(`window.__clickText('Close Settings')`); await sleep(200) }
    const spy = async () => evalJs(`(() => {
      window.__hkPlayed=[]; const play=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(...args){window.__hkPlayed.push(this._soundId);return play.apply(this,args)};
      return true;
    })()`)
    const played = async () => await evalJs(`window.__hkPlayed || []`)
    const count = async () => (await played())?.length
    const stored = async () => await evalJs(`JSON.parse(localStorage.getItem(window.__pk('ttrpg_hotkeys')) || 'null')`)
    const log = (category, label, yes, detail = '') => ctx.log(category, label, yes ? 'PASS' : 'FAIL', typeof detail === 'string' ? detail : JSON.stringify(detail))
    try {
      await evalJs(`window.__pseed({ttrpg_characters:[{id:'hk_char',name:'Hotkey Board',sounds:[
        {id:'hk_one',name:'First sound',icon:'',files:[{name:'Tavern_Music.mp3',displayName:'Tavern_Music.mp3'}],loop:true,color:'#84cc16'},
        {id:'hk_two',name:'Second sound',icon:'',files:[{name:'Forest_Ambience.mp3',displayName:'Forest_Ambience.mp3'}],loop:true,color:'#84cc16'}]}],
        ttrpg_environment:[],ttrpg_groups:[],ttrpg_data_version:'3',ttrpg_hotkeys:{version:1,bindings:[]}})`)
      await reload(); await awaitBoard(ctx, { min: 2 }); await spy(); await settings()
      log('HOTKEY', 'HK1: settings offers profile hotkey management', await evalJs(`!!document.querySelector('[data-hotkey-add]')`))
      await click('[data-hotkey-add]')
      await evalJs(`(() => {const i=document.querySelector('[data-hotkey-search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Second');i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
      await sleep(100)
      log('HOTKEY', 'HK35: picker searches sound names and hides nonmatches', await evalJs(`!!document.querySelector('[data-hotkey-target="hk_two"]') && !document.querySelector('[data-hotkey-target="hk_one"]')`))
      await evalJs(`(() => {const i=document.querySelector('[data-hotkey-search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'no matching hotkey sound');i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
      await sleep(100)
      log('HOTKEY', 'HK36: picker shows an explicit empty search result', await evalJs(`document.querySelector('[data-hotkey-picker]').textContent.includes('No sounds match') && !document.querySelector('[data-hotkey-target]')`))
      await evalJs(`(() => {const i=document.querySelector('[data-hotkey-search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Hotkey Board');i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
      await sleep(100)
      log('HOTKEY', 'HK37: picker searches location paths', await evalJs(`document.querySelectorAll('[data-hotkey-target]').length===2`))
      await click('[data-hotkey-target="hk_one"]')
      log('HOTKEY', 'HK38: choosing a sound exposes its selection and location', await evalJs(`document.querySelector('[data-hotkey-target="hk_one"]').getAttribute('aria-pressed')==='true' && document.querySelector('[data-hotkey-selection]').textContent.includes('Hotkey Board')`))
      await click('[data-hotkey-record]'); await record()
      await evalJs(`(() => {document.querySelector('[data-hotkey-target="hk_one"]').click();return true})()`)
      await click('[data-hotkey-save]')
      log('HOTKEY', 'HK33: saving restores focus to Add hotkey', await evalJs(`document.activeElement===document.querySelector('[data-hotkey-add]')`))
      log('HOTKEY', 'HK2: recorded key and chosen target persist', (await stored())?.bindings?.[0]?.target?.soundId === 'hk_one' && (await stored())?.bindings?.[0]?.code === 'Digit1')
      await record(); log('HOTKEY', 'HK3: settings suppresses playback', await count() === 0)
      await close(); await evalJs(`document.activeElement?.blur()`); await record()
      log('HOTKEY', 'HK4: trusted key dispatch triggers the sound', (await played())?.includes('hk_one'), await played())
      const beforeRepeat = await count(); await record(); log('HOTKEY', 'HK5: another press triggers an overlapping instance', await count() === beforeRepeat + 1)
      const noFire = await count()
      await record('Digit1', '1', { autoRepeat: true })
      for (const modifiers of [1, 2, 4, 8]) await record('Digit1', '1', { modifiers })
      log('HOTKEY', 'HK6: repeat and Alt Ctrl Meta Shift do not trigger', await count() === noFire)
      await evalJs(`window.__hkPrevent=e=>e.preventDefault();document.addEventListener('keydown',window.__hkPrevent,true)`)
      await record(); await evalJs(`document.removeEventListener('keydown',window.__hkPrevent,true)`)
      log('HOTKEY', 'HK7: a prevented event is respected', await count() === noFire)
      for (const html of ['<input>', '<textarea></textarea>', '<select><option>One</option></select>', '<div contenteditable="true"><span tabindex="0">Text</span></div>', '<div role="textbox" tabindex="0"></div>']) {
        await evalJs(`(() => {const w=document.createElement('div');w.id='hk_input_fixture';w.innerHTML=${JSON.stringify(html)};document.body.append(w);(w.querySelector('span') || w.firstElementChild).focus();return true})()`)
        await record(); await evalJs(`document.getElementById('hk_input_fixture').remove()`)
      }
      log('HOTKEY', 'HK8: inputs and editable ancestors suppress playback', await count() === noFire)
      await driver.enterEditMode(); await record(); log('HOTKEY', 'HK9: edit mode suppresses playback', await count() === noFire); await driver.exitEditMode()
      await evalJs(`document.querySelector('[data-sound-id="hk_two"] [data-sound-card], [data-sound-card][data-sound-id="hk_two"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2}))`)
      await sleep(150); await record(); const primePlayed = await played()
      log('HOTKEY', 'HK10: hotkey consumes priming through card playback path', primePlayed?.slice(-2).includes('hk_two') && await evalJs(`document.querySelectorAll('[data-prime-badge]').length===0`), primePlayed)
      const oneShot = await count(); await record(); log('HOTKEY', 'HK11: subsequent press does not replay consumed primes', await count() === oneShot + 1)
      await settings(); await click('[data-hotkey-add]'); await click('[data-hotkey-record]'); await record()
      log('HOTKEY', 'HK12: duplicate key refused without replacing binding', await evalJs(`document.querySelector('[data-hotkeys-section]').textContent.includes('already assigned')`) && (await stored())?.bindings?.length === 1)
      await record('Escape', 'Escape'); log('HOTKEY', 'HK13: Escape cancels recording and keeps settings', await evalJs(`!!document.querySelector('[data-hotkeys-section]') && !document.querySelector('[data-hotkey-record]').textContent.includes('Press a key')`))
      await click('[data-hotkey-cancel]'); await click('[data-hotkey-edit]'); await click('[data-hotkey-record]'); await record('Digit2', '2'); await click('[data-hotkey-cancel]')
      log('HOTKEY', 'HK14: cancel draft preserves original binding', (await stored())?.bindings?.[0]?.code === 'Digit1')
      log('HOTKEY', 'HK34: canceling edit restores focus to initiating control', await evalJs(`document.activeElement===document.querySelector('[data-hotkey-edit]')`))
      await click('[data-hotkey-edit]'); await click('[data-hotkey-record]'); await record('Digit2', '2'); await click('[data-hotkey-save]')
      await close(); await evalJs(`document.activeElement?.blur()`); const reb = await count(); await record(); await record('Digit2', '2')
      log('HOTKEY', 'HK15: rebind removes old key and installs new key once', await count() === reb + 1 && (await stored())?.bindings?.[0]?.code === 'Digit2')
      await reload(); await awaitBoard(ctx, { min: 2 }); await spy(); await record('Digit2', '2')
      log('HOTKEY', 'HK16: reload retains binding with one listener', await count() === 1)
      await evalJs(`(() => {const c=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')));const s=c[0].sounds.shift();s.name='Renamed and moved';localStorage.setItem(window.__pk('ttrpg_characters'),JSON.stringify(c));localStorage.setItem(window.__pk('ttrpg_environment'),JSON.stringify([{category:'New category',sounds:[s]}]));return true})()`)
      await reload(); await spy(); await record('Digit2', '2'); await settings()
      log('HOTKEY', 'HK17: rename and cross-container move preserve off-screen target', (await played())?.includes('hk_one') && await evalJs(`document.querySelector('[data-hotkey-row]').textContent.includes('Renamed and moved')`))
      await close(); await evalJs(`localStorage.setItem(window.__pk('ttrpg_environment'),'[]')`); await reload(); await spy(); await record('Digit2', '2'); await settings()
      log('HOTKEY', 'HK18: deleted sound leaves visible inert unresolved binding', await count() === 0 && await evalJs(`document.querySelector('[data-hotkey-status]').textContent.includes('Unresolved')`))
      await click('[data-hotkey-edit]'); await evalJs(`(() => {document.querySelector('[data-hotkey-target="hk_two"]').click();return true})()`); await click('[data-hotkey-save]'); await close(); await evalJs(`document.activeElement?.blur()`); await record('Digit2', '2')
      log('HOTKEY', 'HK19: repairing target changes playback', (await played())?.includes('hk_two'))
      const home = await evalJs(`window.__pid()`)
      await settings(); await evalJs(`(() => {const i=document.querySelector('[data-profile-new-name]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Hotkey other profile');i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
      await click('[data-profile-create]'); await reload(); await spy(); await record('Digit2', '2')
      const other = await evalJs(`window.__pid()`)
      log('HOTKEY', 'HK20: new profile has no inherited bindings or stale dispatch', await count() === 0 && await evalJs(`localStorage.getItem(window.__pk('ttrpg_hotkeys'))===null`))
      if (isTauri) {
        const roundTrip = await evalJs(`(async () => {
          const b=await import('/src/profileBundle.js'),p=await import('/src/profileStorage.js');
          const payload=JSON.parse(p.readProfileValue(${JSON.stringify(home)},'ttrpg_hotkeys'));
          const options={normalize:(_k,v)=>v,dataVersion:'3',setActive:false};
          const packed=await b.exportBundle({profileId:${JSON.stringify(home)},profileName:'Hotkey Roundtrip',data:{characters:[],environmentSounds:[],groups:[],hotkeys:payload},settings:{}});
          const imported=await b.importBundle(packed.bytes,options);
          const same=p.readProfileValue(imported.profileId,'ttrpg_hotkeys')===JSON.stringify(payload);
          p.deleteProfile(imported.profileId);
          return {same,version:packed.manifest.formatVersion};
        })()`)
        log('HOTKEY', 'HK21: native bundle v2 round trip preserves profile bindings', roundTrip?.same && roundTrip?.version === 2, roundTrip)
      } else console.log('SKIP HOTKEY HK21: native bundle engine; Node covers format and legacy import')
      await settings(); await click(`[data-profile-switch="${home}"]`)
      await reload(); await spy(); await record('Digit2', '2')
      log('HOTKEY', 'HK22: switching back restores the owning profile binding', (await played())?.includes('hk_two'))
      await settings(); await click('[data-hotkey-remove]'); await close(); await evalJs(`document.activeElement?.blur()`); const removed = await count(); await record('Digit2', '2')
      log('HOTKEY', 'HK23: removing a binding stops dispatch immediately', await count() === removed && (await stored())?.bindings?.length === 0)
      await settings(); await click('[data-hotkey-add]'); await click('[data-hotkey-record]'); await record('Digit3', '3')
      await evalJs(`(() => {document.querySelector('[data-hotkey-target="hk_two"]').click();window.__hkSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===window.__pk('ttrpg_hotkeys'))throw new DOMException('Hotkey quota probe','QuotaExceededError');return window.__hkSet.call(this,k,v)};return true})()`)
      await click('[data-hotkey-save]'); await evalJs(`Storage.prototype.setItem=window.__hkSet;delete window.__hkSet`)
      log('HOTKEY', 'HK26: failed storage write keeps old bindings and shows inline error', (await stored())?.bindings?.length === 0 && await evalJs(`!!document.querySelector('[data-hotkey-save-error]') && !!document.querySelector('[data-hotkey-draft]')`))
      await click('[data-hotkey-save]')
      log('HOTKEY', 'HK27: retry after storage failure persists the draft', (await stored())?.bindings?.[0]?.code === 'Digit3' && await evalJs(`!document.querySelector('[data-hotkey-save-error]')`))
      await click('[data-hotkey-edit]'); await click('[data-hotkey-record]'); await record('Space', ' ')
      log('HOTKEY', 'HK28: reserved key does not end capture or change saved code', (await stored())?.bindings?.[0]?.code === 'Digit3' && await evalJs(`document.querySelector('[data-hotkey-record]').textContent.includes('Press a key')`))
      await evalJs(`window.dispatchEvent(new Event('blur'))`); await sleep(100)
      log('HOTKEY', 'HK29: losing focus cancels recording', await evalJs(`!document.querySelector('[data-hotkey-record]').textContent.includes('Press a key')`))
      await click('[data-hotkey-cancel]'); await close()
      await evalJs(`(() => {const c=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')));localStorage.setItem(window.__pk('ttrpg_environment'),JSON.stringify([{category:'Duplicate ids',sounds:[{...c[0].sounds[0]}]}]));return true})()`)
      await reload(); await spy(); await record('Digit3', '3'); await settings()
      log('HOTKEY', 'HK31: ambiguous imported sound ids are visible and inert', await count() === 0 && await evalJs(`document.querySelector('[data-hotkey-status]').textContent.includes('Unresolved')`))
      await close(); await evalJs(`localStorage.setItem(window.__pk('ttrpg_environment'),'[]')`); await reload(); await spy(); await record('Digit3', '3')
      log('HOTKEY', 'HK32: resolving duplicate identity restores the same binding', (await played())?.includes('hk_two'))
      await evalJs(`localStorage.setItem(window.__pk('ttrpg_hotkeys'),JSON.stringify({version:99,bindings:[]}))`); await reload(); await settings()
      log('HOTKEY', 'HK24: unknown stored version is visible locked and preserved', await evalJs(`document.querySelector('[data-hotkey-add]').disabled && !!document.querySelector('[data-hotkeys-section] [role="alert"]') && JSON.parse(localStorage.getItem(window.__pk('ttrpg_hotkeys'))).version===99`))
      await evalJs(`window.__hkConfirm=window.confirm;window.confirm=()=>true`)
      await click(`[data-profile-delete="${other}"]`); await sleep(800)
      await evalJs(`window.confirm=window.__hkConfirm;delete window.__hkConfirm`)
      log('HOTKEY', 'HK25: deleting other profile preserves owning bindings', await evalJs(`!JSON.parse(localStorage.getItem('spellcaster_profiles')).profiles.some(p=>p.id===${JSON.stringify(other)}) && JSON.parse(localStorage.getItem(window.__pk('ttrpg_hotkeys'))).version===99`))
      await evalJs(`window.__hkConfirm=window.confirm;window.confirm=()=>true`); await click('[data-hotkey-reset]'); await evalJs(`window.confirm=window.__hkConfirm;delete window.__hkConfirm`)
      log('HOTKEY', 'HK30: explicit reset repairs unsupported storage', (await stored())?.version === 2 && (await stored())?.bindings?.length === 0 && await evalJs(`!document.querySelector('[data-hotkey-add]').disabled`))
      await close()
      await evalJs(`(() => {const c=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')));c.push({id:'hk_chords',name:'Modifier sounds',sounds:[{id:'hk_mod',name:'Modified sound',files:[{name:'Tavern_Music.mp3',displayName:'Tavern_Music.mp3'}]}]});localStorage.setItem(window.__pk('ttrpg_characters'),JSON.stringify(c));return true})()`)
      await reload(); await spy(); await settings()
      for (let mask = 0; mask < 8; mask++) {
        await click('[data-hotkey-add]'); await click('[data-hotkey-record]')
        if (mask === 1) {
          await record('ControlLeft', 'Control', { modifiers: 2 })
          log('HOTKEY', 'HK39: pressing a modifier alone keeps recording active', await evalJs(`document.querySelector('[data-hotkey-record]').textContent.includes('Press a key')`))
        }
        const modifiers = (mask & 1 ? 2 : 0) | (mask & 2 ? 1 : 0) | (mask & 4 ? 8 : 0)
        await record('Digit4', '4', { modifiers })
        await click(`[data-hotkey-target="${mask ? 'hk_mod' : 'hk_two'}"]`); await click('[data-hotkey-save]')
      }
      const chords = await stored()
      log('HOTKEY', 'HK40: all seven modifier combinations coexist with the bare key', chords?.version === 2 && chords.bindings.length === 8 && new Set(chords.bindings.map(r=>r.modifiers)).size === 8)
      await close(); await evalJs(`document.activeElement?.blur()`)
      let exact = true
      for (let mask = 0; mask < 8; mask++) {
        const before = await count(), modifiers = (mask & 1 ? 2 : 0) | (mask & 2 ? 1 : 0) | (mask & 4 ? 8 : 0)
        await record('Digit4', '4', { modifiers })
        const result = await played()
        exact &&= result.length === before + 1 && result.at(-1) === (mask ? 'hk_mod' : 'hk_two')
      }
      log('HOTKEY', 'HK41: trusted dispatch matches exact modifiers and the right target', exact)
      const unmapped = await count(); await record('Digit5', '5', { modifiers: 10 }); await record('Digit4', '4', { modifiers: 4 })
      log('HOTKEY', 'HK42: unassigned chord and Meta remain inert', await count() === unmapped)
      await reload(); await spy(); await evalJs(`document.activeElement?.blur()`); await record('Digit4', '4', { modifiers: 2 })
      log('HOTKEY', 'HK43: modifier bindings survive reload and dispatch once', await count() === 1 && (await played())[0] === 'hk_mod')
      await settings(); await click('[data-hotkey-add]'); await click('[data-hotkey-record]'); await record('Digit4', '4', { modifiers: 2 })
      log('HOTKEY', 'HK44: duplicate chord is refused without replacing another binding', (await stored()).bindings.length === 8 && await evalJs(`document.querySelector('[data-hotkey-record]').textContent.includes('Press a key') && document.querySelector('[data-hotkeys-section]').textContent.includes('already assigned')`))
      await record('Slash', '/'); await click('[data-hotkey-target="hk_mod"]'); await click('[data-hotkey-save]'); await close(); await evalJs(`document.activeElement?.blur()`)
      const punctuation = await count(); await record('Slash', '/')
      log('HOTKEY', 'HK45: punctuation can be recorded and trigger playback', await count() === punctuation + 1)
      if (isTauri) {
        const chordBundle = await evalJs(`(async () => {const b=await import('/src/profileBundle.js'),p=await import('/src/profileStorage.js');const raw=p.readProfileValue(window.__pid(),'ttrpg_hotkeys');const packed=await b.exportBundle({profileId:window.__pid(),profileName:'Chords',data:{characters:[],environmentSounds:[],groups:[],hotkeys:JSON.parse(raw)},settings:{}});const r=await b.importBundle(packed.bytes,{normalize:(_k,v)=>v,dataVersion:'3',setActive:false});const same=p.readProfileValue(r.profileId,'ttrpg_hotkeys')===raw;p.deleteProfile(r.profileId);return same})()`)
        log('HOTKEY', 'HK46: native bundle round trip preserves modifier masks', chordBundle === true)
      } else console.log('SKIP HOTKEY HK46: native bundle engine; modifier round trip covered in Node')
      if (isTauri && driver.platform === 'mobile') console.log('GAP HOTKEY: physical Android keyboard untested; emulator CDP dispatch is not hardware proof')
    } catch (error) {
      log('HOTKEY', 'HK0: hotkey suite prerequisites completed', false, error.message)
    } finally {
      // Keep future-version fixture out of later suites, even after a failure.
      await evalJs(`localStorage.removeItem(window.__pk('ttrpg_hotkeys'))`)
      await evalJs(`if(window.__hkConfirm){window.confirm=window.__hkConfirm;delete window.__hkConfirm}`)
      await evalJs(`if(window.__hkSet){Storage.prototype.setItem=window.__hkSet;delete window.__hkSet}`)
      await reload()
    }
  }
}
