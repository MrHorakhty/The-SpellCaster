import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cropToSquare, decodeIcon, drawIconCrop, prepareIcon } from './iconPrep.js'

export default function IconPrepDialog({ file, soundName = 'Your sound', onCancel, onConfirm }) {
    const [mode, setMode] = useState('')
    const [source, setSource] = useState(null)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [cropFailure, setCropFailure] = useState('')
    const [crop, setCrop] = useState({ x: 0, y: 0, scale: 1 })
    const root = useRef(null)
    const cropSurface = useRef(null)
    const cropPreview = useRef(null)
    const prepared = useRef(null)
    const previewUrls = useRef(new Set())
    const alive = useRef(true)
    const pointers = useRef(new Map())
    const accepting = useRef(false)

    useEffect(() => {
        alive.current = true
        const previous = document.activeElement
        root.current?.focus()
        const url = URL.createObjectURL(file)
        let cancelled = false
        decodeIcon(file).then(image => {
            if (!cancelled) setSource({ url, image, width: image.naturalWidth, height: image.naturalHeight })
        }).catch(err => { if (!cancelled) { setResult(null); setError(err.message) } })
        return () => {
            cancelled = true
            alive.current = false
            URL.revokeObjectURL(url)
            for (const previewUrl of previewUrls.current) URL.revokeObjectURL(previewUrl)
            previewUrls.current.clear()
            prepared.current = null
            previous?.focus()
        }
    }, [file])

    useEffect(() => {
        if (mode !== 'silhouette' || !source) return
        let cancelled = false
        // Cache this operation too: going Back and returning must not rerun
        // segmentation/PNG encoding. Original bytes need no processing at all.
        if (!prepared.current || prepared.current.file !== file) {
            const pending = prepareIcon(file, 'silhouette').then(blob => {
                if (!alive.current || prepared.current?.promise !== pending) return null
                const url = URL.createObjectURL(blob)
                previewUrls.current.add(url)
                return { blob, url, mode: 'silhouette' }
            })
            prepared.current = { file, promise: pending }
        }
        prepared.current.promise.then(value => {
            if (!cancelled && value) setResult(value)
        }).catch(err => {
            prepared.current = null
            if (!cancelled) setError(err.message)
        })
        return () => { cancelled = true }
    }, [file, source, mode])

    useLayoutEffect(() => {
        if (mode !== 'crop' || !source || !cropPreview.current) return
        try {
            // Draw from the already decoded image before paint. No PNG encode,
            // object URL churn or unmounted placeholder during a gesture.
            drawIconCrop(source.image, cropPreview.current, crop)
            setCropFailure('')
        } catch (err) { setCropFailure(err.message) }
    }, [source, mode, crop])

    const ready = mode === 'crop' ? source && !cropFailure : mode === 'original' ? !!source : result?.mode === mode
    const previewUrl = mode === 'original' ? source?.url : result?.mode === mode ? result.url : ''
    const updateCrop = updater => { setError(''); setCrop(updater) }
    const zoom = factor => updateCrop(prev => ({ ...prev, scale: Math.min(8, Math.max(1, prev.scale * factor)) }))
    useEffect(() => {
        const surface = cropSurface.current
        if (!surface) return
        // React's delegated wheel listener is passive in Chromium. A local
        // non-passive handler prevents zoom gestures scrolling the dialog.
        const wheel = e => {
            e.preventDefault()
            if (!accepting.current) setCrop(prev => ({ ...prev,
                scale: Math.min(8, Math.max(1, prev.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1))) }))
        }
        surface.addEventListener('wheel', wheel, { passive: false })
        return () => surface.removeEventListener('wheel', wheel)
    }, [mode, source])
    const pan = (dx, dy, viewport) => updateCrop(prev => {
        const side = Math.min(source.width, source.height) / prev.scale
        const norm = (delta, dimension) => dimension > side ? delta * side / viewport * 2 / (dimension - side) : 0
        return { ...prev, x: Math.min(1, Math.max(-1, prev.x - norm(dx, source.width))),
            y: Math.min(1, Math.max(-1, prev.y - norm(dy, source.height))) }
    })
    const move = e => {
        if (accepting.current || !pointers.current.has(e.pointerId)) return
        const before = [...pointers.current.values()]
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const after = [...pointers.current.values()]
        const center = points => ({ x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
            y: points.reduce((sum, p) => sum + p.y, 0) / points.length })
        const oldCenter = center(before), newCenter = center(after)
        pan(newCenter.x - oldCenter.x, newCenter.y - oldCenter.y, e.currentTarget.clientWidth * 0.8)
        if (after.length === 2) {
            const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
            const oldDistance = distance(before)
            if (oldDistance) zoom(distance(after) / oldDistance)
        }
    }
    const trapKeys = e => {
        e.stopPropagation()
        if (e.key === 'Escape') { e.preventDefault(); if (!accepting.current) onCancel(); return }
        if (e.key !== 'Tab') return
        const targets = [...root.current.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')]
        const first = targets[0], last = targets[targets.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === root.current)) {
            e.preventDefault(); last?.focus()
        } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === root.current)) {
            e.preventDefault(); first?.focus()
        }
    }
    const accept = async () => {
        if (!ready || accepting.current) return
        accepting.current = true
        setError('')
        setBusy(true)
        try {
            const name = mode === 'original' ? file.name : `${file.name.replace(/\.[^.]*$/, '') || 'icon'}.png`
            const blob = mode === 'crop' ? await prepareIcon(file, 'crop', crop) : mode === 'original' ? file : result.blob
            await onConfirm(blob, name)
        } catch (err) {
            if (alive.current) { setError(err.message || 'Could not store the icon.'); setBusy(false) }
        } finally { accepting.current = false }
    }
    const rect = source ? cropToSquare(source.width, source.height, crop) : null
    const button = 'px-4 py-2 rounded-lg bg-dark-600 disabled:opacity-50'
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3" style={{ zIndex: 100 }}
            onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div ref={root} role="dialog" aria-modal="true" aria-labelledby="icon-prep-title" tabIndex={-1}
                data-icon-prep className="bg-dark-800 text-slate-100 rounded-xl p-5 w-full max-w-lg max-h-[90dvh] overflow-y-auto"
                onKeyDown={trapKeys}>
                <h2 id="icon-prep-title" className="text-xl font-semibold mb-3">Prepare icon</h2>
                {!mode ? <div className="space-y-3">
                    <p>Choose how to use this image. Nothing is stored until you confirm.</p>
                    {[
                        ['original', 'Use as is', 'Keep the original file and colours untouched.'],
                        ['crop', 'Crop to square', 'Pan and zoom to choose a square crop. Keep the original colours.'],
                        ['silhouette', 'Make silhouette', 'Remove a plain background and make a grey shape for tinting. Colour and photo detail will be lost.'],
                    ].map(([value, title, description]) => <button type="button" key={value} data-icon-mode={value}
                        disabled={!source || !!error} onClick={() => { setError(''); setMode(value) }}
                        className="block w-full text-left border border-dark-600 rounded-lg p-3 disabled:opacity-50">
                        <strong>{title}</strong><span className="block text-sm text-slate-300">{description}</span>
                        {value === 'silhouette' && <><span className="flex gap-3 my-2">
                            <img src="/assets/icon-prep/light-example.jpg" alt="Dark coral line art on white" className="w-20 h-20 object-contain" />
                            <img src="/assets/icon-prep/dark-example.jpg" alt="Light ghost line art on black" className="w-20 h-20 object-contain" />
                        </span><span className="text-sm">It will work best with images like these.</span></>}
                    </button>)}
                </div> : <div className="space-y-3">
                    <p>{mode === 'original' ? 'Use as is' : mode === 'crop' ? 'Crop to square' : 'Make silhouette'}</p>
                    {mode === 'crop' && source && <>
                        <div ref={cropSurface} data-icon-crop role="group" aria-label="Square crop. Arrow keys pan; plus and minus zoom."
                            tabIndex={0} className="relative overflow-hidden border border-dark-600 rounded-lg mx-auto"
                            style={{ width: 320, maxWidth: '100%', aspectRatio: '1', touchAction: 'none', background: '#222' }}
                            onPointerDown={e => {
                                if (e.button !== 0 || busy) return
                                e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId)
                                pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
                            }} onPointerMove={move}
                            onPointerUp={e => pointers.current.delete(e.pointerId)}
                            onPointerCancel={e => pointers.current.delete(e.pointerId)}
                            onLostPointerCapture={e => pointers.current.delete(e.pointerId)}
                            onKeyDown={e => {
                                if (busy) return
                                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(e.key)) {
                                    e.preventDefault(); e.stopPropagation()
                                    if (e.key === '+' || e.key === '=') zoom(1.1)
                                    else if (e.key === '-') zoom(1 / 1.1)
                                    else pan(e.key === 'ArrowLeft' ? 8 : e.key === 'ArrowRight' ? -8 : 0,
                                        e.key === 'ArrowUp' ? 8 : e.key === 'ArrowDown' ? -8 : 0, e.currentTarget.clientWidth * 0.8)
                                }
                            }}>
                            <img src={source.url} alt="Image inside square crop" draggable={false} className="absolute select-none pointer-events-none"
                                style={{ maxWidth: 'none', width: `${source.width / rect.side * 80}%`,
                                    height: `${source.height / rect.side * 80}%`, left: `${10 - rect.x / rect.side * 80}%`, top: `${10 - rect.y / rect.side * 80}%` }} />
                            <div aria-hidden="true" className="absolute pointer-events-none border-2 border-lime-500"
                                style={{ inset: '10%', boxShadow: '0 0 0 999px rgba(0,0,0,0.65)' }} />
                        </div>
                        <label className="flex items-center justify-between text-sm" htmlFor="icon-crop-zoom">
                            <span>Zoom</span><output data-icon-zoom-value>{Math.round(crop.scale * 100)}%</output>
                        </label>
                        <div className="flex items-center justify-center gap-2">
                            <button type="button" className={button} disabled={busy} onClick={() => zoom(1 / 1.1)} aria-label="Zoom out">−</button>
                            <input id="icon-crop-zoom" data-icon-zoom type="range" min="100" max="800" step="1"
                                aria-label="Crop zoom" aria-valuetext={`${Math.round(crop.scale * 100)} percent`}
                                className="flex-1 min-w-0 accent-lime-500" disabled={busy} value={Math.round(crop.scale * 100)}
                                onChange={e => { const scale = Number(e.target.value) / 100; updateCrop(prev => ({ ...prev, scale })) }} />
                            <button type="button" className={button} disabled={busy} onClick={() => zoom(1.1)} aria-label="Zoom in">+</button>
                        </div>
                        <p className="text-sm text-slate-300">Drag to pan. Dimmed areas will be cropped out. Scroll, pinch or use the slider to zoom. Keyboard: arrows, + and −.</p>
                    </>}
                    {mode === 'crop' ? <div className="rounded-lg bg-dark-900 p-3" data-icon-card-preview>
                        <p className="text-xs text-slate-400 mb-2">Icon at sound-card size</p>
                        <div className="flex items-center gap-3">
                            <canvas ref={cropPreview} data-icon-result width="256" height="256" aria-label="Cropped icon at sound-card size"
                                className="w-12 h-12 shrink-0" />
                            <span className="min-w-0 truncate">{soundName || 'Your sound'}</span>
                        </div>
                    </div> : <div className="p-3 rounded-lg flex items-center justify-center" style={{ height: 152,
                        background: 'repeating-conic-gradient(#444 0% 25%, #292929 0% 50%) 0 / 16px 16px' }}>
                        {previewUrl ? <img data-icon-result src={previewUrl} alt="Prepared icon preview" className="w-32 h-32 object-contain" />
                            : <p role="status">Preparing preview…</p>}
                    </div>}
                    <p className="text-sm">Confirm puts this icon in the sound editor. Save the sound to replace its current icon.
                        {' '}The original upload is not kept for undo; keep your source file.</p>
                    <button type="button" data-icon-back className={button} disabled={busy} onClick={() => { setMode(''); setError(''); setResult(null) }}>Back to choices</button>
                </div>}
                {(error || cropFailure) && <p role="alert" className="my-3 text-red-300">{error || cropFailure}</p>}
                <div className="flex justify-end gap-2 mt-4">
                    <button type="button" data-icon-cancel className={button} disabled={busy} onClick={onCancel}>Cancel</button>
                    {mode && <button type="button" data-icon-confirm className={`${button} bg-lime-700`} disabled={!ready || busy} onClick={accept}>
                        {busy ? 'Storing…' : 'Confirm icon'}
                    </button>}
                </div>
            </div>
        </div>
    )
}
