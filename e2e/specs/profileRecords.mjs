import { awaitBoard } from '../lib/page.mjs'

export const profileRecords = {
  title: 'SUITE PR: RECORD HISTORY AND MERGE',
  async run(ctx) {
    const { evalJs, reload, sleep, driver, isTauri } = ctx
    const log = (category, label, result) => ctx.log(category, label, result ? 'PASS' : 'FAIL')
    const stored = async () => evalJs(`JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')) || '[]')`)
    await evalJs(`window.__pseed({ttrpg_characters:[{id:'pr_live',name:'History Test',sounds:[{id:'pr_sound',name:'Tracked Sound',files:[{name:'Longbow_4.mp3'}],volume:0.5},{id:'pr_gone',syncId:'deleted-child',updatedAt:10,deletedAt:10}]},{id:'pr_deleted',syncId:'old-deletion',updatedAt:10,deletedAt:10}],ttrpg_environment:[],ttrpg_groups:[],ttrpg_data_version:'3'})`)
    await reload(); await awaitBoard(ctx, { min: 1 })
    let records = await stored()
    const original = records.find(r => r.id === 'pr_live')
    log('RECORD', 'PR1: legacy records acquire stable identity at epoch', !!original?.syncId && original.updatedAt === 0 && original.sounds[0].updatedAt === 0)
    log('RECORD', 'PR2: saved deletion markers survive loading', records.some(r => r.syncId === 'old-deletion' && r.deletedAt === 10))
    log('RECORD', 'PR3: deleted sounds stay out of the rendered board', await evalJs(`document.querySelectorAll('[data-sound-card]').length === 1 && !document.querySelector('[data-sound-id="pr_gone"]')`))
    await driver.enterEditMode()
    await evalJs(`(() => {const e=document.querySelector('[data-sound-volume="pr_sound"]'); if(!e)return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'0.3'); e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));return true})()`)
    await sleep(400)
    records = await stored()
    const edited = records.find(r => r.id === 'pr_live')
    log('RECORD', 'PR4: live sound edit stamps the saved record', edited.sounds[0].updatedAt > 0 && edited.sounds[0].syncId === original.sounds[0].syncId)
    await reload(); await awaitBoard(ctx, { min: 1 })
    records = await stored()
    log('RECORD', 'PR5: reload preserves edit timestamp and stable identity', records.find(r => r.id === 'pr_live').sounds[0].updatedAt === edited.sounds[0].updatedAt)
    await driver.enterEditMode(); await ctx.deleteCharacter('History Test'); await sleep(350)
    records = await stored()
    const deleted = records.find(r => r.syncId === original.syncId)
    log('RECORD', 'PR6: UI deletion saves a marker without audio payload', deleted?.deletedAt > 0 && !deleted.sounds)
    await reload(); await sleep(400)
    log('RECORD', 'PR7: deleted sound stays absent after reload', !await evalJs(`!!document.querySelector('[data-sound-id="pr_sound"]')`))
    await ctx.closeDrawer(); await evalJs(`document.querySelector('button[title="Settings"]')?.click()`); await sleep(250)
    log('RECORD', 'PR8: merge import availability follows native export/import support', await evalJs(`!!document.querySelector('[data-import-mode="merge"]')`) === isTauri)
    await evalJs(`window.__clickText('Close Settings')`)
    if (isTauri) {
      const merged = await evalJs(`(async () => {
        const B=await import('/src/profileBundle.js');const P=await import('/src/profileStorage.js');
        const profileId=P.getActiveProfileId();
        const records=JSON.parse(P.readProfileValue(profileId,'ttrpg_characters'));
        const saved=await B.exportBundle({profileId,data:{characters:records,environmentSounds:[],groups:[]},settings:{}});
        const old={id:'pr_live',syncId:${JSON.stringify(original.syncId)},updatedAt:0,name:'History Test',sounds:[{id:'pr_sound',name:'Tracked Sound',files:[{name:'Longbow_4.mp3'}]}]};
        const incoming=await B.exportBundle({profileId,data:{characters:[old,{id:'pr_new',name:'Imported New',sounds:[]}],environmentSounds:[],groups:[]},settings:{}});
        const before=P.readProfileValue(profileId,'ttrpg_characters');
        const preview=B.previewMergeBundle(incoming.bytes,profileId);
        const unchanged=before===P.readProfileValue(profileId,'ttrpg_characters');
        const normalize=(key,list)=>list;
        await B.importBundle(incoming.bytes,{mode:'merge',targetProfileId:profileId,normalize,dataVersion:'3',setActive:false});
        const result=JSON.parse(P.readProfileValue(profileId,'ttrpg_characters'));
        return {preview,unchanged,format:saved.manifest.formatVersion,marker:result.find(r=>r.syncId===old.syncId),added:result.some(r=>r.id==='pr_new')};
      })()`)
      log('RECORD', 'PR9: new bundles require tombstone-aware readers', merged?.format === 3)
      log('RECORD', 'PR10: older import cannot resurrect a UI deletion', merged?.marker?.deletedAt > 0 && !merged.marker.sounds)
      log('RECORD', 'PR11: merge retains unrelated imported records', merged?.added)
      log('RECORD', 'PR12: preview reports additions without changing the board', merged?.unchanged && merged?.preview?.added === 1)
      await reload(); await sleep(350)
    }
  },
}
