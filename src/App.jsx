import { useState, useEffect, useRef } from 'react'
import { User, Music, Volume2, VolumeX, Settings, Flame, Zap, Shield, Sword, Heart, Cloud, CloudRain, Wind, Droplets, X, Plus, Edit, Trash2, Folder, Sparkles, Square, ZoomIn, Shuffle, Infinity } from 'lucide-react'
import data from './data.json'

// Environment detection
const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined

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

function App() {
    // Load from localStorage first, fallback to data.json if it's a first-time load
    const [characters, setCharacters] = useState(() => {
        const savedCharacters = localStorage.getItem('ttrpg_characters')
        return savedCharacters ? JSON.parse(savedCharacters) : data.characters
    })

    const [environmentSounds, setEnvironmentSounds] = useState(() => {
        const savedEnvironment = localStorage.getItem('ttrpg_environment')
        return savedEnvironment ? JSON.parse(savedEnvironment) : data.environmentSounds
    })
    const [tabType, setTabType] = useState('characters')
    const [activeTab, setActiveTab] = useState('')
    const [editMode, setEditMode] = useState(false)
    const [audioEnabled, setAudioEnabled] = useState(false)
    const [masterVolume, setMasterVolume] = useState(1.0)
    const [soundInstances, setSoundInstances] = useState({})
    const audioElementsRef = useRef(new Map())

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
    const [characterFormData, setCharacterFormData] = useState({
        name: ''
    })

    // Category management states
    const [showCategoryModal, setShowCategoryModal] = useState(false)
    const [categoryFormData, setCategoryFormData] = useState({
        name: ''
    })

    // Settings modal state
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const [backgroundSettings, setBackgroundSettings] = useState({
        type: 'color',
        theme: 'default',
        color: '#84cc16',
        imageFile: null,
        imagePreview: '',
        isLoading: false
    })

    // Box size state with localStorage persistence
    const [boxSize, setBoxSize] = useState(() => {
        const savedBoxSize = localStorage.getItem('boxSize')
        return savedBoxSize ? parseFloat(savedBoxSize) : 1.0
    })

    // State for storing loaded image URLs
    const [loadedIcons, setLoadedIcons] = useState({})
    const [loadedFormIcon, setLoadedFormIcon] = useState('')

    // File upload states
    const [audioFile, setAudioFile] = useState(null)
    const [iconFile, setIconFile] = useState(null)
    const [audioPreview, setAudioPreview] = useState('')
    const [iconPreview, setIconPreview] = useState('')

    // Multiple file upload states
    const [audioFiles, setAudioFiles] = useState([])
    const [audioPreviews, setAudioPreviews] = useState([])

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
        setMasterVolume(volume)

        if (volume > 0 && !audioEnabled) {
            setAudioEnabled(true)
        }

        audioElementsRef.current.forEach((audio, soundKey) => {
            if (audio && typeof audio.volume !== 'undefined') {
                audio.volume = audioEnabled ? volume : 0
            }
        })
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
        setAudioFile(null)
        setIconFile(null)
        setAudioPreview('')
        setIconPreview('')

        setAudioFiles([])
        setAudioPreviews([])

        setEditingSound(null)
        setShowSoundModal(true)
    }

    const openEditSoundModal = async (sound) => {
        const loopValue = sound.loop !== undefined ? sound.loop : tabType === 'environment'

        setAudioFile(null)
        setIconFile(null)
        setAudioPreview('')

        if (sound.files && sound.files.length > 0) {
            const existingFiles = await Promise.all(sound.files.map(async file => ({
                file: null,
                preview: await getFileFromLocalStorage(file.name) || `/assets/${file.name}`,
                name: file.name
            })))
            setAudioFiles(existingFiles)
            setAudioPreviews(existingFiles.map(f => f.preview))
        } else {
            setAudioFiles([])
            setAudioPreviews([])
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

    const deleteSound = (soundId) => {
        if (tabType === 'characters' && activeCharacter) {
            setCharacters(prev => prev.map(character =>
                character.id === currentActiveCharId
                    ? {
                        ...character,
                        sounds: character.sounds.filter(sound => sound.id !== soundId)
                    }
                    : character
            ))
        } else if (tabType === 'environment' && activeEnvironmentCategory) {
            setEnvironmentSounds(prev => prev.map(category =>
                category.category === currentActiveEnvId
                    ? {
                        ...category,
                        sounds: category.sounds.filter(sound => sound.id !== soundId)
                    }
                    : category
            ))
        }
    }

    const handleAudioUpload = (e) => {
        const file = e.target.files[0]
        if (file) {
            setAudioFile(file)
            setAudioPreview(URL.createObjectURL(file))
            setSoundFormData(prev => ({ ...prev, file: file.name }))
            storeFileInLocalStorage(file.name, file)
        }
    }

    const handleIconUpload = (e) => {
        const file = e.target.files[0]
        if (file) {
            setIconFile(file)
            setIconPreview(URL.createObjectURL(file))
            setSoundFormData(prev => ({ ...prev, icon: file.name }))
            storeFileInLocalStorage(file.name, file)
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
                    return URL.createObjectURL(blob)
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
                preview: URL.createObjectURL(file),
                name: file.name
            }))

            setAudioFiles(prev => [...prev, ...newFiles])
            setAudioPreviews(prev => [...prev, ...newFiles.map(f => f.preview)])

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
        setAudioPreviews(prev => prev.filter((_, i) => i !== index))

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
        setAudioPreviews([])
        setSoundFormData(prev => ({ ...prev, files: [] }))
    }

    const clearAudioUpload = async () => {
        if (soundFormData.file) {
            await removeFileFromLocalStorage(soundFormData.file)
        }
        setAudioFile(null)
        setAudioPreview('')
        setSoundFormData(prev => ({ ...prev, file: '' }))
    }

    const clearIconUpload = async () => {
        if (soundFormData.icon) {
            await removeFileFromLocalStorage(soundFormData.icon)
        }
        setIconFile(null)
        setIconPreview('')
        setSoundFormData(prev => ({ ...prev, icon: '' }))
    }

    const openAddCharacterModal = () => {
        setCharacterFormData({ name: '' })
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

        if (!characterFormData.name.trim()) {
            return
        }

        addCharacter(characterFormData)
        setShowCharacterModal(false)
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
            setBackgroundSettings(JSON.parse(savedSettings))
        }
        setShowSettingsModal(true)
    }

    const handleBackgroundSettingsChange = (key, value) => {
        setBackgroundSettings(prevSettings => {
            const newSettings = {
                ...prevSettings,
                [key]: value
            }

            applyBackgroundSettings(newSettings)
            localStorage.setItem('backgroundSettings', JSON.stringify(newSettings))

            return newSettings
        })
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

        const hue = getHueFromRGB(r, g, b)
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

    const getHueFromRGB = (r, g, b) => {
        r /= 255; g /= 255; b /= 255
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
        return h * 360
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
                    ...backgroundSettings,
                    imagePreview: event.target.result,
                    imageFile: file,
                    isLoading: false
                }
                setBackgroundSettings(updatedSettings)
                applyBackgroundSettings(updatedSettings)
                localStorage.setItem('backgroundSettings', JSON.stringify(updatedSettings))
            }
            reader.onerror = () => {
                alert('Error loading image file')
                const errorSettings = {
                    ...backgroundSettings,
                    isLoading: false
                }
                setBackgroundSettings(errorSettings)
                localStorage.setItem('backgroundSettings', JSON.stringify(errorSettings))
            }
            reader.readAsDataURL(file)
        }
    }

    const resetToDefault = () => {
        const defaultSettings = {
            type: 'color',
            theme: 'default',
            color: '#84cc16',
            imageFile: null,
            imagePreview: '',
            isLoading: false
        }
        setBackgroundSettings(defaultSettings)
        applyBackgroundSettings(defaultSettings)
        localStorage.setItem('backgroundSettings', JSON.stringify(defaultSettings))
    }

    const handleCategoryFormSubmit = (e) => {
        e.preventDefault()

        if (!categoryFormData.name.trim()) {
            return
        }

        addCategory(categoryFormData)
        setShowCategoryModal(false)
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
        setEnvironmentSounds(prev => prev.filter(category => category.category !== categoryName))
        if (activeTab === categoryName) setActiveTab('')
        if (activeEnvironmentId === categoryName) setActiveEnvironmentId('')
    }

    const handleEditCharacter = (characterId) => {
        console.log('Edit character:', characterId)
    }

    const handleEditCategory = (categoryName) => {
        console.log('Edit category:', categoryName)
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
        } catch (error) {
            console.error('Failed to remove local file:', error)
        }
    }

    const playSound = async (sound) => {
        if (editMode) return

        if (!audioEnabled) {
            enableAudio()
            return
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
        audio.loop = sound.loop || false
        audio.volume = audioEnabled ? masterVolume : 0

        const audioInstanceKey = `${soundKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        audioElementsRef.current.set(audioInstanceKey, audio)

        setSoundInstances(prev => ({
            ...prev,
            [audioInstanceKey]: true
        }))

        if (!sound.loop && sound.duration > 0) {
            const timerDuration = sound.duration * 1000

            const timer = setTimeout(() => {
                audio.pause()
                audio.currentTime = 0

                audioElementsRef.current.delete(audioInstanceKey)

                setSoundInstances(prev => {
                    const newState = { ...prev }
                    delete newState[audioInstanceKey]
                    return newState
                })
            }, timerDuration)

            audio.timer = timer
        }

        audio.addEventListener('ended', () => {
            if (audio.timer) {
                clearTimeout(audio.timer)
            }

            audioElementsRef.current.delete(audioInstanceKey)

            setSoundInstances(prev => {
                const newState = { ...prev }
                delete newState[audioInstanceKey]
                return newState
            })
        })

        audio.play().catch(error => {
            console.error('Error playing sound:', error)
            audioElementsRef.current.delete(audioInstanceKey)

            setSoundInstances(prev => {
                const newState = { ...prev }
                delete newState[audioInstanceKey]
                return newState
            })
        })
    }

    const isSoundPlaying = (soundId) => {
        return Object.keys(soundInstances).some(key => key.startsWith(`${soundId}_`))
    }

    const stopSound = (sound) => {
        if (editMode) return

        const soundKey = sound.id

        const audioInstances = Array.from(audioElementsRef.current.entries())
            .filter(([key, _]) => key.startsWith(`${soundKey}_`))

        audioInstances.forEach(([instanceKey, audio]) => {
            if (audio) {
                audio.pause()
                audio.currentTime = 0

                if (audio.timer) {
                    clearTimeout(audio.timer)
                }
            }

            audioElementsRef.current.delete(instanceKey)

            setSoundInstances(prev => {
                const newState = { ...prev }
                delete newState[instanceKey]
                return newState
            })
        })
    }

    const stopAllSounds = () => {
        if (editMode) return

        const audioInstances = Array.from(audioElementsRef.current.entries())

        audioInstances.forEach(([instanceKey, audio]) => {
            if (audio) {
                audio.pause()
                audio.currentTime = 0

                if (audio.timer) {
                    clearTimeout(audio.timer)
                }
            }

            audioElementsRef.current.delete(instanceKey)
        })

        setSoundInstances({})
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
            const settings = JSON.parse(savedSettings)
            setBackgroundSettings(settings)
            applyBackgroundSettings(settings)
        }
    }, [])

    // Render individual sound card
    const renderSoundCard = (sound) => {
        const isPlaying = isSoundPlaying(sound.id)
        const IconComponent = getSoundIcon(sound.type)

        return (
            <div
                key={sound.id}
                className="group relative shrink-0"
                style={{ width: `${140 * boxSize}px` }}
            >
                <button
                    onClick={async () => await playSound(sound)}
                    className={`w-full aspect-square bg-dark-700 border rounded-xl hover:bg-dark-600 transition-all duration-200 flex flex-col items-center justify-center overflow-hidden ${isPlaying ? 'ring-2 ring-lime-500' : ''
                        } ${editMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{
                        backgroundColor: 'var(--theme-bg-secondary)',
                        borderColor: sound.color,
                        padding: `${8 * boxSize}px`,
                        borderRadius: `${12 * boxSize}px`,
                        ...getGlowEffectStyle(sound)
                    }}
                    disabled={editMode}
                >
                    <div
                        className="flex flex-col items-center justify-center w-full"
                        style={{
                            marginBottom: `${4 * boxSize}px`
                        }}
                    >
                        {sound.icon ? (
                            <img
                                src={loadedIcons[sound.icon] || `/assets/${sound.icon}`}
                                alt={sound.name}
                                className="mb-1 object-contain shrink-0"
                                style={{
                                    width: `${48 * boxSize}px`,
                                    height: `${48 * boxSize}px`,
                                    ...(sound.color !== '#84cc16' ? {
                                        filter: `sepia(0.5) saturate(200%) hue-rotate(${getHueRotateFromColor(sound.color)}deg) brightness(${sound.brightness || 1})`
                                    } : {})
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
                            <Infinity
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
                </button>

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
                                <button
                                    key={c.id}
                                    onClick={() => setActive(c.id)}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-base flex items-center space-x-3 transition-colors ${currentActiveId === c.id ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                        }`}
                                >
                                    <User className="shrink-0" size={16} />
                                    <span className="truncate">{c.name}</span>
                                </button>
                            ))
                            : environmentSounds.map(e => (
                                <button
                                    key={e.category}
                                    onClick={() => setActive(e.category)}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-base flex items-center space-x-3 transition-colors ${currentActiveId === e.category ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                        }`}
                                >
                                    <Music className="shrink-0" size={16} />
                                    <span className="truncate">{e.category}</span>
                                </button>
                            ))}
                    </div>
                </div>

                {/* Sound Grid */}
                <div className="flex-1 min-w-0 bg-dark-800 rounded-xl p-4">
                    <h2 className="text-lg font-semibold mb-4 text-slate-200 truncate">
                        {activeItem ? (isCharSection ? activeItem.name : activeItem.category) : 'Select Category'}
                    </h2>
                    <div className="flex flex-wrap gap-4">
                        {activeItem?.sounds?.map(sound => renderSoundCard(sound))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="app-container min-h-screen bg-dark-900 text-slate-200">
            {/* Header */}
            <header className="bg-dark-800 border-b border-dark-700">
                <div className="w-full px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <Music className="text-lime-500" size={32} />
                                <h1 className="text-2xl font-bold">TTRPG Soundboard</h1>
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

                        <div className="flex items-center space-x-4">
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
                                <span className="text-sm text-slate-400 w-8">{Math.round(masterVolume * 100)}%</span>
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
                                <span className="text-sm text-slate-400 w-8">{Math.round(boxSize * 100)}%</span>
                            </div>

                            {/* Stop All Sounds Button */}
                            <button
                                onClick={stopAllSounds}
                                disabled={Object.keys(soundInstances).length === 0 || editMode}
                                className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-dark-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                                title="Stop All Sounds"
                            >
                                <Square size={20} />
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
                                    <button
                                        key={char.id}
                                        onClick={() => setActiveTab(char.id)}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${activeTab === char.id ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                            }`}
                                    >
                                        <User className="shrink-0" size={16} />
                                        <span className="truncate">{char.name}</span>
                                    </button>
                                ))}

                                {tabType === 'environment' && environmentSounds.map(cat => (
                                    <button
                                        key={cat.category}
                                        onClick={() => setActiveTab(cat.category)}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${activeTab === cat.category ? 'bg-lime-600 text-white' : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                                            }`}
                                    >
                                        <Music className="shrink-0" size={16} />
                                        <span className="truncate">{cat.category}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Standard Sound Grid */}
                        <div className="flex-1 min-w-0 bg-dark-800 rounded-xl p-6">
                            <h2 className="text-xl font-semibold mb-4 truncate">
                                {activeCharacter ? activeCharacter.name : activeEnvironmentCategory?.category}
                            </h2>
                            <div className="flex flex-wrap gap-4">
                                {(activeCharacter?.sounds || activeEnvironmentCategory?.sounds || []).map(sound => renderSoundCard(sound))}
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
                                                        src={iconPreview || loadedFormIcon || `/assets/${soundFormData.icon}`}
                                                        alt="Icon preview"
                                                        className="w-16 h-16 object-contain"
                                                        style={soundFormData.color !== '#84cc16' ? {
                                                            filter: `sepia(0.5) saturate(200%) hue-rotate(${getHueRotateFromColor(soundFormData.color)}deg) brightness(${soundFormData.brightness || 1})`
                                                        } : {}}
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
                                                    disabled={!soundFormData.name.trim() || (!audioFile && !soundFormData.file && audioFiles.length === 0 && !soundFormData.files?.length)}
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
                                <h2 className="text-xl font-bold">Add New Character</h2>
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
                                                Add Character
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
                                <h2 className="text-xl font-bold">Add New Category</h2>
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
                                                Add Category
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
                                        </div>
                                    ) : (
                                        !backgroundSettings.isLoading && backgroundSettings.type === 'image' && (
                                            <div className="text-center py-4">
                                                <span className="text-slate-400">No image selected</span>
                                            </div>
                                        )
                                    )}
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
        </div>
    )
}

export default App