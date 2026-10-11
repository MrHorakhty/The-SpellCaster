// Shared in-page expressions for the E2E suites.
//
// Every entrypoint used to carry its own copy of the localStorage seed, the
// page-level helper injection, the audio spy and the capture/restore logic.
// These were identical across platforms (and had to stay identical or the
// suites diverged), so they live here once. Keep them in sync with the app:

// ---- localStorage seed (characters / environment / groups / themes) ---------

export const SEED = `(() => {
  const snd = (id,name,type,color,opts) => ({ id, name, type, icon:'Icon.png', files:[{name:name.toLowerCase().replace(/\\s+/g,'_')+'.mp3', displayName:name+'.mp3'}], color, duration:0, randomPlay:false, ...opts });
  localStorage.setItem('ttrpg_characters', JSON.stringify([
    { id:'c1', name:'Human Paladin', sounds:[
      snd('s1','Smite','Holy','#ff0000',{loop:true, fadeIn:0.5, fadeOut:0.5, glowEnabled:true, glowProminence:0.7, files:[{name:'smite.mp3',displayName:'Smite.mp3'}]}),
      snd('s2','Shield Bash','Melee','#3b82f6',{loop:false, randomPlay:true, files:[{name:'shield1.mp3',displayName:'Shield1.mp3'},{name:'shield2.mp3',displayName:'Shield2.mp3'}]}),
      snd('s3','Healing Light','Magic','#22c55e',{loop:true, fadeIn:1.5, files:[{name:'heal.mp3',displayName:'Heal.mp3'}]})
    ]},
    { id:'c2', name:'Elf Sorcerer', sounds:[] }
  ]));
  localStorage.setItem('ttrpg_environment', JSON.stringify([
    { id:'e1', category:'Dungeon', sounds:[snd('e1s1','Dripping','Ambient','#84cc16',{loop:true, files:[{name:'drip.mp3',displayName:'Drip.mp3'}]})] },
    { id:'e2', category:'Forest', sounds:[] }
  ]));
  localStorage.setItem('ttrpg_groups', JSON.stringify([
    { id:'g1', name:'Tavern Pack', mode:'environment', categories:[{id:'gc1', category:'Ambience', sounds:[snd('gs1','Tavern Song','Music','#d97706',{loop:true, files:[{name:'tavern.mp3',displayName:'Tavern.mp3'}]})]}], characters:[] },
    { id:'g2', name:'Hero Pack', mode:'characters', categories:[], characters:[{id:'gch1', name:'Fighter', sounds:[]}] }
  ]));
  localStorage.setItem('ttrpg_themes', JSON.stringify([]));
  localStorage.setItem('ttrpg_data_version', '3');
  localStorage.removeItem('backgroundSettings');
  localStorage.removeItem('boxSize');
  for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k.startsWith('sound_file_')) localStorage.removeItem(k);}
  return 'seeded';
})();`;

// ---- window-level helper injection (wiped by every reload) ------------------

export const PAGE_HELPERS = `(() => {
  window.__clickText = (t) => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===t); if(!b) return 'NO:'+t; b.click(); return 'OK'; };
  window.__findText = (t) => [...document.querySelectorAll('button')].find(x=>x.textContent.trim()===t);
  window.__setInput = (name, val) => { const el=document.querySelector('input[name="'+name+'"]'); if(!el) return 'NO:'+name; const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(el, val); el.dispatchEvent(new Event('input',{bubbles:true})); return 'OK'; };
  window.__uploadFile = (sel, path) => (async () => { const doc=await (globalThis.__cdp||{}).eval?null:null; return 'need cdp'; })();
  return 'ok';
})();`;

// ---- audio spy: record every element that is asked to play -------------------

export const INSTRUMENT_AUDIO = `(() => {
  window.__e2eAudio = [];
  const op = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function(...a){ window.__e2eAudio.push(this); return op.apply(this, a); };
  return 'instrumented';
})()`;

// ---- SAVE_RESTORE capture / restore -----------------------------------------

export const CAPTURE_LS = `(() => { const o = {}; for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); o[k]=localStorage.getItem(k);} return JSON.stringify(o); })()`;

export function restoreLs(captured) {
  const o = JSON.stringify(captured ?? {});
  return `(() => { const o = ${o}; localStorage.clear(); for (const k in o) localStorage.setItem(k, o[k]); return 'restored'; })()`;
}

// ---- modal submit ------------------------------------------------------------

// Submit the bg-lime-600 submit button whose text matches (and is not disabled).
export function submitModalExpr(btnText) {
  return `(() => {
    const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='${btnText}' && x.type==='submit' && /bg-lime-600/.test(x.className));
    if(!b) return 'NO_SUBMIT:${btnText}';
    if(b.disabled) return 'DISABLED';
    b.click();
    return 'OK';
  })()`;
}

// ---- storage key inventory (P14 in the volume spec) ---------------------------

export const KNOWN_KEYS = [
  'backgroundSettings', 'boxSize', 'ttrpg_characters', 'ttrpg_characters_icon',
  'ttrpg_data_version', 'ttrpg_environment', 'ttrpg_environment_icon',
  'ttrpg_groups', 'ttrpg_themes', 'localStorageMigrationCompleted'
];