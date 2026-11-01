import { useMemo, useState } from 'react'
import { liveRecords, reconcileRecords } from './profileRecords.js'

export function useProfileRecords(initialize) {
    const [records, setRecords] = useState(initialize)
    const visible = useMemo(() => liveRecords(records), [records])
    const setVisible = next => {
        // Capture event time outside the updater; React may invoke updaters twice.
        const now = Date.now()
        setRecords(previous => reconcileRecords(previous,
            typeof next === 'function' ? next(liveRecords(previous)) : next, { now }))
    }
    return [visible, setVisible, records]
}
