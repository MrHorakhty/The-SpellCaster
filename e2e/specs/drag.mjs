// Shared drag-to-reorder spec (Suite X, X1-X14).
//
// Closes the mobile "drag reorder (X)" gap. The reorder is pointer-event based
// (App.jsx: onPointerDown arms a dragRef, the first move past 4px promotes to
// document-level pointermove/pointerup listeners, and pointerup commits
// moveSound), so the identical code path serves a mouse and a finger - a CDP
// touch drag synthesizes pointer events with pointerType 'touch'. Only the
// delivery differs, and that lives in driver.dragFromTo.
//
// Edit mode is mandatory: outside it the press arms the press-and-hold PRIME
// instead of a drag (the two share onPointerDown), and the drag branch bails on
// !editMode.
//
// Self-contained four-sound fixture, so the spec does not depend on an earlier
// suite having added a sound. Names match the old inline suite exactly so a
// regression stays comparable against an older log.

import { PAGE_HELPERS, awaitBoard } from '../lib/page.mjs';

export const dragReorder = {
  title: 'SUITE X: DRAG REORDER',
  async run(ctx) {
    const { log, evalJs, sleep, reload, driver } = ctx;

    const seedX = `(() => {
      localStorage.removeItem('spellcaster_reorder_animation');
      const snd = (id, name, color, opts) => Object.assign({
        id, name, type: 'Test', icon: 'Icon.png',
        files: [{ name: name.toLowerCase().replace(/\\s+/g, '_') + '.mp3', displayName: name + '.mp3' }],
        color, duration: 0, randomPlay: false, loop: false
      }, opts || {});
      localStorage.setItem(window.__pk('ttrpg_characters'), JSON.stringify([
        { id: 'c1', name: 'Human Paladin', sounds: [
          snd('x1', 'Smite', '#ff0000', { loop: true }),
          snd('x2', 'Shield Bash', '#3b82f6'),
          snd('x3', 'Healing Light', '#22c55e', { loop: true }),
          snd('x4', 'Divine Light', '#a855f7')
        ] }
      ]));
      localStorage.setItem(window.__pk('ttrpg_environment'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_groups'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_themes'), JSON.stringify([]));
      localStorage.setItem(window.__pk('ttrpg_data_version'), '3');
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('profile:'+window.__pid()+':sound_file_')) localStorage.removeItem(k); }
      return 'seeded';
    })()`;

    const order = `(() => {
      const c = JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')) || '[]');
      const pal = c.find(x => x.name === 'Human Paladin');
      return pal?.sounds?.map(s => s.name) || [];
    })()`;

    // A reload returns the app to the default Human Paladin board, so the four
    // cards are on screen whatever the previous suite navigated to.
    await evalJs(seedX);
    await reload();
    await awaitBoard(ctx, { min: 1, seed: seedX });
    await evalJs(PAGE_HELPERS);

    await driver.enterEditMode();
    // App preference must control motion even when the device requests reduction.
    await ctx.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    const instrument = `(() => {
      window.__reorderAnimations=[];
      window.__reorderOriginalAnimate=Element.prototype.animate;
      Element.prototype.animate=function(frames,options){
        if(this.matches('[data-sound-layout]')) window.__reorderAnimations.push({id:this.dataset.soundLayout,frames,options});
        return window.__reorderOriginalAnimate.call(this,frames,options);
      };
    })()`;
    await evalJs(instrument);
    const orderBefore = await evalJs(order);
    log('DRAG', 'X1: order before drag', orderBefore?.length === 4 ? 'PASS' : 'FAIL', JSON.stringify(orderBefore));

    // Center both cards and take FRESH coordinates: CDP input is viewport
    // relative, and the mobile board is a 2-column grid where a later card can
    // start off-screen.
    const src = await driver.centeredCard('[data-sound-card][data-sound-id="x4"]');
    const tgt = await driver.centeredCard('[data-sound-card][data-sound-id="x1"]');

    if (src && tgt) {
      let live=null;
      await driver.dragFromTo(src, tgt, { beforeDrop: async () => {
        await sleep(120);
        live=await evalJs(`(() => {
          const ghost=document.querySelector('[data-sound-drag-ghost]');
          const matrix=ghost ? new DOMMatrix(getComputedStyle(ghost).transform) : null;
          return { dx:matrix?.m41,dy:matrix?.m42,placeholder:!!document.querySelector('[data-sound-drag-placeholder]'),
            shifted:[...document.querySelectorAll('[data-sound-layout]')].some(el=>getComputedStyle(el).transform!=='none'),
            order:JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')))[0].sounds.map(s=>s.name) };
        })()`);
      }});
      log('DRAG','X6: lifted sound follows pointer and pushes neighbors before release',live?.placeholder && live?.shifted && Math.abs(live.dx-(tgt.x-src.x))<3 && Math.abs(live.dy-(tgt.y-src.y))<3 ? 'PASS':'FAIL',JSON.stringify(live));
      log('DRAG','X7: preview leaves stored order untouched until drop',JSON.stringify(live?.order)===JSON.stringify(orderBefore) ? 'PASS':'FAIL',JSON.stringify(live?.order));
      await sleep(600);
      const orderAfter = await evalJs(order);
      const reordered = orderAfter?.[0] === 'Divine Light' || JSON.stringify(orderAfter) !== JSON.stringify(orderBefore);
      log('DRAG', 'X2: order changed', reordered ? 'PASS' : 'FAIL',
        'before=' + JSON.stringify(orderBefore) + ' after=' + JSON.stringify(orderAfter));
      const animations=await evalJs(`({count:window.__reorderAnimations.length,valid:window.__reorderAnimations.every(a=>a.options.duration===240 && a.frames[0].transform.startsWith('translate(')),settled:[...document.querySelectorAll('[data-sound-layout]')].every(el=>getComputedStyle(el).transform==='none')})`);
      log('DRAG','X3: app-default animation runs despite device reduced motion and settles',animations?.count>0 && animations?.valid && animations?.settled ? 'PASS':'FAIL',JSON.stringify(animations));
    } else {
      log('DRAG', 'X2: drag skipped', JSON.stringify({ src, tgt }));
    }

    try {
      await evalJs(`document.querySelector('button[title="Settings"]')?.click()`);
      await sleep(200);
      const defaultOn=await evalJs(`document.querySelector('[data-reorder-animation]')?.getAttribute('aria-checked')`);
      await evalJs(`document.querySelector('[data-reorder-animation]')?.click(); document.querySelector('[data-settings-close]')?.click();`);
      await sleep(200);
      await evalJs(`window.__reorderAnimations=[]`);
      const beforeOff=await evalJs(order);
      const from=await driver.centeredCard('[data-sound-card][data-sound-id="x1"]');
      const to=await driver.centeredCard('[data-sound-card][data-sound-id="x4"]');
      let offPreview=false;
      await driver.dragFromTo(from,to,{beforeDrop:async()=>{offPreview=await evalJs(`!!document.querySelector('[data-sound-drag-ghost]') && [...document.querySelectorAll('[data-sound-layout]')].some(el=>getComputedStyle(el).transform!=='none')`);}});
      await sleep(600);
      const afterOff=await evalJs(order);
      const count=await evalJs(`window.__reorderAnimations.length`);
      log('DRAG','X4: Settings toggle disables animation while retaining reorder',defaultOn==='true' && JSON.stringify(beforeOff)!==JSON.stringify(afterOff) && count===0 && offPreview ? 'PASS':'FAIL',JSON.stringify({defaultOn,count,beforeOff,afterOff}));
      await reload();
      await evalJs(PAGE_HELPERS);
      await driver.enterEditMode();
      await evalJs(`document.querySelector('button[title="Settings"]')?.click()`);
      await sleep(200);
      const persistedOff=await evalJs(`document.querySelector('[data-reorder-animation]')?.getAttribute('aria-checked')==='false' && localStorage.getItem('spellcaster_reorder_animation')==='false'`);
      await evalJs(`document.querySelector('[data-reorder-animation]')?.click(); document.querySelector('[data-settings-close]')?.click();`);
      await sleep(200);
      await evalJs(instrument);
      const enabledFrom=await driver.centeredCard('[data-sound-card][data-sound-id="x4"]');
      const enabledTo=await driver.centeredCard('[data-sound-card][data-sound-id="x1"]');
      await driver.dragFromTo(enabledFrom,enabledTo);
      await sleep(600);
      const enabled=await evalJs(`window.__reorderAnimations.length>0 && localStorage.getItem('spellcaster_reorder_animation')==='true'`);
      log('DRAG','X5: animation preference survives reload and can be re-enabled',persistedOff && enabled ? 'PASS':'FAIL',JSON.stringify({persistedOff,enabled}));
      const switchUi=await evalJs(`(() => {document.querySelector('button[title="Settings"]')?.click();return true})()`);
      await sleep(200);
      const switchLabel=await evalJs(`document.querySelector('[data-reorder-animation]')?.getAttribute('role')==='switch' && document.querySelector('[data-reorder-animation]')?.getAttribute('aria-label')==='Animate Sound Reordering'`);
      log('DRAG','X8: animation preference is a labelled toggle switch',switchUi && switchLabel ? 'PASS':'FAIL');
      await evalJs(`document.querySelector('[data-settings-close]')?.click()`);
      await sleep(200);
      const clean=`!document.querySelector('[data-sound-drag-ghost], [data-sound-drag-placeholder]') && [...document.querySelectorAll('[data-sound-layout]')].every(el=>el.style.visibility!== 'hidden' && getComputedStyle(el).transform==='none')`;
      const cancellations={};
      for(const kind of ['escape','cancel','blur']) {
        const before=await evalJs(order);
        const a=await driver.centeredCard('[data-sound-card][data-sound-id="x4"]');
        const b=await driver.centeredCard('[data-sound-card][data-sound-id="x1"]');
        await driver.dragFromTo(a,b,{beforeDrop:async()=>{
          await evalJs(`(() => {
            const kind=${JSON.stringify(kind)};
            if(kind==='escape') document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
            else if(kind==='blur') window.dispatchEvent(new Event('blur'));
            else {const p=Number(document.querySelector('[data-sound-drag-ghost]')?.dataset.pointerId);document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:p,bubbles:true}));}
          })()`);
        }});
        await sleep(300);
        cancellations[kind]=JSON.stringify(await evalJs(order))===JSON.stringify(before) && await evalJs(clean);
      }
      log('DRAG','X9: Escape restores original order and removes drag artifacts',cancellations.escape ? 'PASS':'FAIL');
      log('DRAG','X10: pointer cancellation restores original order and removes drag artifacts',cancellations.cancel ? 'PASS':'FAIL');
      log('DRAG','X11: focus loss restores original order and removes drag artifacts',cancellations.blur ? 'PASS':'FAIL');
      const beforeOutside=await evalJs(order);
      const outsideFrom=await driver.centeredCard('[data-sound-card][data-sound-id="x4"]');
      await driver.dragFromTo(outsideFrom,{x:5,y:5});
      await sleep(300);
      log('DRAG','X12: releasing outside the source board cancels the move',JSON.stringify(await evalJs(order))===JSON.stringify(beforeOutside) && await evalJs(clean) ? 'PASS':'FAIL');
      await evalJs(`document.querySelector('[data-sound-layout]')?.parentElement.style.setProperty('width','330px')`);
      const wrappedBefore=await evalJs(order);
      const wrappedFrom=await driver.centeredCard('[data-sound-card][data-sound-id="x3"]');
      const wrappedTo=await driver.centeredCard('[data-sound-card][data-sound-id="x4"]');
      let wrappedLive=false;
      await driver.dragFromTo(wrappedFrom,wrappedTo,{beforeDrop:async()=>{wrappedLive=await evalJs(`!!document.querySelector('[data-sound-drag-ghost]') && [...document.querySelectorAll('[data-sound-layout]')].some(el=>Math.abs(new DOMMatrix(getComputedStyle(el).transform).m42)>1)`);}});
      await sleep(600);
      log('DRAG','X13: live reorder works across wrapped rows',wrappedLive && JSON.stringify(await evalJs(order))!==JSON.stringify(wrappedBefore) && await evalJs(clean) ? 'PASS':'FAIL',JSON.stringify({wrappedLive}));
      await evalJs(`document.querySelector('[data-sound-layout]')?.parentElement.style.removeProperty('width')`);
      await evalJs(`(() => {
        const c=JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')));
        const base=c[0].sounds[0];c[0].sounds=Array.from({length:30},(_,i)=>({...base,id:'scroll_'+i,name:'Scroll '+i}));
        localStorage.setItem(window.__pk('ttrpg_characters'),JSON.stringify(c));
      })()`);
      await reload();await evalJs(PAGE_HELPERS);await driver.enterEditMode();await evalJs(instrument);
      const scrolling=await evalJs(`(() => {
        let el=document.querySelector('[data-sound-layout]')?.parentElement;
        while(el && !(/auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight>el.clientHeight))el=el.parentElement;
        window.__dragScrollContainer=el;
        const r=el?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.bottom-10,before:el.scrollTop}:null;
      })()`);
      const scrollFrom=await driver.centeredCard('[data-sound-card][data-sound-id="scroll_0"]');
      let advanced=false;
      if(scrolling) await driver.dragFromTo(scrollFrom,scrolling,{beforeDrop:async()=>{
        await sleep(400);advanced=await evalJs(`window.__dragScrollContainer.scrollTop>${scrolling.before}+20`);
      }});
      await sleep(600);
      log('DRAG','X14: dragging near the board edge scrolls the long list',advanced && await evalJs(clean) ? 'PASS':'FAIL',JSON.stringify({scrolling,advanced}));


    } finally {
      await ctx.cdp('Emulation.setEmulatedMedia',{features:[]});
      await evalJs(`Element.prototype.animate=window.__reorderOriginalAnimate; delete window.__reorderOriginalAnimate; delete window.__reorderAnimations;`);
    }
    await driver.exitEditMode();
  }
};
