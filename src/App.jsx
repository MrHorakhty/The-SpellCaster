import { useState, useEffect, useRef } from 'react'
import { User, Music, Volume2, Settings, Flame, Zap, Shield, Sword, Heart, Cloud, CloudRain, Droplets, X, Plus, Edit, Trash2, Folder, Sparkles, Square, ZoomIn, Shuffle, Infinity as InfinityIcon, Info, Maximize } from 'lucide-react'
import data from './data.json'

// Environment detection
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined

// Safe JSON parse that returns a fallback instead of crashing on corrupt data
const safeParse = (value, fallback) => {
    try {
        const parsed = JSON.parse(value)
        return parsed === null || parsed === undefined ? fallback : parsed
    } catch {
        return fallback
    }
}

// Version for persisted app data. Bump to force a reset to the bundled defaults.
const DATA_VERSION = '3'

// Read an array from localStorage only if it matches the current data version.
// Stale or corrupt data is backed up and dropped in favour of the bundled defaults.
const readStoredData = (key, fallback) => {
    try {
        if (localStorage.getItem('ttrpg_data_version') !== DATA_VERSION) {
            const stale = localStorage.getItem(key)
            if (stale) {
                localStorage.setItem(`${key}_old`, stale)
            }
            localStorage.removeItem(key)
            localStorage.setItem('ttrpg_data_version', DATA_VERSION)
            return fallback
        }
        const raw = localStorage.getItem(key)
        if (raw === null) {
            return fallback
        }
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : fallback
    } catch {
        return fallback
    }
}

// Function to get appropriate icon component based on sound type
const getSoundIcon = (soundType) => {
    const iconMap = {
        'Acid': Droplets,
        'Cold': Cloud,
        'Fire': Flame,
        'Lightning': Zap,
        'Healing': Heart,
        'Divine': Zap,
        'Protection': Shield,
        'Stealth': Cloud,
        'Weapon': Sword,
        'Nature': Cloud,
        'Music': Music,
        'Ambience': Cloud,
        'Weather': CloudRain,
        'Test': Settings
    }

    return iconMap[soundType] || Music // Default to Music icon
}

// Function to convert hex color to hue-rotate degrees for CSS filters
const getHueRotateFromColor = (color) => {
    if (color === 'transparent') {
        color = '#84cc16'
    }

    const hex = color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16) / 255
    const g = parseInt(hex.substring(2, 4), 16) / 255
    const b = parseInt(hex.substring(4, 6), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0

    if (max === min) {
        h = 0
    } else {
        const d = max - min
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break
            case g: h = (b - r) / d + 2; break
            case b: h = (r - g) / d + 4; break
        }
        h /= 6
    }

    const hueDegrees = Math.round(h * 360)
    return hueDegrees
}

// Convert an RGB color to HSL. Returns [h, s, l] where h in [0, 1), s and l in [0, 1]
const rgbToHsl = (r, g, b) => {
    r /= 255
    g /= 255
    b /= 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    const l = (max + min) / 2

    if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break
            case g: h = (b - r) / d + 2; break
            case b: h = (r - g) / d + 4; break
        }
        h /= 6
    }

    return [h, s, l]
}

// Convert HSL back to RGB. Returns [r, g, b] each in [0, 255]
const hslToRgb = (h, s, l) => {
    let r, g, b

    if (s === 0) {
        r = g = b = l
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1
            if (t > 1) t -= 1
            if (t < 1 / 6) return p + (q - p) * 6 * t
            if (t < 1 / 2) return q
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
            return p
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        r = hue2rgb(p, q, h + 1 / 3)
        g = hue2rgb(p, q, h)
        b = hue2rgb(p, q, h - 1 / 3)
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

// Recolor an image to a target color using canvas: preserve each pixel's
// lightness (shading) but replace its hue/saturation with the target color.
const recolorImageToColor = (imageUrl, color, brightness) => {
    return new Promise((resolve) => {
        const img = new Image()

        img.onload = () => {
            try {
                // SVGs sometimes report a 0x0 intrinsic size; fall back to a
                // default canvas size so they can still be recolored.
                const defaultSize = 128
                const drawWidth = img.naturalWidth || defaultSize
                const drawHeight = img.naturalHeight || defaultSize

                const canvas = document.createElement('canvas')
                canvas.width = drawWidth
                canvas.height = drawHeight
                const ctx = canvas.getContext('2d')

                ctx.drawImage(img, 0, 0, drawWidth, drawHeight)
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
                const data = imageData.data

                const targetHex = color === 'transparent' ? '#84cc16' : color
                const rTarget = parseInt(targetHex.substring(1, 3), 16)
                const gTarget = parseInt(targetHex.substring(3, 5), 16)
                const bTarget = parseInt(targetHex.substring(5, 7), 16)
                const [targetH, targetS] = rgbToHsl(rTarget, gTarget, bTarget)
                const brightnessFactor = brightness || 1

                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] === 0) continue

                    const [, , l] = rgbToHsl(data[i], data[i + 1], data[i + 2])
                    const scaledL = Math.min(1, Math.max(0, l * brightnessFactor))
                    const [r2, g2, b2] = hslToRgb(targetH, targetS, scaledL)

                    data[i] = r2
                    data[i + 1] = g2
                    data[i + 2] = b2
                }

                ctx.putImageData(imageData, 0, 0)
                resolve(canvas.toDataURL('image/png'))
            } catch (error) {
                console.error('Failed to recolor image:', error)
                resolve(null)
            }
        }

        img.onerror = () => {
            resolve(null)
        }

        img.src = imageUrl
    })
}

const getGlowEffectStyle = (sound) => {
    if (!sound.glowEnabled) {
        return {}
    }

    const intensity = (sound.glowProminence || 0.5) * 0.5 + 0.1
    const spread = (sound.glowProminence || 0.5) * 10 + 5

    return {
        boxShadow: `0 0 ${spread}px ${intensity}px ${sound.color}, 0 4px 6px -1px rgba(0, 0, 0, 0.3)`
    }
}

// Fade the audio volume up to targetVolume over fadeInSeconds
const applyFadeIn = (audio, targetVolume, fadeInSeconds) => {
    if (!audio) {
        return
    }

    if (audio.fadeInInterval) {
        clearInterval(audio.fadeInInterval)
        audio.fadeInInterval = null
    }

    if (!fadeInSeconds || fadeInSeconds <= 0) {
        audio.volume = targetVolume
        return
    }

    const steps = 20
    const stepDuration = (fadeInSeconds * 1000) / steps
    let step = 0
    audio.volume = 0

    audio.fadeInInterval = setInterval(() => {
        step++
        audio.volume = Math.min(targetVolume, targetVolume * step / steps)

        if (step >= steps) {
            audio.volume = targetVolume
            clearInterval(audio.fadeInInterval)
            audio.fadeInInterval = null
        }
    }, stepDuration)
}

// Fade the audio volume down to 0 over fadeOutSeconds, then call onComplete
const fadeOutAudio = (audio, fadeOutSeconds, onComplete) => {
    if (!audio) {
        if (onComplete) onComplete()
        return
    }

    if (audio.fadeInInterval) {
        clearInterval(audio.fadeInInterval)
        audio.fadeInInterval = null
    }

    if (audio.fadeOutInterval) {
        clearInterval(audio.fadeOutInterval)
        audio.fadeOutInterval = null
    }

    const startVolume = audio.volume || 0

    if (!fadeOutSeconds || fadeOutSeconds <= 0) {
        audio.volume = 0
        if (onComplete) onComplete()
        return
    }

    const steps = 20
    const stepDuration = (fadeOutSeconds * 1000) / steps
    let step = 0

    audio.fadeOutInterval = setInterval(() => {
        step++

        if (step >= steps) {
            audio.volume = 0
            clearInterval(audio.fadeOutInterval)
            audio.fadeOutInterval = null
            if (onComplete) onComplete()
        } else {
            audio.volume = Math.max(0, startVolume - startVolume * step / steps)
        }
    }, stepDuration)
}

function App() {
    // Load from localStorage first, fallback to data.json if it's a first-time load
    const [characters, setCharacters] = useState(() => {
        return readStoredData('ttrpg_characters', data.characters)
    })

    const [environmentSounds, setEnvironmentSounds] = useState(() => {
        return readStoredData('ttrpg_environment', data.environmentSounds)
    })
    const [tabType, setTabType] = useState('characters')
    const [activeTab, setActiveTab] = useState('')
    const [editMode, setEditMode] = useState(false)
    const [draggedSoundId, setDraggedSoundId] = useState(null)
    const [dragOverSoundId, setDragOverSoundId] = useState(null)
    const [audioEnabled, setAudioEnabled] = useState(false)
    const [masterVolume, setMasterVolume] = useState(1.0)
    const [soundInstances, setSoundInstances] = useState({})
    const audioElementsRef = useRef(new Map())
    const objectUrlCache = useRef(new Map())

    // Stop all audio and clear resources when the app unmounts (prevents
    // ghost sounds / leaked timers on hot reload in dev).
    useEffect(() => {
        return () => {
            audioElementsRef.current.forEach((audio) => {
                if (!audio) {
                    return
                }
                audio.stopped = true
                if (audio.fadeInInterval) {
                    clearInterval(audio.fadeInInterval)
                }
                if (audio.fadeOutInterval) {
                    clearInterval(audio.fadeOutInterval)
                }
                if (audio.timer) {
                    clearTimeout(audio.timer)
                }
                audio.volume = 0
                audio.pause()
                audio.currentTime = 0
                try {
                    audio.removeAttribute('src')
                    audio.load()
                } catch {
                    // Ignore cleanup errors
                }
            })
            audioElementsRef.current.clear()
        }
    }, [])

    // Split View & Active Tab States
    const [isSplitView, setIsSplitView] = useState(false)
    const [activeCharacterId, setActiveCharacterId] = useState('')
    const [activeEnvironmentId, setActiveEnvironmentId] = useState('')

    // Modal and form states
    const [showSoundModal, setShowSoundModal] = useState(false)
    const [editingSound, setEditingSound] = useState(null)
    const [soundFormData, setSoundFormData] = useState({
        name: '',
        type: '',
        icon: '',
        file: '',
        files: [],
        randomPlay: false,
        color: '#84cc16',
        brightness: 1,
        duration: 0,
        fadeIn: 0,
        fadeOut: 0,
        loop: false,
        glowEnabled: false,
        glowProminence: 0.5
    })
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [itemToDelete, setItemToDelete] = useState(null)
    const [deleteType, setDeleteType] = useState('')

    // Character management states
    const [showCharacterModal, setShowCharacterModal] = useState(false)
    const [editingCharacter, setEditingCharacter] = useState(null)
    const [characterFormData, setCharacterFormData] = useState({
        name: ''
    })

    // Category management states
    const [showCategoryModal, setShowCategoryModal] = useState(false)
    const [editingCategory, setEditingCategory] = useState(null)
    const [categoryFormData, setCategoryFormData] = useState({
        name: ''
    })

    // Settings modal state
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const [showAboutModal, setShowAboutModal] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [backgroundSettings, setBackgroundSettings] = useState({
        type: 'color',
        theme: 'default',
        color: '#84cc16',
        imageFile: null,
        imagePreview: '',
        isLoading: false
    })
    const backgroundSettingsRef = useRef(backgroundSettings)

    // Box size state with localStorage persistence
    const [boxSize, setBoxSize] = useState(() => {
        const savedBoxSize = localStorage.getItem('boxSize')
        return savedBoxSize ? parseFloat(savedBoxSize) : 1.0
    })

    // Draft text for the box-size number input so multi-digit values can be typed freely
    const [boxSizeInput, setBoxSizeInput] = useState(() => Math.round(boxSize * 100).toString())
    const [boxSizeFocused, setBoxSizeFocused] = useState(false)

    useEffect(() => {
        if (!boxSizeFocused) {
            setBoxSizeInput(Math.round(boxSize * 100).toString())
        }
    }, [boxSize, boxSizeFocused])

    // State for storing loaded image URLs
    const [loadedIcons, setLoadedIcons] = useState({})
    const [loadedFormIcon, setLoadedFormIcon] = useState('')
    const [tintedIcons, setTintedIcons] = useState({})
    const [tintedPreview, setTintedPreview] = useState('')

    // File upload states
    const [iconPreview, setIconPreview] = useState('')

    // Multiple file upload states
    const [audioFiles, setAudioFiles] = useState([])

    // Load icons for sounds
    useEffect(() => {
        const loadIcons = async () => {
            const allSounds = [...characters.flatMap(char => char.sounds), ...environmentSounds.flatMap(env => env.sounds)]
            const newLoadedIcons = {}
            
            for (const sound of allSounds) {
                if (sound.icon && !loadedIcons[sound.icon]) {
                    try {
                        const iconUrl = await getFileFromLocalStorage(sound.icon) || `/assets/${sound.icon}`
                        newLoadedIcons[sound.icon] = iconUrl
                    } catch (error) {
                        console.error('Failed to load icon:', sound.icon, error)
                        newLoadedIcons[sound.icon] = `/assets/${sound.icon}`
                    }
                }
            }
            
            if (Object.keys(newLoadedIcons).length > 0) {
                setLoadedIcons(prev => ({ ...prev, ...newLoadedIcons }))
            }
        }
        
        loadIcons()
    }, [characters, environmentSounds])

    // Load form icon
    useEffect(() => {
        const loadFormIcon = async () => {
            if (soundFormData.icon && !iconPreview && !loadedFormIcon) {
                try {
                    const iconUrl = await getFileFromLocalStorage(soundFormData.icon) || `/assets/${soundFormData.icon}`
                    setLoadedFormIcon(iconUrl)
                } catch (error) {
                    console.error('Failed to load form icon:', soundFormData.icon, error)
                    setLoadedFormIcon(`/assets/${soundFormData.icon}`)
                }
            }
        }
        
        loadFormIcon()
    }, [soundFormData.icon, iconPreview])

    // Process recolored versions of icons whenever sounds, colors, or icons change
    useEffect(() => {
        const processTints = async () => {
            const allSounds = [...characters.flatMap(char => char.sounds), ...environmentSounds.flatMap(env => env.sounds)]
            const tasks = allSounds.map(async (sound) => {
                if (!sound.icon || sound.color === '#84cc16') {
                    return
                }

                const key = `${sound.icon}|${sound.color || 'default'}|${sound.brightness || 1}`
                if (tintedIcons[key]) {
                    return
                }

                const sourceUrl = loadedIcons[sound.icon] || `/assets/${sound.icon}`
                const tintedUrl = await recolorImageToColor(sourceUrl, sound.color, sound.brightness)
                if (tintedUrl) {
                    setTintedIcons(prev => ({ ...prev, [key]: tintedUrl }))
                }
            })

            await Promise.all(tasks)
        }

        processTints()
    }, [characters, environmentSounds, loadedIcons])

    // Recolor the icon preview in the sound modal when the tint changes
    useEffect(() => {
        let cancelled = false

        const timer = setTimeout(async () => {
            const sourceUrl = iconPreview || loadedFormIcon || (soundFormData.icon ? `/assets/${soundFormData.icon}` : '')
            if (!sourceUrl || soundFormData.color === '#84cc16') {
                setTintedPreview('')
                return
            }

            const tintedUrl = await recolorImageToColor(sourceUrl, soundFormData.color, soundFormData.brightness)
            if (!cancelled && tintedUrl) {
                setTintedPreview(tintedUrl)
            }
        }, 120)

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [iconPreview, loadedFormIcon, soundFormData.icon, soundFormData.color, soundFormData.brightness])

    // Migrate localStorage files to Tauri file system (only in Tauri environment)
    useEffect(() => {
        const migrateLocalStorageFiles = async () => {
            // Only run migration in Tauri environment
            if (!isTauri) {
                return
            }

            // Check if migration is needed
            const migrationKey = 'localStorageMigrationCompleted'
            if (localStorage.getItem(migrationKey)) {
                return // Migration already completed
            }

            try {
                console.log('Starting localStorage file migration...')
                let migratedCount = 0
                
                // Get all localStorage keys that start with 'sound_file_'
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i)
                    if (key && key.startsWith('sound_file_')) {
                        const fileName = key.replace('sound_file_', '')
                        const fileDataUrl = localStorage.getItem(key)
                        
                        if (fileDataUrl) {
                            try {
                                // Convert data URL to blob
                                const response = await fetch(fileDataUrl)
                                const blob = await response.blob()
                                
                                // Convert blob to array buffer
                                const arrayBuffer = await blob.arrayBuffer()
                                const uint8Array = new Uint8Array(arrayBuffer)
                                
                                // Save to Tauri file system
                                const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
                                await writeFile(fileName, uint8Array, { baseDir: BaseDirectory.AppData })
                                
                                console.log(`Migrated file: ${fileName}`)
                                migratedCount++
                                
                                // Remove from localStorage
                                localStorage.removeItem(key)
                            } catch (error) {
                                console.error(`Failed to migrate file ${fileName}:`, error)
                            }
                        }
                    }
                }
                
                console.log(`Migration completed. Migrated ${migratedCount} files.`)
                localStorage.setItem(migrationKey, 'true')
            } catch (error) {
                console.error('Migration failed:', error)
            }
        }
        
        migrateLocalStorageFiles()
    }, [])

    // Predefined themes
    const predefinedThemes = {
        'default': { name: 'Default', primary: '#0f172a' },
        'forest': { name: 'Forest', primary: '#0d350c' },
        'ocean': { name: 'Ocean', primary: '#001d4c' },
        'fire': { name: 'Fire', primary: '#991212' },
        'magic': { name: 'Magic', primary: '#442981' },
        'gold': { name: 'Gold', primary: '#8e5a02' }
    }



    // Get correct active IDs based on view mode
    const currentActiveCharId = isSplitView ? activeCharacterId : activeTab
    const currentActiveEnvId = isSplitView ? activeEnvironmentId : activeTab

    // Get active character or environment category
    const activeCharacter = characters.find(char => char.id === currentActiveCharId)
    const activeEnvironmentCategory = environmentSounds.find(cat => cat.category === currentActiveEnvId)

    const enableAudio = () => {
        setAudioEnabled(true)
    }

    const updateMasterVolume = (volume) => {
        const nowEnabled = audioEnabled || volume > 0

        setMasterVolume(volume)

        if (volume > 0 && !audioEnabled) {
            setAudioEnabled(true)
        }

        audioElementsRef.current.forEach((audio) => {
            if (audio && typeof audio.volume !== 'undefined') {
                if (audio.fadeInInterval) {
                    clearInterval(audio.fadeInInterval)
                    audio.fadeInInterval = null
                }
                audio.volume = nowEnabled ? volume : 0
            }
        })
    }

    const toggleFullscreen = async () => {
        if (isTauri) {
            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window')
                const appWindow = getCurrentWindow()
                const currentlyFullscreen = await appWindow.isFullscreen()
                await appWindow.setFullscreen(!currentlyFullscreen)
                setIsFullscreen(!currentlyFullscreen)
            } catch (error) {
                console.error('Failed to toggle fullscreen:', error)
            }
        } else {
            // Fallback for web browser development
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.error(err))
                setIsFullscreen(true)
            } else {
                document.exitFullscreen()
                setIsFullscreen(false)
            }
        }
    }

    const openAddSoundModal = (overrideType) => {
        // Support overriding the tab type dynamically to handle asynchronous state issues in split view
        const targetTabType = typeof overrideType === 'string' ? overrideType : tabType
        const defaultLoop = targetTabType === 'environment'

        if (typeof overrideType === 'string') {
            setTabType(overrideType)
        }

        setSoundFormData({
            name: '',
            type: '',
            icon: '',
            file: '',
            color: '#84cc16',
            duration: 0,
            fadeIn: 0,
            fadeOut: 0,
            loop: defaultLoop
        })
        setIconPreview('')

        setAudioFiles([])

        setEditingSound(null)
        setShowSoundModal(true)
    }

    const openEditSoundModal = async (sound) => {
        const loopValue = sound.loop !== undefined ? sound.loop : tabType === 'environment'

        setIconPreview('')

        if (sound.files && sound.files.length > 0) {
            const existingFiles = await Promise.all(sound.files.map(async file => ({
                file: null,
                preview: await getFileFromLocalStorage(file.name) || `/assets/${file.name}`,
                name: file.name
            })))
            setAudioFiles(existingFiles)
        } else {
            setAudioFiles([])
        }

        if (sound.icon) {
            const iconUrl = await getFileFromLocalStorage(sound.icon) || `/assets/${sound.icon}`
            setIconPreview(iconUrl)
        } else {
            setIconPreview('')
        }

        setSoundFormData({
            name: sound.name,
            type: sound.type,
            icon: sound.icon || '',
            file: sound.file || '',
            files: sound.files || [],
            randomPlay: sound.randomPlay || false,
            color: sound.color || '#84cc16',
            brightness: sound.brightness || 1,
            duration: sound.duration || 0,
            fadeIn: sound.fadeIn || 0,
            fadeOut: sound.fadeOut || 0,
            loop: loopValue,
            glowEnabled: sound.glowEnabled || false,
            glowProminence: sound.glowProminence || 0.5
        })
        setEditingSound(sound)
        setShowSoundModal(true)
    }

    const handleSoundFormChange = (e) => {
        const { name, value, type, checked } = e.target
        setSoundFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }))
    }

    const handleSoundFormSubmit = (e) => {
        e.preventDefault()

        const hasFiles = audioFiles.length > 0 || soundFormData.files?.length > 0 || soundFormData.file
        if (!soundFormData.name.trim() || !hasFiles) {
            return
        }

        if (editingSound) {
            updateSound(editingSound.id, soundFormData)
        } else {
            addSound(soundFormData)
        }

        setShowSoundModal(false)
    }

    const addSound = (newSoundData) => {
        const newId = `sound_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const newSound = {
            id: newId,
            name: newSoundData.name,
            type: newSoundData.type || 'Sound',
            icon: newSoundData.icon,
            file: newSoundData.file,
            files: newSoundData.files || [],
            randomPlay: newSoundData.randomPlay || false,
            color: newSoundData.color,
            brightness: newSoundData.brightness || 1,
            duration: parseFloat(newSoundData.duration) || 0,
            fadeIn: parseFloat(newSoundData.fadeIn) || 0,
            fadeOut: parseFloat(newSoundData.fadeOut) || 0,
            loop: newSoundData.loop !== undefined ? newSoundData.loop : (tabType === 'environment')
        }

        if (tabType === 'characters' && activeCharacter) {
            setCharacters(prev => prev.map(character =>
                character.id === currentActiveCharId
                    ? { ...character, sounds: [...character.sounds, newSound] }
                    : character
            ))
        } else if (tabType === 'environment' && activeEnvironmentCategory) {
            setEnvironmentSounds(prev => prev.map(category =>
                category.category === currentActiveEnvId
                    ? { ...category, sounds: [...category.sounds, newSound] }
                    : category
            ))
        }
    }

    const updateSound = (soundId, newSoundData) => {
        const updatedSound = {
            ...newSoundData,
            duration: parseFloat(newSoundData.duration) || 0,
            fadeIn: parseFloat(newSoundData.fadeIn) || 0,
            fadeOut: parseFloat(newSoundData.fadeOut) || 0,
            loop: newSoundData.loop !== undefined ? newSoundData.loop : false,
            randomPlay: newSoundData.randomPlay || false,
        }

        if (tabType === 'characters' && activeCharacter) {
            setCharacters(prev => prev.map(character =>
                character.id === currentActiveCharId
                    ? {
                        ...character,
                        sounds: character.sounds.map(sound =>
                            sound.id === soundId ? { ...sound, ...updatedSound } : sound
                        )
                    }
                    : character
            ))
        } else if (tabType === 'environment' && activeEnvironmentCategory) {
            setEnvironmentSounds(prev => prev.map(category =>
                category.category === currentActiveEnvId
                    ? {
                        ...category,
                        sounds: category.sounds.map(sound =>
                            sound.id === soundId ? { ...sound, ...updatedSound } : sound
                        )
                    }
                    : category
            ))
        }
    }

    const moveSound = (draggedId, targetId, containerType, containerId) => {
        if (!draggedId || !targetId || draggedId === targetId) {
            return
        }

        const reorder = (list) => {
            const fromIndex = list.findIndex(sound => sound.id === draggedId)
            const toIndex = list.findIndex(sound => sound.id === targetId)
            if (fromIndex === -1 || toIndex === -1) {
                return list
            }
            const newList = [...list]
            const [moved] = newList.splice(fromIndex, 1)
            newList.splice(toIndex, 0, moved)
            return newList
        }

        if (containerType === 'character') {
            setCharacters(prev => prev.map(character =>
                character.id === containerId
                    ? { ...character, sounds: reorder(character.sounds) }
                    : character
            ))
        } else {
            setEnvironmentSounds(prev => prev.map(category =>
                category.category === containerId
                    ? { ...category, sounds: reorder(category.sounds) }
                    : category
            ))
        }
    }

    const deleteSound = (soundId) => {
        stopSoundInstances(soundId)

        const isCharacterSound = characters.some(character =>
            character.sounds.some(sound => sound.id === soundId)
        )

        if (isCharacterSound) {
            setCharacters(prev => prev.map(character =>
                character.sounds.some(sound => sound.id === soundId)
                    ? {
                        ...character,
                        sounds: character.sounds.filter(sound => sound.id !== soundId)
                    }
                    : character
            ))
        } else {
            setEnvironmentSounds(prev => prev.map(category => ({
                ...category,
                sounds: category.sounds.filter(sound => sound.id !== soundId)
            })))
        }
    }

    const handleDeleteSound = (soundId) => {
        setItemToDelete(soundId)
        setDeleteType('sound')
        setShowDeleteConfirm(true)
    }

    const confirmDelete = () => {
        if (!itemToDelete) {
            return
        }

        if (deleteType === 'sound') {
            deleteSound(itemToDelete)
        } else if (deleteType === 'character') {
            deleteCharacter(itemToDelete)
        } else if (deleteType === 'category') {
            deleteCategory(itemToDelete)
        }

        setShowDeleteConfirm(false)
        setItemToDelete(null)
        setDeleteType('')
    }

    const handleIconUpload = (e) => {
        const file = e.target.files[0]
        if (file) {
            setIconPreview(getObjectUrlForBlob(file.name, file))
            setSoundFormData(prev => ({ ...prev, icon: file.name }))
            storeFileInLocalStorage(file.name, file)
        }
    }

    // Reuse a single object URL per file name so blob: URLs don't accumulate
    const getObjectUrlForBlob = (key, blob) => {
        const existing = objectUrlCache.current.get(key)
        if (existing) {
            return existing
        }
        const url = URL.createObjectURL(blob)
        objectUrlCache.current.set(key, url)
        return url
    }

    const revokeObjectUrl = (key) => {
        const url = objectUrlCache.current.get(key)
        if (url) {
            URL.revokeObjectURL(url)
            objectUrlCache.current.delete(key)
        }
    }

    const storeFileInLocalStorage = async (fileName, file) => {
        try {
            if (isTauri) {
                // Tauri environment - use file system
                const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
                const arrayBuffer = await file.arrayBuffer()
                const uint8Array = new Uint8Array(arrayBuffer)
                await writeFile(fileName, uint8Array, { baseDir: BaseDirectory.AppData })
            } else {
                // Web environment - fallback to localStorage
                return new Promise((resolve) => {
                    const reader = new FileReader()
                    reader.onload = (e) => {
                        localStorage.setItem(`sound_file_${fileName}`, e.target.result)
                        resolve()
                    }
                    reader.readAsDataURL(file)
                })
            }
        } catch (error) {
            console.error('Failed to save file locally:', error)
        }
    }

    const getFileFromLocalStorage = async (fileName) => {
        try {
            if (isTauri) {
                // Tauri environment - use file system
                const { readFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs')
                const fileExists = await exists(fileName, { baseDir: BaseDirectory.AppData })
                if (fileExists) {
                    const contents = await readFile(fileName, { baseDir: BaseDirectory.AppData })
                    const blob = new Blob([contents])
                    return getObjectUrlForBlob(fileName, blob)
                }
            } else {
                // Web environment - fallback to localStorage
                const fileDataUrl = localStorage.getItem(`sound_file_${fileName}`)
                if (fileDataUrl) {
                    return fileDataUrl
                }
            }
        } catch (error) {
            console.error('Failed to read local file:', error)
        }
        return null
    }

    const handleMultipleAudioUpload = (e) => {
        const files = Array.from(e.target.files)
        if (files.length > 0) {
            const newFiles = files.map(file => ({
                file: file,
                preview: getObjectUrlForBlob(file.name, file),
                name: file.name
            }))

            setAudioFiles(prev => [...prev, ...newFiles])

            const fileNames = newFiles.map(f => f.name)
            setSoundFormData(prev => ({
                ...prev,
                files: [...(prev.files || []), ...fileNames.map(name => ({ name, url: name }))]
            }))

            files.forEach(file => {
                storeFileInLocalStorage(file.name, file)
            })
        }
    }

    const removeAudioFile = async (index) => {
        const fileToRemove = audioFiles[index]

        setAudioFiles(prev => prev.filter((_, i) => i !== index))

        setSoundFormData(prev => ({
            ...prev,
            files: prev.files.filter((_, i) => i !== index)
        }))

        await removeFileFromLocalStorage(fileToRemove.name)
    }

    const clearMultipleAudioUpload = async () => {
        for (const file of audioFiles) {
            await removeFileFromLocalStorage(file.name)
        }

        setAudioFiles([])
        setSoundFormData(prev => ({ ...prev, files: [] }))
    }

    const clearIconUpload = async () => {
        if (soundFormData.icon) {
            await removeFileFromLocalStorage(soundFormData.icon)
        }
        setIconPreview('')
        setSoundFormData(prev => ({ ...prev, icon: '' }))
    }

    const openAddCharacterModal = () => {
        setCharacterFormData({ name: '' })
        setEditingCharacter(null)
        setShowCharacterModal(true)
    }

    const handleCharacterFormChange = (e) => {
        const { name, value } = e.target
        setCharacterFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleCharacterFormSubmit = (e) => {
        e.preventDefault()

        const trimmedName = characterFormData.name.trim()

        if (!trimmedName) {
            return
        }

        const nameTaken = characters.some(character =>
            character.name === trimmedName && (!editingCharacter || character.id !== editingCharacter.id)
        )

        if (nameTaken) {
            alert(`A character named "${trimmedName}" already exists.`)
            return
        }

        if (editingCharacter) {
            updateCharacter(editingCharacter.id, characterFormData)
        } else {
            addCharacter(characterFormData)
        }

        setShowCharacterModal(false)
        setEditingCharacter(null)
    }

    const updateCharacter = (characterId, characterData) => {
        setCharacters(prev => prev.map(character =>
            character.id === characterId
                ? { ...character, name: characterData.name.trim() }
                : character
        ))
    }

    const addCharacter = (characterData) => {
        const newId = `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const newCharacter = {
            id: newId,
            name: characterData.name.trim(),
            sounds: []
        }

        setCharacters(prev => [...prev, newCharacter])
        setActiveTab(newId)
        if (isSplitView) setActiveCharacterId(newId)
    }

    const handleDeleteCharacter = (characterId) => {
        setItemToDelete(characterId)
        setDeleteType('character')
        setShowDeleteConfirm(true)
    }

    const deleteCharacter = (characterId) => {
        const character = characters.find(c => c.id === characterId)
        if (character) {
            character.sounds.forEach(sound => stopSoundInstances(sound.id))
        }

        setCharacters(prev => prev.filter(character => character.id !== characterId))

        if (activeTab === characterId) {
            setActiveTab('')
        }
        if (activeCharacterId === characterId) {
            setActiveCharacterId('')
        }
    }

    const openAddCategoryModal = () => {
        setCategoryFormData({ name: '' })
        setEditingCategory(null)
        setShowCategoryModal(true)
    }

    const handleCategoryFormChange = (e) => {
        const { name, value } = e.target
        setCategoryFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const openSettingsModal = () => {
        const savedSettings = localStorage.getItem('backgroundSettings')
        if (savedSettings) {
            const settings = safeParse(savedSettings, {})
            backgroundSettingsRef.current = settings
            setBackgroundSettings(settings)
        }
        setShowSettingsModal(true)
    }

    const handleBackgroundSettingsChange = (key, value) => {
        const newSettings = {
            ...backgroundSettingsRef.current,
            [key]: value
        }
        backgroundSettingsRef.current = newSettings
        setBackgroundSettings(newSettings)
        applyBackgroundSettings(newSettings)
        localStorage.setItem('backgroundSettings', JSON.stringify(newSettings))
    }

    const handleBoxSizeChange = (newSize) => {
        setBoxSize(newSize)
        localStorage.setItem('boxSize', newSize.toString())
    }

    const generateThemePalette = (baseColor) => {
        const hex = baseColor.replace('#', '')
        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)

        const compR = 255 - r
        const compG = 255 - g
        const compB = 255 - b
        const complementary = `#${compR.toString(16).padStart(2, '0')}${compG.toString(16).padStart(2, '0')}${compB.toString(16).padStart(2, '0')}`

        const triadic1 = adjustHue(baseColor, 120)
        const triadic2 = adjustHue(baseColor, 240)

        const darker = darkenColor(baseColor, 0.3)
        const lighter = lightenColor(baseColor, 0.2)

        return {
            primary: baseColor,
            complementary,
            triadic1,
            triadic2,
            darker,
            lighter,
            text: getTextColor(baseColor),
            border: getBorderColor(baseColor)
        }
    }

    const adjustHue = (color, degrees) => {
        const hex = color.replace('#', '')
        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)

        const newR = Math.min(255, Math.max(0, r + degrees / 3))
        const newG = Math.min(255, Math.max(0, g + degrees / 3))
        const newB = Math.min(255, Math.max(0, b + degrees / 3))

        return `#${Math.round(newR).toString(16).padStart(2, '0')}${Math.round(newG).toString(16).padStart(2, '0')}${Math.round(newB).toString(16).padStart(2, '0')}`
    }

    const darkenColor = (color, amount) => {
        const hex = color.replace('#', '')
        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)

        return `#${Math.round(r * (1 - amount)).toString(16).padStart(2, '0')}${Math.round(g * (1 - amount)).toString(16).padStart(2, '0')}${Math.round(b * (1 - amount)).toString(16).padStart(2, '0')}`
    }

    const lightenColor = (color, amount) => {
        const hex = color.replace('#', '')
        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)

        return `#${Math.round(r + (255 - r) * amount).toString(16).padStart(2, '0')}${Math.round(g + (255 - g) * amount).toString(16).padStart(2, '0')}${Math.round(b + (255 - b) * amount).toString(16).padStart(2, '0')}`
    }

    const getTextColor = (color) => {
        const hex = color.replace('#', '')
        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)
        const brightness = (r * 299 + g * 587 + b * 114) / 1000
        return brightness > 128 ? '#000000' : '#ffffff'
    }

    const getBorderColor = (color) => {
        const hex = color.replace('#', '')
        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)
        const brightness = (r * 299 + g * 587 + b * 114) / 1000

        if (brightness > 128) {
            return darkenColor(color, 0.2)
        } else {
            return lightenColor(color, 0.2)
        }
    }

    const applyTheme = (theme) => {
        const root = document.documentElement

        root.style.setProperty('--theme-bg-primary', '#090d16')
        root.style.setProperty('--theme-bg-secondary', '#0f172a')
        root.style.setProperty('--theme-accent', '#84cc16')
        root.style.setProperty('--theme-text', '#f8fafc')
        root.style.setProperty('--theme-border', '#334155')

        if (theme && theme !== 'default') {
            const palette = generateThemePalette(theme.primary || theme)

            root.style.setProperty('--theme-bg-primary', palette.darker)
            root.style.setProperty('--theme-bg-secondary', palette.primary)
            root.style.setProperty('--theme-accent', palette.complementary)
            root.style.setProperty('--theme-text', palette.text)
            root.style.setProperty('--theme-border', palette.border)
        }
    }

    const applyBackgroundSettings = (settings) => {
        const appContainer = document.querySelector('.app-container')
        if (!appContainer) {
            return
        }

        appContainer.classList.remove('bg-cover', 'bg-center', 'bg-no-repeat')
        appContainer.style.backgroundImage = ''
        appContainer.style.backgroundColor = ''

        switch (settings.type) {
            case 'color':
                appContainer.classList.add('bg-dark-900')
                if (settings.theme === 'default') {
                    applyTheme('default')
                } else if (predefinedThemes[settings.theme]) {
                    applyTheme(predefinedThemes[settings.theme].primary)
                } else {
                    applyTheme(settings.theme)
                }
                break

            case 'image':
                applyTheme('#090d16')

                if (settings.imagePreview) {
                    appContainer.classList.remove('bg-dark-900', 'bg-dark-800', 'bg-dark-700')
                    appContainer.classList.add('bg-cover', 'bg-center', 'bg-no-repeat')
                    appContainer.style.backgroundImage = `url(${settings.imagePreview})`
                    appContainer.style.backgroundColor = 'transparent'

                    const img = new Image()
                    img.onerror = () => {
                        appContainer.style.backgroundImage = ''
                        appContainer.style.backgroundColor = ''
                        appContainer.classList.remove('bg-cover', 'bg-center', 'bg-no-repeat')
                        appContainer.classList.add('bg-dark-900')
                    }
                    img.src = settings.imagePreview
                }
                break

            default:
                appContainer.classList.add('bg-dark-900')
                applyTheme('default')
        }

        const header = document.querySelector('.app-header')
        if (header) {
            if (settings.type === 'image' && settings.imagePreview) {
                header.style.backgroundColor = 'rgba(15, 23, 42, 0.8)'
            } else {
                header.style.backgroundColor = ''
            }
        }
    }

    const handleImageUpload = (e) => {
        const file = e.target.files[0]
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file')
                return
            }

            if (file.size > 5 * 1024 * 1024) {
                alert('Image file size must be less than 5MB')
                return
            }

            handleBackgroundSettingsChange('type', 'image')
            handleBackgroundSettingsChange('isLoading', true)

            const reader = new FileReader()
            reader.onload = (event) => {
                const updatedSettings = {
                    ...backgroundSettingsRef.current,
                    imagePreview: event.target.result,
                    imageFile: file,
                    isLoading: false
                }
                backgroundSettingsRef.current = updatedSettings
                setBackgroundSettings(updatedSettings)
                applyBackgroundSettings(updatedSettings)
                localStorage.setItem('backgroundSettings', JSON.stringify(updatedSettings))
            }
            reader.onerror = () => {
                alert('Error loading image file')
                const errorSettings = {
                    ...backgroundSettingsRef.current,
                    isLoading: false
                }
                backgroundSettingsRef.current = errorSettings
                setBackgroundSettings(errorSettings)
                localStorage.setItem('backgroundSettings', JSON.stringify(errorSettings))
            }
            reader.readAsDataURL(file)
        }
    }

    const handleCategoryFormSubmit = (e) => {
        e.preventDefault()

        const trimmedName = categoryFormData.name.trim()

        if (!trimmedName) {
            return
        }

        const nameTaken = environmentSounds.some(category =>
            category.category === trimmedName && (!editingCategory || category.category !== editingCategory.category)
        )

        if (nameTaken) {
            alert(`A category named "${trimmedName}" already exists.`)
            return
        }

        if (editingCategory) {
            updateCategory(editingCategory.category, trimmedName)
        } else {
            addCategory(categoryFormData)
        }

        setShowCategoryModal(false)
        setEditingCategory(null)
    }

    const updateCategory = (oldName, newName) => {
        setEnvironmentSounds(prev => prev.map(category =>
            category.category === oldName
                ? { ...category, category: newName }
                : category
        ))

        if (activeTab === oldName) setActiveTab(newName)
        if (activeEnvironmentId === oldName) setActiveEnvironmentId(newName)
    }

    const addCategory = (categoryData) => {
        const newCategory = {
            category: categoryData.name.trim(),
            sounds: []
        }
        setEnvironmentSounds(prev => [...prev, newCategory])
        setActiveTab(newCategory.category)
        if (isSplitView) setActiveEnvironmentId(newCategory.category)
    }

    const handleDeleteCategory = (categoryName) => {
        setItemToDelete(categoryName)
        setDeleteType('category')
        setShowDeleteConfirm(true)
    }

    const deleteCategory = (categoryName) => {
        const category = environmentSounds.find(e => e.category === categoryName)
        if (category) {
            category.sounds.forEach(sound => stopSoundInstances(sound.id))
        }

        setEnvironmentSounds(prev => prev.filter(category => category.category !== categoryName))
        if (activeTab === categoryName) setActiveTab('')
        if (activeEnvironmentId === categoryName) setActiveEnvironmentId('')
    }

    const handleEditCharacter = (characterId) => {
        const character = characters.find(c => c.id === characterId)
        if (!character) {
            return
        }

        setCharacterFormData({ name: character.name })
        setEditingCharacter(character)
        setShowCharacterModal(true)
    }

    const handleEditCategory = (categoryName) => {
        const category = environmentSounds.find(e => e.category === categoryName)
        if (!category) {
            return
        }

        setCategoryFormData({ name: categoryName })
        setEditingCategory(category)
        setShowCategoryModal(true)
    }

    const removeFileFromLocalStorage = async (fileName) => {
        try {
            if (isTauri) {
                // Tauri environment - use file system
                const { remove, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs')
                const fileExists = await exists(fileName, { baseDir: BaseDirectory.AppData })
                if (fileExists) {
                    await remove(fileName, { baseDir: BaseDirectory.AppData })
                }
            } else {
                // Web environment - fallback to localStorage
                localStorage.removeItem(`sound_file_${fileName}`)
            }
            revokeObjectUrl(fileName)
        } catch (error) {
            console.error('Failed to remove local file:', error)
        }
    }

    const playSound = async (sound) => {
        if (editMode) return

        if (!audioEnabled) {
            enableAudio()
        }

        const soundKey = sound.id
        let fileToPlay

        if (sound.files && sound.files.length > 0) {
            if (sound.randomPlay && sound.files.length > 1) {
                const randomIndex = Math.floor(Math.random() * sound.files.length)
                fileToPlay = sound.files[randomIndex]
            } else {
                fileToPlay = sound.files[0]
            }
        } else {
            fileToPlay = { name: sound.file }
        }

        let soundUrl
        const storedFile = await getFileFromLocalStorage(fileToPlay.name)
        if (storedFile) {
            soundUrl = storedFile
        } else {
            soundUrl = `/assets/${fileToPlay.name}`
        }

        const audio = new Audio(soundUrl)
        audio.loop = false
        audio.volume = masterVolume

        const audioInstanceKey = `${soundKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        audioElementsRef.current.set(audioInstanceKey, audio)

        setSoundInstances(prev => ({
            ...prev,
            [audioInstanceKey]: true
        }))

        const cleanupAudio = (instanceKey, audioEl) => {
            if (audioEl.fadeInInterval) {
                clearInterval(audioEl.fadeInInterval)
            }
            if (audioEl.fadeOutInterval) {
                clearInterval(audioEl.fadeOutInterval)
            }
            if (audioEl.timer) {
                clearTimeout(audioEl.timer)
            }

            audioElementsRef.current.delete(instanceKey)

            setSoundInstances(prev => {
                const newState = { ...prev }
                delete newState[instanceKey]
                return newState
            })
        }

        if (sound.fadeIn > 0) {
            applyFadeIn(audio, masterVolume, sound.fadeIn)
        }

        if (!sound.loop && sound.duration > 0) {
            if (sound.fadeOut > 0) {
                const fadeStartDelay = Math.max(0, sound.duration - sound.fadeOut) * 1000

                audio.timer = setTimeout(() => {
                    fadeOutAudio(audio, sound.fadeOut, () => {
                        audio.pause()
                        cleanupAudio(audioInstanceKey, audio)
                    })
                }, fadeStartDelay)
            } else {
                audio.timer = setTimeout(() => {
                    audio.pause()
                    audio.currentTime = 0
                    cleanupAudio(audioInstanceKey, audio)
                }, sound.duration * 1000)
            }
        }

        if (sound.loop) {
            // Manual loop: rewind slightly before the end to avoid the pause
            // native looping causes (decoder flush + re-seek at the boundary).
            // For very short clips the 0.25s lead-in would cut them down to a
            // tiny loop, so never rewind before 98% of the full length.
            audio.addEventListener('timeupdate', () => {
                if (audio.stopped) {
                    return
                }
                if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
                    return
                }
                const rewindThreshold = Math.max(audio.duration - 0.25, audio.duration * 0.98)
                if (audio.currentTime >= rewindThreshold) {
                    audio.currentTime = 0
                    if (sound.fadeIn > 0) {
                        applyFadeIn(audio, masterVolume, sound.fadeIn)
                    }
                }
            })

            audio.addEventListener('ended', () => {
                if (audio.stopped) {
                    cleanupAudio(audioInstanceKey, audio)
                    return
                }
                audio.currentTime = 0
                if (sound.fadeIn > 0) {
                    applyFadeIn(audio, masterVolume, sound.fadeIn)
                }
                audio.play().catch(() => {})
            })
        } else {
            audio.addEventListener('ended', () => {
                cleanupAudio(audioInstanceKey, audio)
            })
        }

        audio.play()
            .then(() => {
                if (audio.stopped) {
                    audio.pause()
                    audio.currentTime = 0
                    cleanupAudio(audioInstanceKey, audio)
                }
            })
            .catch(error => {
                if (audio.stopped) {
                    cleanupAudio(audioInstanceKey, audio)
                    return
                }
                console.error('Error playing sound:', error, soundUrl)
                cleanupAudio(audioInstanceKey, audio)
            })
    }

    const isSoundPlaying = (soundId) => {
        return Object.keys(soundInstances).some(key => key.startsWith(`${soundId}_`))
    }

    // Instantly stop an audio instance and remove it from tracking
    const stopAudioInstance = (instanceKey, audio) => {
        if (!audio) {
            return
        }

        audio.stopped = true

        if (audio.fadeInInterval) {
            clearInterval(audio.fadeInInterval)
            audio.fadeInInterval = null
        }
        if (audio.fadeOutInterval) {
            clearInterval(audio.fadeOutInterval)
            audio.fadeOutInterval = null
        }
        if (audio.timer) {
            clearTimeout(audio.timer)
            audio.timer = null
        }

        audio.volume = 0
        audio.pause()
        audio.currentTime = 0

        audioElementsRef.current.delete(instanceKey)

        setSoundInstances(prev => {
            const newState = { ...prev }
            delete newState[instanceKey]
            return newState
        })
    }

    // Stop every playing instance of a sound, regardless of edit mode
    const stopSoundInstances = (soundId) => {
        Array.from(audioElementsRef.current.entries())
            .filter(([key]) => key.startsWith(`${soundId}_`))
            .forEach(([instanceKey, audio]) => {
                stopAudioInstance(instanceKey, audio)
            })
    }

    const stopSound = (sound) => {
        if (editMode) return

        stopSoundInstances(sound.id)
    }

    const stopAllSounds = () => {
        if (editMode) return

        const audioInstances = Array.from(audioElementsRef.current.entries())

        audioInstances.forEach(([instanceKey, audio]) => {
            stopAudioInstance(instanceKey, audio)
        })
    }

    useEffect(() => {
        if (tabType === 'characters' && characters.length > 0 && !activeTab) {
            setActiveTab(characters[0].id)
        } else if (tabType === 'environment' && environmentSounds.length > 0 && !activeTab) {
            setActiveTab(environmentSounds[0].category)
        }
    }, [tabType, characters, environmentSounds, activeTab])

    // Auto-save Characters to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('ttrpg_characters', JSON.stringify(characters))
    }, [characters])

    // Auto-save Environment Sounds to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('ttrpg_environment', JSON.stringify(environmentSounds))
    }, [environmentSounds])

    useEffect(() => {
        if (characters.length > 0 && !activeCharacterId) {
            setActiveCharacterId(characters[0].id)
        }
        if (environmentSounds.length > 0 && !activeEnvironmentId) {
            setActiveEnvironmentId(environmentSounds[0].category)
        }
    }, [characters, environmentSounds, activeCharacterId, activeEnvironmentId])

    useEffect(() => {
        const savedSettings = localStorage.getItem('backgroundSettings')
        if (savedSettings) {
            const settings = safeParse(savedSettings, {})
            backgroundSettingsRef.current = settings
            setBackgroundSettings(settings)
            applyBackgroundSettings(settings)
        }
    }, [])

    // Render individual sound card
    const renderSoundCard = (sound, containerType, containerId) => {
        const isPlaying = isSoundPlaying(sound.id)
        const IconComponent = getSoundIcon(sound.type)
        const isDragging = draggedSoundId === sound.id
        const isDragTarget = dragOverSoundId === sound.id && !isDragging

        return (
            <div
                key={sound.id}
                className="group relative shrink-0"
                style={{ width: `${140 * boxSize}px` }}
            >
                <div
                    role="button"
                    tabIndex={editMode ? -1 : 0}
                    aria-disabled={editMode}
                    draggable={editMode}
                    onDragStart={(e) => {
                        if (!editMode) return
                        e.dataTransfer.setData('text/plain', sound.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setDraggedSoundId(sound.id)
                    }}
                    onDragOver={(e) => {
                        if (!editMode) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        setDragOverSoundId(sound.id)
                    }}
                    onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const draggedId = e.dataTransfer.getData('text/plain') || draggedSoundId
                        moveSound(draggedId, sound.id, containerType, containerId)
                        setDraggedSoundId(null)
                        setDragOverSoundId(null)
                    }}
                    onDragEnd={() => {
                        setDraggedSoundId(null)
                        setDragOverSoundId(null)
                    }}
                    onClick={() => {
                        if (!editMode) playSound(sound)
                    }}
                    onKeyDown={(e) => {
                        if (editMode) return
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            playSound(sound)
                        }
                    }}
                    className={`w-full aspect-square bg-dark-700 border rounded-xl hover:bg-dark-600 transition-all duration-200 flex flex-col items-center justify-center overflow-hidden ${isPlaying && !editMode ? 'ring-2 ring-lime-500' : ''
                        } ${isDragTarget ? 'ring-2 ring-lime-500 border-lime-400' : ''
                        } ${isDragging ? 'opacity-40' : ''} ${editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                    style={{
                        backgroundColor: 'var(--theme-bg-secondary)',
                        borderColor: sound.color,
                        padding: `${8 * boxSize}px`,
                        borderRadius: `${12 * boxSize}px`,
                        ...getGlowEffectStyle(sound)
                    }}
                >
                    <div
                        className="flex flex-col items-center justify-center w-full"
                        style={{
                            marginBottom: `${4 * boxSize}px`
                        }}
                    >
                        {sound.icon ? (
                            <img
                                src={tintedIcons[`${sound.icon}|${sound.color || 'default'}|${sound.brightness || 1}`] || loadedIcons[sound.icon] || `/assets/${sound.icon}`}
                                alt={sound.name}
                                className="mb-1 object-contain shrink-0"
                                style={{
                                    width: `${48 * boxSize}px`,
                                    height: `${48 * boxSize}px`
                                }}
                            />
                        ) : (
                            <IconComponent
                                size={40 * boxSize}
                                className="mb-1 shrink-0"
                                style={sound.color === 'transparent' ? {
                                    filter: `brightness(0) saturate(100%) invert(1) sepia(1) saturate(10) hue-rotate(${getHueRotateFromColor(sound.color)}deg) brightness(${sound.brightness || 1})`
                                } : sound.color !== '#84cc16' ? {
                                    filter: `sepia(0.5) saturate(200%) hue-rotate(${getHueRotateFromColor(sound.color)}deg) brightness(${sound.brightness || 1})`
                                } : {}}
                            />
                        )}

                        <div
                            className="font-medium text-center truncate w-full px-1 shrink-0"
                            style={{
                                fontSize: `${16 * boxSize}px`,
                                lineHeight: `${24 * boxSize}px`
                            }}
                        >
                            {sound.name}
                        </div>
                        <div
                            className="text-slate-400 text-center truncate w-full px-1 shrink-0"
                            style={{
                                fontSize: `${11 * boxSize}px`,
                                lineHeight: `${16 * boxSize}px`
                            }}
                        >
                            {sound.type}
                        </div>

                        {/* Loop Indicator */}
                        {!editMode && sound.loop && (
                            <InfinityIcon
                                className="absolute text-blue-500"
                                size={12 * boxSize}
                                style={{
                                    bottom: `${8 * boxSize}px`,
                                    right: `${8 * boxSize}px`
                                }}
                                title="Looping enabled"
                            />
                        )}

                        {/* Multi-file Indicator */}
                        {!editMode && sound.files && sound.files.length > 1 && (
                            <Shuffle
                                className="absolute text-purple-500"
                                size={12 * boxSize}
                                style={{
                                    top: `${8 * boxSize}px`,
                                    right: `${8 * boxSize}px`
                                }}
                                title={`${sound.files.length} files available`}
                            />
                        )}

                        {/* Stop Button */}
                        {!editMode && isPlaying && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    stopSound(sound)
                                }}
                                className="absolute bottom-2 left-2 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors z-10"
                                title="Stop Sound"
                            >
                                <Square size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Edit Mode Actions */}
                {editMode && (
                    <>
                        <button
                            onClick={() => handleDeleteSound(sound.id)}
                            className="absolute -top-2 -left-2 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100 z-10"
                            title="Delete Sound"
                        >
                            <Trash2 size={12} />
                        </button>
                        <button
                            onClick={async () => await openEditSoundModal(sound)}
                            className="absolute -top-2 -right-2 p-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100 z-10"
                            title="Edit Sound"
                        >
                            <Edit size={12} />
                        </button>
                    </>
                )}
            </div>
        )
    }

    // Render complete section panel (Sidebar + Grid)
    const renderPanelSection = (type) => {
        const isCharSection = type === 'characters'
        const currentActiveId = isSplitView
            ? (isCharSection ? activeCharacterId : activeEnvironmentId)
            : activeTab

        const setActive = (id) => {
            if (isSplitView) {
                if (isCharSection) setActiveCharacterId(id)
                else setActiveEnvironmentId(id)
            } else {
                setActiveTab(id)
            }
        }

        const activeItem = isCharSection
            ? characters.find(c => c.id === currentActiveId)
            : environmentSounds.find(e => e.category === currentActiveId)

        return (
            <div className="flex flex-col md:flex-row gap-4 h-full">
                {/* Mini Sidebar */}
                <div className="w-full md:w-64 shrink-0 bg-dark-800 rounded-xl p-4 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-lime-400 capitalize">
                            {isCharSection ? 'Characters' : 'Environment'}
                        </h3>
                        <button
                            onClick={() => setEditMode(!editMode)}
                            className={`p-2 rounded-lg transition-colors ${editMode ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                }`}
                            title="Toggle Edit Mode"
                        >
                            <Edit size={16} />
                        </button>
                    </div>

                    {/* Panel-Specific Edit Actions */}
                    {editMode && (
                        <div className="flex flex-col gap-2 mb-4 pb-4 border-b border-dark-700">
                            {isCharSection ? (
                                <>
                                    <button
                                        onClick={openAddCharacterModal}
                                        className="flex items-center space-x-2 px-3 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors text-sm text-slate-200"
                                    >
                                        <User size={16} />
                                        <span>Add Character</span>
                                    </button>
                                    <button
                                        onClick={() => openAddSoundModal('characters')}
                                        className="flex items-center space-x-2 px-3 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors text-sm text-lime-400"
                                    >
                                        <Plus size={16} />
                                        <span>Add Sound to Character</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={openAddCategoryModal}
                                        className="flex items-center space-x-2 px-3 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors text-sm text-slate-200"
                                    >
                                        <Folder size={16} />
                                        <span>Add Category</span>
                                    </button>
                                    <button
                                        onClick={() => openAddSoundModal('environment')}
                                        className="flex items-center space-x-2 px-3 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors text-sm text-lime-400"
                                    >
                                        <Plus size={16} />
                                        <span>Add Sound to Environment</span>
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    <div className="space-y-2 flex-1 overflow-y-auto no-scrollbar">
                        {isCharSection
                            ? characters.map(c => (
                                <div key={c.id} className="relative group">
                                    <button
                                        onClick={() => setActive(c.id)}
                                        className={`w-full text-left px-4 py-3 rounded-lg text-base flex items-center space-x-3 transition-colors ${currentActiveId === c.id ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                            } ${editMode ? 'pt-8' : ''}`}
                                    >
                                        <User className="shrink-0" size={16} />
                                        <span className="truncate">{c.name}</span>
                                    </button>
                                    {editMode && (
                                        <>
                                            <button
                                                onClick={() => handleDeleteCharacter(c.id)}
                                                className="absolute top-1 left-1 p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Delete Character"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleEditCharacter(c.id)}
                                                className="absolute top-1 right-1 p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Edit Character"
                                            >
                                                <Edit size={12} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))
                            : environmentSounds.map(e => (
                                <div key={e.category} className="relative group">
                                    <button
                                        onClick={() => setActive(e.category)}
                                        className={`w-full text-left px-4 py-3 rounded-lg text-base flex items-center space-x-3 transition-colors ${currentActiveId === e.category ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                            } ${editMode ? 'pt-8' : ''}`}
                                    >
                                        <Music className="shrink-0" size={16} />
                                        <span className="truncate">{e.category}</span>
                                    </button>
                                    {editMode && (
                                        <>
                                            <button
                                                onClick={() => handleDeleteCategory(e.category)}
                                                className="absolute top-1 left-1 p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Delete Category"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleEditCategory(e.category)}
                                                className="absolute top-1 right-1 p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Edit Category"
                                            >
                                                <Edit size={12} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                    </div>
                </div>

                {/* Sound Grid */}
                <div className="flex-1 min-w-0 bg-dark-800 rounded-xl p-4">
                    <h2 className="text-lg font-semibold mb-4 text-slate-200 truncate">
                        {activeItem ? (isCharSection ? activeItem.name : activeItem.category) : 'Select Category'}
                    </h2>
                    <div className="flex flex-wrap gap-4">
                        {activeItem?.sounds?.map(sound => renderSoundCard(sound, isCharSection ? 'character' : 'environment', currentActiveId))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="app-container min-h-screen bg-dark-900 text-slate-200">
            {/* Header */}
            <header className="app-header bg-dark-800 border-b border-dark-700">
                <div className="w-full px-6 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <div className="flex items-center space-x-2 shrink-0">
                                <img src="/assets/Icon.png" alt="App Icon" className="h-8 w-8" />
                                <h1 className="text-2xl font-fantaisie tracking-wider whitespace-nowrap">The SpellCaster</h1>
                            </div>

                            {/* Split View Toggle - Responsive Layout */}
                            <div className="h-6 w-px bg-dark-600 mx-1 hidden md:block"></div>
                            <div className="flex items-center space-x-2 bg-dark-900 px-2.5 py-1 rounded-lg border border-dark-600 shrink-0">
                                <span className="text-xs font-medium text-slate-300 leading-tight text-center hidden sm:inline">
                                    Split<br />View
                                </span>
                                <span className="text-xs font-medium text-slate-300 sm:hidden">Split</span>
                                <button
                                    type="button"
                                    onClick={() => setIsSplitView(!isSplitView)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${isSplitView ? 'bg-lime-600' : 'bg-dark-600'
                                        }`}
                                >
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isSplitView ? 'translate-x-5' : 'translate-x-1'
                                        }`} />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            {/* Volume Slider */}
                            <div className="flex items-center space-x-2">
                                <Volume2 size={20} className="text-slate-300" />
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={masterVolume}
                                    onChange={(e) => updateMasterVolume(parseFloat(e.target.value))}
                                    className="slider w-24"
                                    title={`Volume: ${Math.round(masterVolume * 100)}%`}
                                />
                                <div className="flex items-center">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={Math.round(masterVolume * 100)}
                                        onChange={(e) => {
                                            const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100
                                            updateMasterVolume(value)
                                        }}
                                        className="w-14 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-lime-500"
                                        title="Volume (%)"
                                    />
                                    <span className="text-sm text-slate-400 ml-1">%</span>
                                </div>
                            </div>

                            {/* Box Size Slider */}
                            <div className="flex items-center space-x-2">
                                <ZoomIn size={20} className="text-slate-300" />
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2.0"
                                    step="0.1"
                                    value={boxSize}
                                    onChange={(e) => handleBoxSizeChange(parseFloat(e.target.value))}
                                    className="slider w-20"
                                    title={`Box Size: ${Math.round(boxSize * 100)}%`}
                                />
                                <div className="flex items-center">
                                    <input
                                        type="number"
                                        min="50"
                                        max="200"
                                        value={boxSizeFocused ? boxSizeInput : Math.round(boxSize * 100)}
                                        onFocus={() => {
                                            setBoxSizeInput(Math.round(boxSize * 100).toString())
                                            setBoxSizeFocused(true)
                                        }}
                                        onChange={(e) => {
                                            const raw = e.target.value
                                            setBoxSizeInput(raw)
                                            const parsed = parseInt(raw, 10)
                                            if (!Number.isNaN(parsed) && parsed >= 50 && parsed <= 200) {
                                                handleBoxSizeChange(parsed / 100)
                                            }
                                        }}
                                        onBlur={() => {
                                            setBoxSizeFocused(false)
                                            const parsed = parseInt(boxSizeInput, 10)
                                            const clamped = Number.isNaN(parsed) ? 50 : Math.max(50, Math.min(200, parsed))
                                            handleBoxSizeChange(clamped / 100)
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur()
                                            }
                                        }}
                                        className="w-14 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-lime-500"
                                        title="Box Size (%)"
                                    />
                                    <span className="text-sm text-slate-400 ml-1">%</span>
                                </div>
                            </div>

                            {/* Stop All Sounds Button */}
                            <button
                                onClick={stopAllSounds}
                                disabled={Object.keys(soundInstances).length === 0 || editMode}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-dark-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                                title="Stop All Sounds"
                            >
                                <Square size={20} />
                            </button>

                            {/* Fullscreen Button */}
                            <button
                                onClick={toggleFullscreen}
                                className={`px-4 py-2 rounded-lg transition-colors ${
                                    isFullscreen 
                                    ? 'bg-lime-600 text-white hover:bg-lime-700' 
                                    : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                }`}
                                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                            >
                                <Maximize size={20} />
                            </button>

                            {/* Settings Button */}
                            <button
                                onClick={openSettingsModal}
                                className="px-4 py-2 rounded-lg bg-dark-700 text-slate-300 hover:bg-dark-600 transition-colors"
                                title="Settings"
                            >
                                <Settings size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="w-full px-6 py-6">
                {/* Edit Mode Controls (Hidden in Split View) */}
                {editMode && !isSplitView && (
                    <div className="mb-6 p-3 bg-lime-600 text-white rounded-lg w-full mx-auto">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center space-x-2">
                                <Settings size={16} />
                                <span className="font-medium">Edit Mode Active</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                {tabType === 'characters' && (
                                    <button
                                        onClick={openAddCharacterModal}
                                        className="flex items-center space-x-2 px-3 py-1 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                                    >
                                        <User size={16} />
                                        <span>Add Character</span>
                                    </button>
                                )}
                                {tabType === 'environment' && (
                                    <button
                                        onClick={openAddCategoryModal}
                                        className="flex items-center space-x-2 px-3 py-1 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                                    >
                                        <Folder size={16} />
                                        <span>Add Category</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => openAddSoundModal()}
                                    className="flex items-center space-x-2 px-3 py-1 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                                >
                                    <Plus size={16} />
                                    <span>Add Sound</span>
                                </button>
                            </div>
                        </div>
                        <div className="text-sm mt-1">Sounds are disabled in edit mode</div>
                    </div>
                )}

                {isSplitView ? (
                    /* SPLIT VIEW LAYOUT */
                    <div className="flex flex-col space-y-4">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 divide-y xl:divide-y-0 xl:divide-x divide-dark-700">
                            <div className="pr-0 xl:pr-4">
                                {renderPanelSection('characters')}
                            </div>
                            <div className="pt-6 xl:pt-0 xl:pl-4">
                                {renderPanelSection('environment')}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* STANDARD SINGLE TAB VIEW LAYOUT */
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Standard Sidebar */}
                        <div className="w-full lg:w-64 shrink-0 bg-dark-800 rounded-xl p-4 flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold">Categories</h2>
                                <button
                                    onClick={() => setEditMode(!editMode)}
                                    className={`px-3 py-2 rounded-lg transition-colors ${editMode ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                        }`}
                                    title="Toggle Edit Mode"
                                >
                                    <Edit size={16} />
                                </button>
                            </div>

                            <div className="flex space-x-2 mb-4">
                                <button
                                    onClick={() => { setTabType('characters'); setActiveTab(characters[0]?.id || '') }}
                                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${tabType === 'characters' ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                        }`}
                                >
                                    Characters
                                </button>
                                <button
                                    onClick={() => { setTabType('environment'); setActiveTab(environmentSounds[0]?.category || '') }}
                                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${tabType === 'environment' ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                        }`}
                                >
                                    Environment
                                </button>
                            </div>

                            <div className="space-y-2 flex-1 overflow-y-auto no-scrollbar">
                                {tabType === 'characters' && characters.map(char => (
                                    <div key={char.id} className="relative group">
                                        <button
                                            onClick={() => setActiveTab(char.id)}
                                            className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${activeTab === char.id ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                                } ${editMode ? 'pt-8' : ''}`}
                                        >
                                            <User className="shrink-0" size={16} />
                                            <span className="truncate">{char.name}</span>
                                        </button>
                                        {editMode && (
                                            <>
                                                <button
                                                    onClick={() => handleDeleteCharacter(char.id)}
                                                    className="absolute top-1 left-1 p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Delete Character"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleEditCharacter(char.id)}
                                                    className="absolute top-1 right-1 p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Edit Character"
                                                >
                                                    <Edit size={12} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}

                                {tabType === 'environment' && environmentSounds.map(cat => (
                                    <div key={cat.category} className="relative group">
                                        <button
                                            onClick={() => setActiveTab(cat.category)}
                                            className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${activeTab === cat.category ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                                } ${editMode ? 'pt-8' : ''}`}
                                        >
                                            <Music className="shrink-0" size={16} />
                                            <span className="truncate">{cat.category}</span>
                                        </button>
                                        {editMode && (
                                            <>
                                                <button
                                                    onClick={() => handleDeleteCategory(cat.category)}
                                                    className="absolute top-1 left-1 p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Delete Category"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleEditCategory(cat.category)}
                                                    className="absolute top-1 right-1 p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Edit Category"
                                                >
                                                    <Edit size={12} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Standard Sound Grid */}
                        <div className="flex-1 min-w-0 bg-dark-800 rounded-xl p-6">
                            <h2 className="text-xl font-semibold mb-4 truncate">
                                {activeCharacter ? activeCharacter.name : activeEnvironmentCategory?.category}
                            </h2>
                            <div className="flex flex-wrap gap-4">
                                {(activeCharacter?.sounds || activeEnvironmentCategory?.sounds || []).map(sound => renderSoundCard(
                                    sound,
                                    activeCharacter ? 'character' : 'environment',
                                    activeCharacter ? activeCharacter.id : activeEnvironmentCategory?.category
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Sound Modal */}
            {showSoundModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">
                                    {editingSound ? 'Edit Sound' : 'Add New Sound'}
                                </h2>
                                <button
                                    onClick={() => setShowSoundModal(false)}
                                    className="p-1 hover:bg-dark-700 rounded-lg"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSoundFormSubmit}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Sound Name *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={soundFormData.name}
                                            onChange={handleSoundFormChange}
                                            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Sound Type</label>
                                        <input
                                            type="text"
                                            name="type"
                                            value={soundFormData.type}
                                            onChange={handleSoundFormChange}
                                            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-500"
                                            placeholder="e.g., Fire, Healing, Ambience"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Upload Icon File</label>
                                        <input
                                            type="file"
                                            accept=".svg,.png,.jpg,.jpeg,.gif,.webp"
                                            onChange={handleIconUpload}
                                            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-500 file:bg-dark-600 file:border-0 file:text-slate-300 file:mr-4"
                                        />
                                    </div>

                                    <div>
                                        {/* Enhanced Icon Preview */}
                                        {(iconPreview || soundFormData.icon) && (
                                            <div className="mb-4 p-4 bg-dark-800 rounded-lg border border-dark-700">
                                                <label className="block text-sm font-medium mb-2">Icon Preview</label>
                                                <div className="flex flex-col items-center justify-center space-y-2">
                                                    <img
                                                        src={tintedPreview || iconPreview || loadedFormIcon || `/assets/${soundFormData.icon}`}
                                                        alt="Icon preview"
                                                        className="w-16 h-16 object-contain"
                                                    />
                                                    <div className="text-center">
                                                        <div className="text-sm text-slate-300">{soundFormData.icon}</div>
                                                        {iconPreview && (
                                                            <button
                                                                type="button"
                                                                onClick={clearIconUpload}
                                                                className="mt-1 text-xs text-red-400 hover:text-red-300"
                                                            >
                                                                Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-xs text-slate-500 mb-1">Gray images are easier to color</p>
                                        <label className="block text-sm font-medium mb-1">Tint (Optional)</label>
                                        <div className="space-y-3">
                                            <div className="flex space-x-2">
                                                <input
                                                    type="color"
                                                    name="color"
                                                    value={soundFormData.color}
                                                    onChange={handleSoundFormChange}
                                                    className="w-10 h-10 cursor-pointer rounded-lg border border-dark-600"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setSoundFormData(prev => ({ ...prev, color: '#84cc16' }))}
                                                    className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${soundFormData.color === '#84cc16'
                                                        ? 'bg-lime-600 border-lime-500 text-white'
                                                        : 'bg-dark-700 border-dark-600 hover:bg-dark-600'
                                                        }`}
                                                >
                                                    Default
                                                </button>
                                            </div>

                                            {soundFormData.color !== '#84cc16' && (
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">Brightness: {Math.round((soundFormData.brightness || 1) * 100)}%</label>
                                                    <div className="flex items-center space-x-3">
                                                        <input
                                                            type="range"
                                                            name="brightness"
                                                            min="0"
                                                            max="2"
                                                            step="0.01"
                                                            value={soundFormData.brightness || 1}
                                                            onChange={handleSoundFormChange}
                                                            className="flex-1 slider"
                                                        />
                                                        <input
                                                            type="number"
                                                            name="brightness"
                                                            min="0"
                                                            max="200"
                                                            step="1"
                                                            value={Math.round((soundFormData.brightness || 1) * 100)}
                                                            onChange={(e) => {
                                                                const value = Math.max(0, Math.min(200, parseInt(e.target.value) || 100)) / 100;
                                                                setSoundFormData(prev => ({ ...prev, brightness: value }));
                                                            }}
                                                            className="w-20 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1">Upload Audio Files *</label>
                                            <input
                                                type="file"
                                                accept=".mp3,.wav,.ogg"
                                                multiple
                                                onChange={handleMultipleAudioUpload}
                                                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-500 file:bg-dark-600 file:border-0 file:text-slate-300 file:mr-4"
                                            />

                                            {/* Multiple files preview */}
                                            {audioFiles.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-slate-400">
                                                            {audioFiles.length} file{audioFiles.length !== 1 ? 's' : ''} uploaded
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={clearMultipleAudioUpload}
                                                            className="text-xs text-red-400 hover:text-red-300"
                                                        >
                                                            Remove All
                                                        </button>
                                                    </div>

                                                    {audioFiles.map((fileObj, index) => (
                                                        <div key={index} className="flex items-center justify-between bg-dark-800 rounded-lg p-2">
                                                            <div className="flex items-center space-x-2">
                                                                <audio controls src={fileObj.preview} className="w-32" />
                                                                <span className="text-xs text-slate-400 truncate max-w-[120px]">{fileObj.name}</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeAudioFile(index)}
                                                                className="text-xs text-red-400 hover:text-red-300 p-1"
                                                                title="Remove file"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Random playback option */}
                                            {audioFiles.length > 1 && (
                                                <div className="flex items-center space-x-3 mt-3">
                                                    <input
                                                        type="checkbox"
                                                        name="randomPlay"
                                                        id="randomPlay"
                                                        checked={soundFormData.randomPlay}
                                                        onChange={(e) => setSoundFormData(prev => ({ ...prev, randomPlay: e.target.checked }))}
                                                        className="w-4 h-4 text-lime-500 bg-dark-700 border-dark-600 rounded focus:ring-lime-500"
                                                    />
                                                    <label htmlFor="randomPlay" className="text-sm">
                                                        Play random file from selection
                                                    </label>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Duration (s)</label>
                                                <input
                                                    type="number"
                                                    name="duration"
                                                    value={soundFormData.duration}
                                                    onChange={handleSoundFormChange}
                                                    min="0"
                                                    step="0.1"
                                                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Fade In (s)</label>
                                                <input
                                                    type="number"
                                                    name="fadeIn"
                                                    value={soundFormData.fadeIn}
                                                    onChange={handleSoundFormChange}
                                                    min="0"
                                                    step="0.1"
                                                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Fade Out (s)</label>
                                                <input
                                                    type="number"
                                                    name="fadeOut"
                                                    value={soundFormData.fadeOut}
                                                    onChange={handleSoundFormChange}
                                                    min="0"
                                                    step="0.1"
                                                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-3">
                                            <input
                                                type="checkbox"
                                                name="loop"
                                                id="loop"
                                                checked={soundFormData.loop}
                                                onChange={handleSoundFormChange}
                                                className="w-4 h-4 text-lime-500 bg-dark-700 border-dark-600 rounded focus:ring-lime-500"
                                            />
                                            <label htmlFor="loop" className="text-sm">
                                                Loop sound continuously
                                            </label>
                                        </div>

                                        {/* Glow Effect Controls */}
                                        <div className="pt-4 border-t border-dark-700">
                                            <h3 className="text-lg font-medium mb-3">Glow Effect</h3>

                                            {/* Glow Toggle */}
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center space-x-2">
                                                    <Sparkles size={20} className="text-lime-500" />
                                                    <span className="text-slate-300">Enable Glow Effect</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSoundFormData(prev => ({ ...prev, glowEnabled: !prev.glowEnabled }))}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${soundFormData.glowEnabled ? 'bg-lime-600' : 'bg-dark-600'
                                                        }`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${soundFormData.glowEnabled ? 'translate-x-6' : 'translate-x-1'
                                                        }`} />
                                                </button>
                                            </div>

                                            {/* Glow Prominence Slider */}
                                            {soundFormData.glowEnabled && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-slate-400">Glow Prominence</span>
                                                        <span className="text-sm text-slate-300">{Math.round(soundFormData.glowProminence * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        name="glowProminence"
                                                        min="0"
                                                        max="1"
                                                        step="0.01"
                                                        value={soundFormData.glowProminence}
                                                        onChange={handleSoundFormChange}
                                                        className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer slider"
                                                    />
                                                    <div className="flex justify-between text-xs text-slate-500">
                                                        <span>Subtle</span>
                                                        <span>Prominent</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-4 border-t border-dark-700">
                                            <div className="flex justify-end space-x-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowSoundModal(false)}
                                                    className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={!soundFormData.name.trim() || (!soundFormData.file && audioFiles.length === 0 && !soundFormData.files?.length)}
                                                    className="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors disabled:bg-dark-600 disabled:text-slate-500 disabled:cursor-not-allowed"
                                                >
                                                    {editingSound ? 'Save Changes' : 'Add Sound'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Character Modal */}
            {showCharacterModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-800 rounded-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">{editingCharacter ? 'Edit Character' : 'Add New Character'}</h2>
                                <button
                                    onClick={() => setShowCharacterModal(false)}
                                    className="p-1 hover:bg-dark-700 rounded-lg"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleCharacterFormSubmit}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Character Name *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={characterFormData.name}
                                            onChange={handleCharacterFormChange}
                                            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-500"
                                            placeholder="e.g., Elf Sorcerer, Human Paladin"
                                            required
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-dark-700">
                                        <div className="flex justify-end space-x-3">
                                            <button
                                                type="button"
                                                onClick={() => setShowCharacterModal(false)}
                                                className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={!characterFormData.name.trim()}
                                                className="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors disabled:bg-dark-600 disabled:text-slate-500 disabled:cursor-not-allowed"
                                            >
                                                {editingCharacter ? 'Save Changes' : 'Add Character'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-800 rounded-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">{editingCategory ? 'Edit Category' : 'Add New Category'}</h2>
                                <button
                                    onClick={() => setShowCategoryModal(false)}
                                    className="p-1 hover:bg-dark-700 rounded-lg"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleCategoryFormSubmit}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Category Name *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={categoryFormData.name}
                                            onChange={handleCategoryFormChange}
                                            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-500"
                                            placeholder="e.g., Forest, Tavern, Battlefield"
                                            required
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-dark-700">
                                        <div className="flex justify-end space-x-3">
                                            <button
                                                type="button"
                                                onClick={() => setShowCategoryModal(false)}
                                                className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={!categoryFormData.name.trim()}
                                                className="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors disabled:bg-dark-600 disabled:text-slate-500 disabled:cursor-not-allowed"
                                            >
                                                {editingCategory ? 'Save Changes' : 'Add Category'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-800 rounded-xl max-w-md w-full">
                        <div className="p-6">
                            <h2 className="text-xl font-bold mb-4">Confirm Delete</h2>
                            <p className="text-slate-300 mb-6">
                                Are you sure you want to delete this {deleteType}? This action cannot be undone.
                            </p>
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">Background Settings</h2>
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="p-1 hover:bg-dark-700 rounded-lg"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Background Type Selection */}
                                <div>
                                    <h3 className="text-lg font-medium mb-3">Background Type</h3>
                                    <div className="flex space-x-2 mb-4">
                                        <button
                                            onClick={() => handleBackgroundSettingsChange('type', 'color')}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${backgroundSettings.type === 'color'
                                                ? 'bg-lime-600 text-white'
                                                : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                                }`}
                                        >
                                            Color Theme
                                        </button>
                                        <button
                                            onClick={() => handleBackgroundSettingsChange('type', 'image')}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${backgroundSettings.type === 'image'
                                                ? 'bg-lime-600 text-white'
                                                : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                                }`}
                                        >
                                            Background Image
                                        </button>
                                    </div>
                                </div>

                                {/* Theme Selection */}
                                <div>
                                    <h3 className="text-lg font-medium mb-3">Select Theme</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {Object.entries(predefinedThemes).map(([key, theme]) => (
                                            <button
                                                key={key}
                                                onClick={() => {
                                                    handleBackgroundSettingsChange('theme', key)
                                                    handleBackgroundSettingsChange('type', 'color')
                                                }}
                                                className={`p-3 rounded-lg transition-colors text-center ${backgroundSettings.theme === key
                                                    ? 'bg-lime-600 text-white'
                                                    : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                                    }`}
                                            >
                                                <div
                                                    className="w-8 h-8 rounded-full mx-auto mb-2 border-2 border-white/20"
                                                    style={{ backgroundColor: theme.primary }}
                                                />
                                                {theme.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom Color Picker */}
                                <div>
                                    <h3 className="text-lg font-medium mb-3">Custom Color Theme</h3>
                                    <div className="flex items-center space-x-3">
                                        <span className="text-sm text-slate-400">Custom Color:</span>
                                        <input
                                            type="color"
                                            value={backgroundSettings.color}
                                            onChange={(e) => {
                                                handleBackgroundSettingsChange('theme', e.target.value)
                                                handleBackgroundSettingsChange('type', 'color')
                                            }}
                                            className="w-12 h-8 rounded border border-dark-600 cursor-pointer"
                                        />
                                        <span className="text-sm text-slate-400">
                                            {backgroundSettings.theme !== 'default' && !predefinedThemes[backgroundSettings.theme] ? backgroundSettings.theme : 'Select a color'}
                                        </span>
                                    </div>
                                </div>

                                {/* Image Upload Section */}
                                <div>
                                    <h3 className="text-lg font-medium mb-3">Background Image</h3>

                                    {/* Loading Indicator */}
                                    {backgroundSettings.isLoading && (
                                        <div className="border-2 border-dashed border-lime-500 rounded-lg p-4 text-center mb-4">
                                            <div className="text-lime-500 mb-2">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-500 mx-auto"></div>
                                            </div>
                                            <span className="text-lime-400">Loading image...</span>
                                        </div>
                                    )}

                                    {/* File Upload Area */}
                                    {!backgroundSettings.isLoading && (
                                        <div className="border-2 border-dashed border-dark-600 rounded-lg p-4 text-center mb-4">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="hidden"
                                                id="background-image-upload"
                                            />
                                            <label
                                                htmlFor="background-image-upload"
                                                className="cursor-pointer block"
                                            >
                                                <div className="text-slate-400 mb-2">
                                                    <Folder size={32} className="mx-auto" />
                                                </div>
                                                <span className="text-slate-300">Click to select an image</span>
                                                <p className="text-xs text-slate-500 mt-1">Max 5MB, PNG/JPG/WebP</p>
                                            </label>
                                        </div>
                                    )}

                                    {/* Image Preview or Empty State */}
                                    {backgroundSettings.imagePreview ? (
                                        <div className="mb-4">
                                            <h4 className="text-sm font-medium mb-2">Preview:</h4>
                                            <div
                                                className="w-full h-32 bg-cover bg-center rounded-lg border border-dark-600"
                                                style={{ backgroundImage: `url(${backgroundSettings.imagePreview})` }}
                                            />
                                            <button
                                                onClick={() => {
                                                    handleBackgroundSettingsChange('imagePreview', '')
                                                    handleBackgroundSettingsChange('imageFile', null)
                                                    handleBackgroundSettingsChange('type', 'color')
                                                    handleBackgroundSettingsChange('theme', 'default')
                                                }}
                                                className="mt-2 w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                                            >
                                                Remove Image
                                            </button>
                                        </div>
                                    ) : (
                                        !backgroundSettings.isLoading && backgroundSettings.type === 'image' && (
                                            <div className="text-center py-4">
                                                <span className="text-slate-400">No image selected</span>
                                            </div>
                                        )
                                    )}
                                </div>

                                {/* Legal Section */}
                                <div className="pt-4 border-t border-dark-700">
                                    <button
                                        onClick={() => {
                                            setShowSettingsModal(false)
                                            setShowAboutModal(true)
                                        }}
                                        className="w-full px-4 py-2 bg-dark-700 hover:bg-dark-600 text-slate-300 rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
                                    >
                                        <Info size={16} />
                                        <span>Legal & Credits</span>
                                    </button>
                                </div>

                                {/* Close Button */}
                                <div className="pt-4 border-t border-dark-700">
                                    <button
                                        onClick={() => setShowSettingsModal(false)}
                                        className="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors w-full"
                                    >
                                        Close Settings
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* About & Credits Modal */}
            {showAboutModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">About The SpellCaster</h2>
                                <button
                                    onClick={() => setShowAboutModal(false)}
                                    className="p-1 hover:bg-dark-700 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6 text-sm text-slate-300">
                                {/* App Info */}
                                <div className="flex flex-col items-center justify-center p-4 bg-dark-900 rounded-lg border border-dark-700">
                                    <img src="/assets/Icon.png" alt="App Icon" className="h-12 w-12 mb-2" />
                                    <h3 className="text-lg font-bold text-white font-magic tracking-wider">The SpellCaster</h3>
                                    <p className="text-slate-400 mt-1">Version 0.1.0</p>
                                </div>

                                {/* Typography Credit */}
                                <div>
                                    <h3 className="text-base font-medium text-white mb-2">Typography</h3>
                                    <p className="bg-dark-700 p-3 rounded-lg border border-dark-600">
                                        Custom fonts provided under the 1001Fonts Free For Commercial Use License.
                                    </p>
                                </div>

                                {/* Lucide Icons License (Mandatory) */}
                                <div>
                                    <h3 className="text-base font-medium text-white mb-2">Iconography (Lucide)</h3>
                                    <div className="bg-dark-700 p-3 rounded-lg border border-dark-600 text-xs text-slate-400 space-y-2 font-mono h-40 overflow-y-auto no-scrollbar">
                                        <p>ISC License</p>
                                        <p>Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.</p>
                                        <p>Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.</p>
                                        <p>THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.</p>
                                    </div>
                                </div>

                                {/* Close Button */}
                                <div className="pt-4 border-t border-dark-700">
                                    <button
                                        onClick={() => setShowAboutModal(false)}
                                        className="w-full px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors font-medium"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App