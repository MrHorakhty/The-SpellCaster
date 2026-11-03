import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { awaitBoard } from '../lib/page.mjs'

async function reserveConflict() {
    const child = spawn('pwsh.exe', ['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('../global-shortcut-fixture.ps1',import.meta.url))], { windowsHide:true, stdio:['pipe','pipe','pipe'] })
    let error = '', output = ''
    child.stderr.setEncoding('utf8'); child.stderr.on('data', value => { error += value })
    try {
        await new Promise((resolve,reject) => {
            const timer=setTimeout(()=>reject(Error(`Shortcut conflict fixture timed out: ${error}`)),10000)
            child.stdout.setEncoding('utf8')
            child.stdout.on('data',value=>{output+=value;if(output.includes('READY')){clearTimeout(timer);resolve()}})
            child.once('error',e=>{clearTimeout(timer);reject(e)})
            child.once('exit',code=>{clearTimeout(timer);if(!output.includes('READY'))reject(Error(`Shortcut fixture exited ${code}: ${error}`))})
        })
        return child
    } catch(error) { child.kill();throw error }
}

async function releaseConflict(child) {
    if (!child || child.exitCode !== null) return
    child.stdin.end('STOP\n')
    await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve()},3000);child.once('exit',()=>{clearTimeout(timer);resolve()})})
}

export const globalShortcuts = {
    title:'SUITE GS: WINDOWS GLOBAL SHORTCUTS AND PORTABLE FALLBACK',
    async run(ctx) {
        const {evalJs,sleep,reload,cdpInput,isTauri,driver}=ctx
        const windows = isTauri && driver.platform !== 'mobile'
        const log=(category,label,value,detail='')=>ctx.log(category,label,value?'PASS':'FAIL',detail)
        const click=async selector=>{await evalJs(`document.querySelector(${JSON.stringify(selector)})?.click()`);await sleep(200)}
        const settings=async()=>{await ctx.closeDrawer();await click('button[title="Settings"]')}
        const close=async()=>{await evalJs(`window.__clickText('Close Settings')`);await sleep(350)}
        const record=async(code='KeyB',key='B',vk=66)=>{
            await cdpInput('Input.dispatchKeyEvent',{type:'keyDown',code,key,windowsVirtualKeyCode:vk,modifiers:10})
            await cdpInput('Input.dispatchKeyEvent',{type:'keyUp',code,key,windowsVirtualKeyCode:vk})
            await sleep(250)
        }
        const stored=()=>evalJs(`JSON.parse(localStorage.getItem(window.__pk('ttrpg_hotkeys'))||'null')`)
        const spy=()=>evalJs(`(()=>{window.__gsPlayed=[];const old=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){window.__gsPlayed.push(this._soundId);return old.apply(this,args)};return true})()`)
        const registered=()=>evalJs(`(async()=>{const api=await import('/node_modules/@tauri-apps/plugin-global-shortcut/dist-js/index.js');return api.isRegistered('Control+Shift+KeyB')})()`)
        const waitRegistration=async expected=>{
            if(!windows)return true
            for(let i=0;i<25;i++){if(await registered()===expected)return true;await sleep(200)}
            return false
        }
        let conflict
        try {
            await evalJs(`window.__pseed({ttrpg_characters:[{id:'gs_hero',name:'Global Board',sounds:[{id:'gs_one',name:'Global Sound',files:[{name:'Longbow_4.mp3'}]},{id:'gs_two',name:'Other Sound',files:[{name:'Longbow_4.mp3'}]}]}],ttrpg_environment:[],ttrpg_groups:[],ttrpg_data_version:'3',ttrpg_hotkeys:{version:3,bindings:[]}})`)
            await reload();await awaitBoard(ctx,{min:2});await settings();await click('[data-hotkey-add]')
            log('GLOBAL','GS1: global recording is enabled only by the Windows native capability',await evalJs(`document.querySelector('[data-hotkey-global]').disabled===${!windows}`))
            if(windows)await click('[data-hotkey-global]')
            await click('[data-hotkey-record]');await record();await click('[data-hotkey-target="gs_one"]');await click('[data-hotkey-save]')
            let payload=await stored()
            log('GLOBAL','GS2: recording saves version3 and preserves the platform-appropriate key identity',payload?.version===3&&payload.bindings.length===1&&payload.bindings[0].modifiers===5&&payload.bindings[0].global===windows&&(!windows||payload.bindings[0].globalCode==='KeyB'))
            await close()
            if(!windows){await evalJs(`(()=>{const p=JSON.parse(localStorage.getItem(window.__pk('ttrpg_hotkeys')));p.bindings[0].global=true;p.bindings[0].globalCode='KeyB';localStorage.setItem(window.__pk('ttrpg_hotkeys'),JSON.stringify(p));return true})()`)}
            await reload();await awaitBoard(ctx,{min:2});await spy();await evalJs(`document.activeElement?.blur()`)
            const ready=await waitRegistration(true)
            log('GLOBAL','GS3: reload restores native registration or preserves portable global data',ready&&(await stored())?.bindings[0]?.global===true,windows?'real plugin registration':'in-app fallback platform')
            await record()
            const played=await evalJs(`window.__gsPlayed`)
            log('GLOBAL','GS4: native ownership prevents duplicate local dispatch and other platforms retain focused playback',windows?played?.length===0:played?.filter(id=>id==='gs_one').length===1,JSON.stringify(played))
            if(windows)console.log('GAP GLOBAL: CDP does not generate an OS global key. Physical background activation requires user hand-test.')
            await settings()
            log('GLOBAL','GS5: settings pause native registration while retaining saved global intent',await waitRegistration(false)&&(await stored())?.bindings[0]?.global===true)
            if(windows)conflict=await reserveConflict()
            await close();await sleep(350)
            log('GLOBAL','GS6: a real OS registration conflict is visible without losing the binding',windows?await evalJs(`!!document.querySelector('[data-global-shortcut-error]')`)&&await waitRegistration(false):(await stored())?.bindings[0]?.global===true,windows?'separate-process RegisterHotKey conflict':'native registration intentionally unavailable')
            await releaseConflict(conflict);conflict=null
            await settings();await close()
            log('GLOBAL','GS7: registration recovers after conflict release or remains portable in-app data',await waitRegistration(true)&&(!windows||await evalJs(`!document.querySelector('[data-global-shortcut-error]')`)))
            const home=await evalJs(`window.__pid()`)
            await settings();await evalJs(`(()=>{const i=document.querySelector('[data-profile-new-name]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Global alternate');i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
            await click('[data-profile-create]');await reload()
            log('GLOBAL','GS8: switching profile removes native ownership and does not inherit controls',await waitRegistration(false)&&await evalJs(`localStorage.getItem(window.__pk('ttrpg_hotkeys'))===null`))
            await settings();await click(`[data-profile-switch="${home}"]`);await reload();await awaitBoard(ctx,{min:2})
            log('GLOBAL','GS9: returning to the owner restores its saved registration',await waitRegistration(true)&&(await stored())?.bindings[0]?.target.soundId==='gs_one')
            await settings();await click('[data-hotkey-remove]');await close()
            log('GLOBAL','GS10: removing a global binding releases native registration',await waitRegistration(false)&&(await stored())?.bindings.length===0)
            await settings();await click('[data-hotkey-add]');if(windows)await click('[data-hotkey-global]')
            await click('[data-hotkey-record]');await record('Quote',windows?'i':"'",222);await click('[data-hotkey-target="gs_two"]');await click('[data-hotkey-save]')
            payload=await stored()
            log('GLOBAL','GS11: OEM recording preserves the native virtual key instead of guessing from the letter',payload?.bindings.length===1&&payload.bindings[0].code==='Quote'&&(!windows||payload.bindings[0].globalCode==='Quote'))
            await click('[data-hotkey-remove]');await close()
        } finally {
            await releaseConflict(conflict)
            await evalJs(`window.__pseed({ttrpg_hotkeys:{version:3,bindings:[]}})`)
            await reload()
        }
    },
}
