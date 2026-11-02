import assert from 'node:assert/strict'
import { indexedDB, IDBObjectStore } from 'fake-indexeddb'
import { webUploads, migrateWebUploads } from '../src/webUploads.js'
import { defaultBlobStore, exportBundle, importBundle } from '../src/profileBundle.js'
import { profileUploadFileCount, removeProfileUploads, ensureProfileStore, readProfileIndex, readProfileValue, writeProfileValue, deleteProfile } from '../src/profileStorage.js'

const values = new Map()
globalThis.window = {
    indexedDB,
    localStorage: {
        get length() { return values.size },
        key: i => [...values.keys()][i] ?? null,
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
    },
}
let passed = 0
const check = (name, condition) => { assert.ok(condition, name); passed++; console.log(`PASS ${name}`) }
const bytes = blob => blob?.arrayBuffer().then(buffer => [...new Uint8Array(buffer)])
const seed = (profile, name, value = 'data:audio/wav;base64,AQIDBA==') => values.set(`profile:${profile}:sound_file_${name}`, value)
const originalPut = IDBObjectStore.prototype.put

try {
    await webUploads.write('a', 'first', new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }))
    check('new writes do not consume localStorage', values.size === 0)
    check('binary bytes round trip', JSON.stringify(await bytes(await webUploads.read('a', 'first'))) === '[1,2,3]')
    check('MIME type is retained', (await webUploads.read('a', 'first')).type === 'audio/wav')
    check('missing file returns null', await webUploads.read('a', 'absent') === null)
    check('same name in another profile is absent', await webUploads.read('b', 'first') === null)
    await webUploads.write('b', 'first', new Blob(['other']))
    check('profiles own independent copies', (await webUploads.read('b', 'first')).size === 5)

    seed('a', 'legacy')
    check('list includes legacy and indexed files', (await webUploads.list('a')).sort().join() === 'first,legacy')
    check('migration reports copied count', await migrateWebUploads('a') === 1)
    check('legacy removed after successful verification', !values.has('profile:a:sound_file_legacy'))
    check('migrated bytes are exact', JSON.stringify(await bytes(await webUploads.read('a', 'legacy'))) === '[1,2,3,4]')
    check('migration preserves original MIME', (await webUploads.read('a', 'legacy')).type === 'audio/wav')
    check('migration is idempotent', await migrateWebUploads('a') === 0)

    seed('a', 'failure')
    IDBObjectStore.prototype.put = function () { throw new DOMException('Full', 'QuotaExceededError') }
    await assert.rejects(migrateWebUploads('a'), /Full/); passed++
    check('quota failure retains original', values.has('profile:a:sound_file_failure'))
    check('quota failure leaves original playable and exportable', JSON.stringify(await bytes(await webUploads.read('a', 'failure'))) === '[1,2,3,4]')
    IDBObjectStore.prototype.put = originalPut
    check('failed queue can retry migration', await migrateWebUploads('a') === 1)

    seed('a', 'aborted')
    IDBObjectStore.prototype.put = function (...args) {
        const request = originalPut.apply(this, args)
        request.addEventListener('success', () => this.transaction.abort())
        return request
    }
    await assert.rejects(migrateWebUploads('a'), /abort/i); passed++
    check('request success followed by transaction abort retains original', values.has('profile:a:sound_file_aborted'))
    IDBObjectStore.prototype.put = originalPut
    check('aborted migration can retry', await migrateWebUploads('a') === 1)

    await webUploads.write('a', 'conflict', new Blob(['newer']))
    seed('a', 'conflict')
    await assert.rejects(migrateWebUploads('a'), /different copies/); passed++
    check('conflicting legacy data retained', values.has('profile:a:sound_file_conflict'))
    values.delete('profile:a:sound_file_conflict')
    check('conflicting indexed data retained', await (await webUploads.read('a', 'conflict')).text() === 'newer')

    seed('a', 'verify-failure')
    IDBObjectStore.prototype.put = function (record, ...args) {
        return originalPut.call(this, { ...record, blob: new Blob(['wrong'], { type: record.blob.type }) }, ...args)
    }
    await assert.rejects(migrateWebUploads('a'), /verify/); passed++
    check('failed read-back verification retains original', values.has('profile:a:sound_file_verify-failure'))
    IDBObjectStore.prototype.put = originalPut
    await webUploads.remove('a', 'verify-failure')

    seed('a', 'malformed', 'not-a-data-url')
    await assert.rejects(migrateWebUploads('a'), /base64/); passed++
    check('malformed original retained', values.has('profile:a:sound_file_malformed'))
    await webUploads.remove('a', 'malformed')
    check('explicit removal clears legacy original', !values.has('profile:a:sound_file_malformed'))

    const big = new Uint8Array(7 * 1024 * 1024).fill(37)
    await webUploads.write('a', 'large', new Blob([big]))
    const restored = new Uint8Array(await (await webUploads.read('a', 'large')).arrayBuffer())
    check('7 MiB upload bypasses old localStorage capacity', restored.length === big.length && restored.every(byte => byte === 37))
    check('large upload adds no base64 metadata', values.size === 0)

    await defaultBlobStore('a').write('engine', new Uint8Array([0, 128, 255]))
    check('bundle engine writes to IndexedDB', JSON.stringify([...await defaultBlobStore('a').read('engine')]) === '[0,128,255]')
    check('bundle engine has existing file', await defaultBlobStore('a').has('engine'))
    check('bundle engine has rejects absent file', !await defaultBlobStore('a').has('missing'))
    check('bundle engine list sees indexed file', (await defaultBlobStore('a').list()).includes('engine'))
    await webUploads.remove('a', 'first')
    check('file deletion removes indexed bytes', await webUploads.read('a', 'first') === null)
    check('file deletion leaves other profile intact', await (await webUploads.read('b', 'first')).text() === 'other')
    seed('a', 'last-legacy')
    const count = (await webUploads.list('a')).length
    check('profile deletion count includes both storage forms', await profileUploadFileCount('a') === count)
    check('missing profile has no upload count', await profileUploadFileCount(null) === 0)
    check('profile cleanup reports removed files', (await removeProfileUploads('a')).removed === count)
    check('profile cleanup removes both storage forms', (await webUploads.list('a')).length === 0)
    check('profile cleanup preserves other profile', (await webUploads.list('b')).join() === 'first')
    await assert.rejects(webUploads.write('', 'bad', new Blob()), /profile/); passed++
    const sourceId = ensureProfileStore('3')
    const board = [{ id: 'transfer-character', name: 'Transfer Test', sounds: [{ id: 'transfer-sound', name: 'Transfer Audio', files: [{ name: 'transfer.wav', storedName: 'transfer.wav' }] }] }]
    writeProfileValue(sourceId, 'ttrpg_characters', JSON.stringify(board))
    await defaultBlobStore(sourceId).write('transfer.wav', new Uint8Array([1, 2, 3]))
    const bundle = await exportBundle({ profileId: sourceId, data: { characters: board, environmentSounds: [], groups: [] }, settings: {} })
    const beforeIndex = JSON.stringify(readProfileIndex())
    const beforeBoard = readProfileValue(sourceId, 'ttrpg_characters')
    IDBObjectStore.prototype.put = function () { throw new DOMException('Import full', 'QuotaExceededError') }
    await assert.rejects(importBundle(bundle.bytes, { mode: 'new', normalize: (_key, data) => data, dataVersion: '3' }), error => error.code === 'write-failed'); passed++
    check('failed browser import rolls back the new profile entry', JSON.stringify(readProfileIndex()) === beforeIndex)
    check('failed browser import leaves source board byte-identical', readProfileValue(sourceId, 'ttrpg_characters') === beforeBoard)
    await assert.rejects(importBundle(bundle.bytes, { mode: 'merge', targetProfileId: sourceId, normalize: (_key, data) => data, dataVersion: '3' }), error => error.code === 'write-failed'); passed++
    check('failed browser merge leaves current board byte-identical', readProfileValue(sourceId, 'ttrpg_characters') === beforeBoard)
    IDBObjectStore.prototype.put = originalPut
    const retried = await importBundle(bundle.bytes, { mode: 'new', normalize: (_key, data) => data, dataVersion: '3', setActive: false })
    check('browser import succeeds after storage is available again', retried.imported === 1 && readProfileIndex().profiles.length === 2)
    const importedBoard = JSON.parse(readProfileValue(retried.profileId, 'ttrpg_characters'))
    const importedName = importedBoard[0].sounds[0].files[0].storedName
    check('browser import retry installs exact bytes in target storage', JSON.stringify([...await defaultBlobStore(retried.profileId).read(importedName)]) === '[1,2,3]')
    deleteProfile(retried.profileId)
    await removeProfileUploads(retried.profileId)
    await removeProfileUploads(sourceId)
    console.log(`webUploads: ${passed}/${passed} PASS`)
} finally {
    IDBObjectStore.prototype.put = originalPut
    await webUploads.clear('a')
    await webUploads.clear('b')
}
