import { PAGE_HELPERS, awaitBoard } from '../lib/page.mjs'

export const transfers = {
    title: 'SUITE TR: TRANSFER CREATION, BULK CONTAINERS AND CROSS-DRAG',
    async run(ctx) {
        const { evalJs, sleep, reload, driver } = ctx
        const log = (category, label, value, detail = '') => ctx.log(category, label, value ? 'PASS' : 'FAIL', detail)
        const character = { containerType: 'character', containerId: 'tr_c1', groupId: null }
        const rain = { containerType: 'environment', containerId: 'Rain', groupId: null }
        const rogue = { containerType: 'groupCharacter', containerId: 'tr_rogue', groupId: 'tr_party' }
        const groupCharacters = { containerType: 'groupCharacterList', groupId: 'tr_party' }
        const groupCategories = { containerType: 'groupCategoryList', groupId: 'tr_weather' }
        const fixture = () => {
            const sound = (id, name) => ({ id, name, icon: '', type: 'Test', volume: 0.3, loop: true,
                files: [{ name: 'Longbow_4.mp3', displayName: 'Bow', fadeIn: 0.2, fadeOut: 0.1, playUntil: 0 }] })
            return { ttrpg_characters: [{ id: 'tr_c1', name: 'Transfer Mage', icon: '⚡', sounds: [sound('tr_s1', 'Fire'), sound('tr_s2', 'Ice')] }],
                ttrpg_environment: [{ category: 'Rain', icon: '☔', sounds: [sound('tr_s3', 'Breeze')] }],
                ttrpg_groups: [{ id: 'tr_weather', name: 'Transfer Weather', icon: '☁️', mode: 'environment', categories: [{ category: 'Cloud', sounds: [sound('tr_s4', 'Thunder')] }], characters: [], sounds: [] },
                    { id: 'tr_party', name: 'Transfer Party', mode: 'characters', characters: [{ id: 'tr_rogue', name: 'Transfer Rogue', sounds: [] }], categories: [], sounds: [] }],
                ttrpg_data_version: '3' }
        }
        const seed = async (data = fixture(), min = 1) => {
            await evalJs(`window.__pseed(${JSON.stringify(data)})`)
            await reload(); await awaitBoard(ctx, { min }); await evalJs(PAGE_HELPERS)
            await driver.enterEditMode()
        }
        const board = async () => evalJs(`({characters:window.__liveBoard(JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]')),
            environment:window.__liveBoard(JSON.parse(localStorage.getItem(window.__pk('ttrpg_environment'))||'[]')),
            groups:window.__liveBoard(JSON.parse(localStorage.getItem(window.__pk('ttrpg_groups'))||'[]'))})`)
        const input = async (name, value) => { await evalJs(`window.__setInput(${JSON.stringify(name)},${JSON.stringify(value)})`); await sleep(80) }
        const select = async (name, value) => { await evalJs(`(() => {const e=document.querySelector('select[name="'+${JSON.stringify(name)}+'"]');if(!e)return false;e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); await sleep(120) }
        const click = async selector => { const result = await evalJs(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return false;e.click();return true})()`); await sleep(180); return result }
        const openSound = async () => click('[data-sound-layout="tr_s1"] button[title="Move or Copy Sound"]')
        const openContainer = async () => click('[data-transfer-current]')
        const action = async (ref, mode) => {
            const result = await evalJs(`(() => {const wanted=${JSON.stringify(ref)};const row=[...document.querySelectorAll('[data-transfer-target]')].find(e=>{const r=JSON.parse(e.dataset.transferTarget);return Object.entries(wanted).every(([k,v])=>(r[k]??null)===(v??null))});const b=row?.querySelector('[data-transfer-action="${mode}"]');if(!b)return false;b.click();return true})()`)
            await sleep(300); return result
        }
        const create = async (kind, name, mode, groupName = '') => {
            await click('[data-transfer-create]'); await select('destinationKind', kind)
            await input('destinationName', name)
            if (groupName) await input('destinationGroupName', groupName)
            await click(`[data-transfer-create-action="${mode}"]`); await sleep(200)
        }
        const close = () => click('[aria-label="Close transfer picker"]')

        await seed()
        await openSound(); const before = await board()
        await click('[data-transfer-create]'); await input('destinationName', 'Not created')
        await click('[data-transfer-create-form] button') // Cancel creation.
        log('TRANSFER', 'TR1: cancelling destination creation leaves the board unchanged', JSON.stringify(await board()) === JSON.stringify(before))
        await create('environment', 'Rain', 'move')
        log('TRANSFER', 'TR2: duplicate destination refuses without moving or overwriting', await evalJs(`!!document.querySelector('[data-transfer-dialog] [role="alert"]')`) && JSON.stringify(await board()) === JSON.stringify(before))
        await input('destinationName', 'New storm'); await click('[data-transfer-create-action="move"]')
        let state = await board()
        log('TRANSFER', 'TR3: create-and-move preserves sound identity and settings', state.characters[0].sounds.length === 1 && state.environment.find(e => e.category === 'New storm')?.sounds[0]?.id === 'tr_s1' && state.environment.find(e => e.category === 'New storm')?.sounds[0]?.volume === 0.3)
        await reload(); await evalJs(PAGE_HELPERS)
        state = await board()
        log('TRANSFER', 'TR4: created destination and moved sound survive reload', state.environment.find(e => e.category === 'New storm')?.sounds[0]?.files[0]?.name === 'Longbow_4.mp3' && !state.characters[0].sounds.some(s => s.id === 'tr_s1'))

        await seed(); await openContainer(); await action(rain, 'copy')
        state = await board()
        log('TRANSFER', 'TR5: bulk copy appends in order with fresh sound ids and shared file references', state.environment[0].sounds.map(s => s.name).join('|') === 'Breeze|Fire (copy)|Ice (copy)' && state.environment[0].sounds.slice(1).every(s => !['tr_s1', 'tr_s2'].includes(s.id) && s.files[0].name === 'Longbow_4.mp3' && s.volume === 0.3) && state.characters[0].sounds.length === 2)
        await openContainer(); await action(rain, 'copy'); state = await board()
        log('TRANSFER', 'TR6: repeated bulk copy uses unique destination names', state.environment[0].sounds.slice(-2).map(s => s.name).join('|') === 'Fire (copy 2)|Ice (copy 2)')
        await openContainer(); await action(rogue, 'move'); state = await board()
        log('TRANSFER', 'TR7: bulk move empties the source wrapper without deleting it', state.characters[0].name === 'Transfer Mage' && state.characters[0].icon === '⚡' && state.characters[0].sounds.length === 0 && state.groups[1].characters[0].sounds.map(s => s.id).join('|') === 'tr_s1|tr_s2')

        await seed(); await openContainer(); await click('[data-transfer-scope="container"]'); await action(groupCharacters, 'move')
        state = await board(); let moved = state.groups[1].characters.find(c => c.id === 'tr_c1')
        log('TRANSFER', 'TR8: whole character move preserves wrapper id name icon and sounds', state.characters.length === 0 && moved?.name === 'Transfer Mage' && moved?.icon === '⚡' && moved?.sounds.map(s => s.id).join('|') === 'tr_s1|tr_s2')
        log('TRANSFER', 'TR9: a moved wrapper stays visible at its new location', await evalJs(`!!document.querySelector('[data-sound-id="tr_s1"]') && [...document.querySelectorAll('h2')].some(e=>e.textContent.includes('Transfer Mage'))`))
        const history = await evalJs(`JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters'))||'[]')`)
        await reload(); await evalJs(PAGE_HELPERS); state = await board(); moved = state.groups[1].characters.find(c => c.id === 'tr_c1')
        log('TRANSFER', 'TR10: reload retains destination and source deletion history without duplicate sync identity', !!history.find(c => c.id === 'tr_c1')?.deletedAt && moved?.sounds[0]?.id === 'tr_s1' && history.find(c => c.id === 'tr_c1')?.syncId !== moved?.syncId)
        await seed(); await openContainer(); await click('[data-transfer-scope="container"]'); await action(groupCharacters, 'copy'); state = await board()
        const copied = state.groups[1].characters.find(c => c.name === 'Transfer Mage (copy)')
        log('TRANSFER', 'TR11: whole character copy keeps settings but mints wrapper and child ids', state.characters.length === 1 && copied?.id !== 'tr_c1' && copied?.icon === '⚡' && copied?.sounds.length === 2 && copied.sounds.every(s => !['tr_s1', 'tr_s2'].includes(s.id) && s.volume === 0.3))

        await seed(); await ctx.navigateTo('Transfer Weather'); await click('[data-transfer-group]'); await click('[data-transfer-scope="container"]')
        await action({ containerType: 'groupList', groupId: null }, 'copy'); state = await board()
        const duplicate = state.groups.find(g => g.name === 'Transfer Weather (copy)')
        log('TRANSFER', 'TR12: top-level group duplication preserves hierarchy with new identities', duplicate?.id !== 'tr_weather' && duplicate?.icon === '☁️' && duplicate?.categories[0]?.category === 'Cloud' && duplicate?.categories[0]?.sounds[0]?.id !== 'tr_s4')
        await click('[data-transfer-group]'); await action(rain, 'move'); state = await board()
        log('TRANSFER', 'TR13: group bulk move keeps its member wrappers and moves their sounds', state.groups.find(g => g.id === 'tr_weather')?.categories[0]?.sounds.length === 0 && state.environment[0].sounds.some(s => s.id === 'tr_s4'))
        await seed(); await openSound(); await create('groupCategory', 'Fresh category', 'copy'); state = await board()
        log('TRANSFER', 'TR14: create category inside an existing group and copy there', state.groups[0].categories.find(c => c.category === 'Fresh category')?.sounds[0]?.name === 'Fire (copy)' && state.characters[0].sounds.length === 2)
        await seed(); await openSound(); await create('newGroupCharacter', 'New member', 'move', 'New party'); state = await board()
        const party = state.groups.find(g => g.name === 'New party')
        log('TRANSFER', 'TR15: create group plus first member and transfer together', party?.mode === 'characters' && party?.characters.length === 1 && party.characters[0].name === 'New member' && party.characters[0].sounds[0].id === 'tr_s1' && state.characters[0].sounds.length === 1)
        await seed(); await openContainer(); await click('[data-transfer-scope="container"]'); await click('[data-transfer-create]'); await input('destinationName', 'Moved party'); await click('[data-transfer-create-action="move"]'); state = await board()
        log('TRANSFER', 'TR16: whole wrapper can create its destination group without an extra empty member', state.characters.length === 0 && state.groups.at(-1).name === 'Moved party' && state.groups.at(-1).characters.length === 1 && state.groups.at(-1).characters[0].id === 'tr_c1')

        await seed()
        const mobile = await evalJs(`innerWidth<768`)
        const from = await driver.centeredCard('[data-sound-card][data-sound-id="tr_s1"]')
        const end = { x: await evalJs('innerWidth-24'), y: 65 }
        let reachable = false
        await driver.dragFromTo(from, end, { beforeDrop: async () => {
            await sleep(250)
            const point = await evalJs(`(() => {const e=[...document.querySelectorAll('[data-transfer-drop-tray] [data-transfer-drop]')].find(e=>JSON.parse(e.dataset.transferDrop).containerType==='environment');const r=e?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.top+r.height/2}:null})()`)
            if (!point) return
            reachable = true; end.x = point.x; end.y = point.y
            if (mobile) await ctx.cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1, radiusX: 2, radiusY: 2, force: 1 }] })
            else await ctx.cdpInput('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point, button: 'left', buttons: 1 })
            await sleep(180)
        } })
        await sleep(400); state = await board()
        log('TRANSFER', 'TR17: real pointer drag reaches another container through the destination tray', reachable && state.environment[0].sounds.some(s => s.id === 'tr_s1') && !state.characters[0].sounds.some(s => s.id === 'tr_s1'), mobile ? 'touch' : 'mouse')
        log('TRANSFER', 'TR18: cross-container drop cleans every drag artifact', await evalJs(`!document.querySelector('[data-sound-drag-ghost],[data-sound-drag-placeholder],[data-transfer-drop-tray],[data-transfer-hover]')`))
        await seed(); const cancelBefore = await board()
        await driver.dragFromTo(await driver.centeredCard('[data-sound-card][data-sound-id="tr_s1"]'), { x: 10, y: 10 }, { beforeDrop: async () => {
            await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`)
        } })
        await sleep(250)
        log('TRANSFER', 'TR19: cancelling cross-container drag leaves board and destination tray clean', JSON.stringify(await board()) === JSON.stringify(cancelBefore) && await evalJs(`!document.querySelector('[data-transfer-drop-tray],[data-sound-drag-ghost]')`))
        await openSound(); await click('[data-transfer-create]'); await input('destinationName', 'Cancelled by Escape')
        await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(200)
        log('TRANSFER', 'TR20: Escape cancels staged creation without changing the board', JSON.stringify(await board()) === JSON.stringify(cancelBefore) && await evalJs(`!document.querySelector('[data-transfer-dialog]')`))

        const conflict = fixture(); conflict.ttrpg_groups[0].categories.push({ category: 'Rain', sounds: [] })
        await seed(conflict); await click('[data-tab="environment"]'); await openContainer(); await click('[data-transfer-scope="container"]'); await action(groupCategories, 'move'); state = await board()
        const movedCategory = state.groups[0].categories.find(c => c.category === 'Rain (moved)')
        log('TRANSFER', 'TR21: whole category move resolves a destination name collision without overwriting', state.environment.length === 0 && state.groups[0].categories.some(c => c.category === 'Rain') && movedCategory?.sounds[0]?.id === 'tr_s3')
        log('TRANSFER', 'TR22: category icon and sound settings survive the collision rename', movedCategory?.icon === '☔' && movedCategory?.sounds[0]?.volume === 0.3)
        const empty = fixture(); empty.ttrpg_characters[0].sounds = []
        await seed(empty, 0); await openContainer(); await action(rain, 'move')
        const emptyWarning = await evalJs(`document.querySelector('[data-transfer-dialog] [role="alert"]')?.textContent.includes('no sounds')`)
        await click('[data-transfer-scope="container"]'); await action(groupCharacters, 'copy'); state = await board()
        log('TRANSFER', 'TR23: empty bulk source explains the alternative and whole empty container can copy', emptyWarning && state.groups[1].characters.find(c => c.name === 'Transfer Mage (copy)')?.sounds.length === 0)

        await seed()
        if (!mobile) {
            await click('[data-split-view]')
            for (const ref of [character, rain]) await evalJs(`(() => {const r=${JSON.stringify(ref)};const e=[...document.querySelectorAll('button[data-transfer-drop]')].find(e=>{const v=JSON.parse(e.dataset.transferDrop);return v.containerType===r.containerType&&v.containerId===r.containerId});e?.click()})()`)
            await sleep(200)
            const panelControls = await evalJs(`document.querySelectorAll('[data-transfer-current]').length===2`)
            const a = await driver.centeredCard('[data-sound-card][data-sound-id="tr_s1"]')
            const b = await driver.centeredCard('[data-sound-card][data-sound-id="tr_s3"]')
            await driver.dragFromTo(a, b); await sleep(300); state = await board()
            log('TRANSFER', 'TR24: split panels expose container actions and accept a direct cross-panel drop', panelControls && state.environment[0].sounds.some(s => s.id === 'tr_s1') && !state.characters[0].sounds.some(s => s.id === 'tr_s1'))
            await click('[data-split-view]')
        } else log('TRANSFER', 'TR24: mobile keeps split-view controls absent', await evalJs(`!document.querySelector('[data-split-view]')`))
        const duplicateIds = fixture(); duplicateIds.ttrpg_groups[1].characters[0].id = 'tr_c1'
        await seed(duplicateIds); await openContainer(); await click('[data-transfer-scope="container"]'); await action(groupCharacters, 'move'); state = await board()
        const members = state.groups[1].characters, relocated = members.find(c => c.name === 'Transfer Mage')
        log('TRANSFER', 'TR25: wrapper id collision preserves both members and every moved sound id', members.length === 2 && new Set(members.map(c => c.id)).size === 2 && members.find(c => c.name === 'Transfer Rogue')?.id === 'tr_c1' && relocated?.sounds.map(s => s.id).join('|') === 'tr_s1|tr_s2' && await evalJs(`!!document.querySelector('[data-sound-id="tr_s1"]')`))
        await driver.exitEditMode()
    },
}
