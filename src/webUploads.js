// Browser uploads live outside localStorage. Board metadata stays synchronous;
// audio and icons are Blobs in IndexedDB, scoped by [profileId, storedName].
import { profileScopedKey, readProfileValue, keysWithPrefix } from './profileStorage.js'

const DATABASE = 'spellcaster-uploads'
const STORE = 'files'
let connection
const pending = new Map()

function openDatabase() {
    if (!connection) {
        connection = new Promise((resolve, reject) => {
            const request = window.indexedDB.open(DATABASE, 1)
            let blocked = false
            request.onupgradeneeded = () => {
                const files = request.result.createObjectStore(STORE, { keyPath: ['profileId', 'storedName'] })
                files.createIndex('profileId', 'profileId')
            }
            request.onerror = () => reject(request.error)
            request.onblocked = () => {
                blocked = true
                reject(new Error('Browser upload storage is blocked. Close other SpellCaster tabs and try again.'))
            }
            request.onsuccess = () => {
                const db = request.result
                if (blocked) { db.close(); return }
                db.onversionchange = () => { db.close(); connection = null }
                resolve(db)
            }
        }).catch(error => { connection = null; throw error })
    }
    return connection
}

async function transact(mode, action) {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        let result
        transaction.oncomplete = () => resolve(result)
        transaction.onabort = () => reject(transaction.error || new Error('Browser upload transaction was aborted.'))
        transaction.onerror = () => { /* onabort reports the final transaction failure */ }
        try {
            const request = action(transaction.objectStore(STORE))
            if (request) request.onsuccess = () => { result = request.result }
        } catch (error) {
            transaction.abort()
            reject(error)
        }
    })
}

// Serialize migration, writes and deletion, including across tabs where Web
// Locks is available. A failed operation must not poison the retry queue.
function exclusive(profileId, action) {
    if (!profileId) return Promise.reject(new Error('An upload needs a profile.'))
    const run = () => window.navigator?.locks
        ? window.navigator.locks.request(`spellcaster-uploads:${profileId}`, action)
        : action()
    const next = (pending.get(profileId) || Promise.resolve()).catch(() => {}).then(run)
    pending.set(profileId, next)
    return next.finally(() => { if (pending.get(profileId) === next) pending.delete(profileId) })
}

function legacyBlob(value) {
    const comma = value.indexOf(',')
    if (comma < 0 || !value.slice(0, comma).endsWith(';base64')) throw new Error('Stored upload is not a base64 data URL.')
    const binary = atob(value.slice(comma + 1))
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    return new Blob([bytes], { type: value.slice(5, comma).split(';')[0] })
}

async function sameBlob(a, b) {
    if (a.size !== b.size || a.type !== b.type) return false
    const x = new Uint8Array(await a.arrayBuffer())
    const y = new Uint8Array(await b.arrayBuffer())
    return x.every((byte, index) => byte === y[index])
}

async function readRecord(profileId, storedName) {
    return (await transact('readonly', files => files.get([profileId, storedName])))?.blob || null
}

async function migrateOne(profileId, storedName) {
    const key = `sound_file_${storedName}`
    const value = readProfileValue(profileId, key)
    if (value === null) return
    const blob = legacyBlob(value)
    const existing = await readRecord(profileId, storedName)
    if (existing && !await sameBlob(existing, blob)) {
        throw new Error(`Two different copies of "${storedName}" exist. The original browser upload was retained.`)
    }
    if (!existing) await transact('readwrite', files => files.put({ profileId, storedName, blob }))
    const verified = await readRecord(profileId, storedName)
    if (!verified || !await sameBlob(verified, blob)) throw new Error(`Could not verify the migrated upload "${storedName}". Original retained.`)
    // Do not remove a value another tab changed while the copy was in flight.
    if (readProfileValue(profileId, key) === value) window.localStorage.removeItem(profileScopedKey(profileId, key))
    else throw new Error('An upload changed in another tab during migration. Please retry.')
}

function legacyNames(profileId) {
    const prefix = profileScopedKey(profileId, 'sound_file_')
    return keysWithPrefix(prefix).map(key => key.slice(prefix.length))
}

export function migrateWebUploads(profileId) {
    return exclusive(profileId, async () => {
        let migrated = 0
        for (const name of legacyNames(profileId)) { await migrateOne(profileId, name); migrated++ }
        return migrated
    })
}

export const webUploads = {
    read(profileId, storedName) {
        return exclusive(profileId, async () => {
            try {
                await migrateOne(profileId, storedName)
            } catch (error) {
                // A failed migration must not silence an otherwise intact old
                // upload. Startup reports the migration error; playback and
                // export can still read the retained original for recovery.
                const legacy = readProfileValue(profileId, `sound_file_${storedName}`)
                if (legacy === null) throw error
                console.warn('Reading retained original after upload migration failed:', error)
                return legacyBlob(legacy)
            }
            return readRecord(profileId, storedName)
        })
    },
    write(profileId, storedName, blob) {
        return exclusive(profileId, async () => {
            await migrateOne(profileId, storedName)
            await transact('readwrite', files => files.put({ profileId, storedName, blob }))
        })
    },
    list(profileId) {
        return exclusive(profileId, async () => {
            const records = await transact('readonly', files => files.index('profileId').getAllKeys(profileId))
            return [...new Set([...records.map(key => key[1]), ...legacyNames(profileId)])]
        })
    },
    remove(profileId, storedName) {
        return exclusive(profileId, async () => {
            await transact('readwrite', files => files.delete([profileId, storedName]))
            window.localStorage.removeItem(profileScopedKey(profileId, `sound_file_${storedName}`))
        })
    },
    clear(profileId) {
        return exclusive(profileId, async () => {
            let removed = 0
            await transact('readwrite', files => {
                const request = files.index('profileId').openCursor(profileId)
                request.onsuccess = () => {
                    const cursor = request.result
                    if (cursor) { cursor.delete(); removed++; cursor.continue() }
                }
            })
            for (const name of legacyNames(profileId)) {
                window.localStorage.removeItem(profileScopedKey(profileId, `sound_file_${name}`))
                removed++
            }
            return { removed }
        })
    },
}
