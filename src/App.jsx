import { useState, useEffect, useRef } from 'react'
import { User, Music, Volume2, VolumeX, Settings, Flame, Zap, Shield, Sword, Heart, Cloud, CloudRain, Wind, Droplets, X, Plus, Edit, Trash2, Folder } from 'lucide-react'
import data from './data.json'

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
  // Handle transparent mode - use default color for hue calculation
  if (color === 'transparent') {
    color = '#84cc16' // Default color
  }
  
  // Remove # if present
  const hex = color.replace('#', '')
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  
  // Find max and min values
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  
  // Calculate hue
  if (max === min) {
    h = 0 // achromatic
  } else {
    const d = max - min
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  
  // Convert hue to degrees (0-360)
  const hueDegrees = Math.round(h * 360)
  
  // Return hue rotation value (adjust based on filter chain requirements)
  return hueDegrees
}

function App() {
  const [characters, setCharacters] = useState(data.characters)
  const [environmentSounds, setEnvironmentSounds] = useState(data.environmentSounds)
  const [tabType, setTabType] = useState('characters')
  const [activeTab, setActiveTab] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [masterVolume, setMasterVolume] = useState(1.0) // 0.0 to 1.0
  const [playingSounds, setPlayingSounds] = useState(new Set())
  const audioElementsRef = useRef(new Map())
  
  // Modal and form states
  const [showSoundModal, setShowSoundModal] = useState(false)
  const [editingSound, setEditingSound] = useState(null)
  const [soundFormData, setSoundFormData] = useState({
    name: '',
    type: '',
    icon: '',
    file: '',
    color: '#84cc16',
    brightness: 1, // 1.0 = 100% brightness, range: 0.0 to 2.0
    duration: 0,
    fadeIn: 0,
    fadeOut: 0,
    loop: false
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [deleteType, setDeleteType] = useState('') // 'sound', 'character', 'category'
  
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
  
  // File upload states
  const [audioFile, setAudioFile] = useState(null)
  const [iconFile, setIconFile] = useState(null)
  const [audioPreview, setAudioPreview] = useState('')
  const [iconPreview, setIconPreview] = useState('')

  // Get active character or environment category
  const activeCharacter = characters.find(char => char.id === activeTab)
  const activeEnvironmentCategory = environmentSounds.find(cat => cat.category === activeTab)

  // Enable audio after user interaction
  const enableAudio = () => {
    setAudioEnabled(true)
  }

  // Update master volume and apply to all playing sounds
  const updateMasterVolume = (volume) => {
    setMasterVolume(volume)
    
    // Enable audio if volume is increased from 0
    if (volume > 0 && !audioEnabled) {
      setAudioEnabled(true)
    }
    
    // Update volume for all currently playing audio elements
    audioElementsRef.current.forEach((audio, soundKey) => {
      if (audio && typeof audio.volume !== 'undefined') {
        audio.volume = audioEnabled ? volume : 0
      }
    })
  }

// Sound management functions
  const openAddSoundModal = () => {
    console.log('🎵 MODAL OPEN - Setting loop default for tab:', tabType, 'Loop:', tabType === 'environment')
    
    // Set default loop value based on tab type
    const defaultLoop = tabType === 'environment'
    
    // Reset all states
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
    setEditingSound(null)
    setShowSoundModal(true)
  }

  const openEditSoundModal = (sound) => {
    console.log('🔧 EDIT SOUND - Original:', sound.name, 'Loop:', sound.loop, 'Tab:', tabType)
    console.log('🔧 EDIT SOUND - Default loop for tab:', tabType === 'environment')
    
    // Use existing loop value or tab-based default if undefined
    const loopValue = sound.loop !== undefined ? sound.loop : tabType === 'environment'
    console.log('🔧 EDIT SOUND - New loop value:', loopValue)
    
    // Reset file states for editing
    setAudioFile(null)
    setIconFile(null)
    setAudioPreview('')
    
    // Set icon preview for existing sound
    if (sound.icon) {
      const iconUrl = getFileFromLocalStorage(sound.icon) || `/assets/${sound.icon}`
      setIconPreview(iconUrl)
    } else {
      setIconPreview('')
    }
    
    setSoundFormData({
      name: sound.name,
      type: sound.type,
      icon: sound.icon || '',
      file: sound.file || '',
      color: sound.color || '#84cc16',
      brightness: sound.brightness || 1,
      duration: sound.duration || 0,
      fadeIn: sound.fadeIn || 0,
      fadeOut: sound.fadeOut || 0,
      loop: loopValue
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
    
    console.log('🎵 ADD/EDIT SOUND - Form data:', soundFormData)
    
    // Validation based on historical pattern - require name and either file upload or existing file
    if (!soundFormData.name.trim() || (!audioFile && !soundFormData.file)) {
      console.log('Validation failed: Name and audio file required')
      return
    }
    
    if (editingSound) {
      // Update existing sound
      updateSound(editingSound.id, soundFormData)
    } else {
      // Add new sound
      addSound(soundFormData)
    }
    
    setShowSoundModal(false)
  }

  const addSound = (newSoundData) => {
    console.log('🎵 ADD SOUND - newSoundData.loop:', newSoundData.loop, 'Type:', typeof newSoundData.loop)
    console.log('🎵 ADD SOUND - Tab type:', tabType, 'Environment:', tabType === 'environment')
    
    // Generate unique ID
    const newId = `sound_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const newSound = {
      id: newId,
      name: newSoundData.name,
      type: newSoundData.type || 'Sound',
      icon: newSoundData.icon,
      file: newSoundData.file,
      color: newSoundData.color,
      brightness: newSoundData.brightness || 1,
      duration: parseFloat(newSoundData.duration) || 0,
      fadeIn: parseFloat(newSoundData.fadeIn) || 0,
      fadeOut: parseFloat(newSoundData.fadeOut) || 0,
      loop: newSoundData.loop !== undefined ? newSoundData.loop : (tabType === 'environment')
    }
    
    console.log('🎵 ADD SOUND - Final sound object loop:', newSound.loop)
    
    if (tabType === 'characters' && activeCharacter) {
      // Add to active character
      setCharacters(prev => prev.map(character => 
        character.id === activeTab 
          ? { ...character, sounds: [...character.sounds, newSound] }
          : character
      ))
    } else if (tabType === 'environment' && activeEnvironmentCategory) {
      // Add to active environment category
      setEnvironmentSounds(prev => prev.map(category =>
        category.category === activeTab
          ? { ...category, sounds: [...category.sounds, newSound] }
          : category
      ))
    }
  }

  const updateSound = (soundId, newSoundData) => {
    console.log('🔧 UPDATE SOUND - Updating sound ID:', soundId, 'with loop:', newSoundData.loop)
    
    const updatedSound = {
      ...newSoundData,
      duration: parseFloat(newSoundData.duration) || 0,
      fadeIn: parseFloat(newSoundData.fadeIn) || 0,
      fadeOut: parseFloat(newSoundData.fadeOut) || 0,
      loop: newSoundData.loop !== undefined ? newSoundData.loop : false,
    }
    
    if (tabType === 'characters' && activeCharacter) {
      // Update in active character
      setCharacters(prev => prev.map(character => 
        character.id === activeTab 
          ? { 
              ...character, 
              sounds: character.sounds.map(sound => 
                sound.id === soundId ? { ...sound, ...updatedSound } : sound
              )
            }
          : character
      ))
    } else if (tabType === 'environment' && activeEnvironmentCategory) {
      // Update in active environment category
      setEnvironmentSounds(prev => prev.map(category =>
        category.category === activeTab
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

  const handleDeleteSound = (soundId) => {
    setItemToDelete(soundId)
    setDeleteType('sound')
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    if (deleteType === 'sound' && itemToDelete) {
      deleteSound(itemToDelete)
    } else if (deleteType === 'character' && itemToDelete) {
      deleteCharacter(itemToDelete)
    } else if (deleteType === 'category' && itemToDelete) {
      deleteCategory(itemToDelete)
    }
    setShowDeleteConfirm(false)
    setItemToDelete(null)
    setDeleteType('')
  }

  const deleteSound = (soundId) => {
    if (tabType === 'characters' && activeCharacter) {
      // Delete from active character
      setCharacters(prev => prev.map(character => 
        character.id === activeTab 
          ? { 
              ...character, 
              sounds: character.sounds.filter(sound => sound.id !== soundId)
            }
          : character
      ))
    } else if (tabType === 'environment' && activeEnvironmentCategory) {
      // Delete from active environment category
      setEnvironmentSounds(prev => prev.map(category =>
        category.category === activeTab
          ? {
              ...category,
              sounds: category.sounds.filter(sound => sound.id !== soundId)
            }
          : category
      ))
    }
  }

  // File upload handlers
  const handleAudioUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setAudioFile(file)
      setAudioPreview(URL.createObjectURL(file))
      setSoundFormData(prev => ({ ...prev, file: file.name }))
      // Store file in localStorage
      storeFileInLocalStorage(file.name, file)
    }
  }

  const handleIconUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setIconFile(file)
      setIconPreview(URL.createObjectURL(file))
      setSoundFormData(prev => ({ ...prev, icon: file.name }))
      // Store file in localStorage
      storeFileInLocalStorage(file.name, file)
    }
  }

  const clearAudioUpload = () => {
    if (soundFormData.file) {
      removeFileFromLocalStorage(soundFormData.file)
    }
    setAudioFile(null)
    setAudioPreview('')
    setSoundFormData(prev => ({ ...prev, file: '' }))
  }

  const clearIconUpload = () => {
    if (soundFormData.icon) {
      removeFileFromLocalStorage(soundFormData.icon)
    }
    setIconFile(null)
    setIconPreview('')
    setSoundFormData(prev => ({ ...prev, icon: '' }))
  }

  // Character management functions
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
      console.log('Validation failed: Character name required')
      return
    }
    
    addCharacter(characterFormData)
    setShowCharacterModal(false)
  }

  const addCharacter = (characterData) => {
    // Generate unique ID
    const newId = `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const newCharacter = {
      id: newId,
      name: characterData.name.trim(),
      sounds: []
    }
    
    console.log('Adding new character:', newCharacter)
    
    setCharacters(prev => [...prev, newCharacter])
    // Set the new character as active
    setActiveTab(newId)
  }

  const handleDeleteCharacter = (characterId) => {
    setItemToDelete(characterId)
    setDeleteType('character')
    setShowDeleteConfirm(true)
  }

  const deleteCharacter = (characterId) => {
    setCharacters(prev => prev.filter(character => character.id !== characterId))
    
    // If the deleted character was active, clear the active tab
    if (activeTab === characterId) {
      setActiveTab('')
    }
  }

  // Category management functions
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

  const handleCategoryFormSubmit = (e) => {
    e.preventDefault()
    
    if (!categoryFormData.name.trim()) {
      console.log('Validation failed: Category name required')
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
    
    console.log('Adding new category:', newCategory)
    
    setEnvironmentSounds(prev => [...prev, newCategory])
    // Set the new category as active
    setActiveTab(newCategory.category)
  }

  const handleDeleteCategory = (categoryName) => {
    setItemToDelete(categoryName)
    setDeleteType('category')
    setShowDeleteConfirm(true)
  }

  const deleteCategory = (categoryName) => {
    setEnvironmentSounds(prev => prev.filter(category => category.category !== categoryName))
    
    // If the deleted category was active, clear the active tab
    if (activeTab === categoryName) {
      setActiveTab('')
    }
  }

  // Edit handlers (placeholder functions for now)
  const handleEditCharacter = (characterId) => {
    console.log('Edit character:', characterId)
    // TODO: Implement character edit modal
  }

  const handleEditCategory = (categoryName) => {
    console.log('Edit category:', categoryName)
    // TODO: Implement category edit modal
  }

  // File storage functions
  const storeFileInLocalStorage = (fileName, file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      localStorage.setItem(`sound_file_${fileName}`, e.target.result)
    }
    reader.readAsDataURL(file)
  }

  const getFileFromLocalStorage = (fileName) => {
    return localStorage.getItem(`sound_file_${fileName}`)
  }

  const removeFileFromLocalStorage = (fileName) => {
    localStorage.removeItem(`sound_file_${fileName}`)
  }
  // Play sound
  const playSound = (sound) => {
    if (editMode) return // Don't play sounds in edit mode
    
    // Require user interaction first
    if (!audioEnabled) {
      console.log('Audio not enabled yet - requiring user interaction');
      enableAudio();
      return;
    }
    
    console.log('Playing sound:', sound.name, 'Sound ID:', sound.id)
    
    const soundKey = sound.id
    
    // Check if file exists in localStorage first, otherwise use /assets/
    let soundUrl
    const storedFile = getFileFromLocalStorage(sound.file)
    if (storedFile) {
      soundUrl = storedFile
      console.log('Using stored file from localStorage:', sound.file)
    } else {
      soundUrl = `/assets/${sound.file}`
      console.log('Using file from /assets/ directory:', sound.file)
    }
    
    // Stop if already playing
    if (playingSounds.has(soundKey)) {
      console.log('Stopping sound:', sound.name)
      const existingAudio = audioElementsRef.current.get(soundKey)
      if (existingAudio) {
        existingAudio.pause()
        existingAudio.currentTime = 0
        
        // Clear any active timer
        if (existingAudio.timer) {
          clearTimeout(existingAudio.timer)
        }
      }
      setPlayingSounds(prev => {
        const newSet = new Set(prev)
        newSet.delete(soundKey)
        return newSet
      })
      audioElementsRef.current.delete(soundKey)
      return
    }
    
    console.log('Playing sound:', sound.name, 'Loop property:', sound.loop, 'from URL:', soundUrl)
    
    const audio = new Audio(soundUrl)
    audio.loop = sound.loop || false // Use sound's loop property
    audio.volume = audioEnabled ? masterVolume : 0 // Apply master volume if audio is enabled
    
    audioElementsRef.current.set(soundKey, audio)
    
    // Timer functionality - only apply to non-looping sounds with duration > 0
    if (!sound.loop && sound.duration > 0) {
      console.log('Timer setup:', { soundKey, duration: sound.duration, fadeOut: sound.fadeOut })
      
      const timerDuration = sound.duration * 1000 // Convert to milliseconds
      console.log('Timer scheduled for', timerDuration, 'ms')
      
      const timer = setTimeout(() => {
        console.log('Timer fired for sound:', soundKey)
        
        // Stop the sound
        audio.pause()
        audio.currentTime = 0
        
        setPlayingSounds(prev => {
          const newSet = new Set(prev)
          newSet.delete(soundKey)
          return newSet
        })
        audioElementsRef.current.delete(soundKey)
      }, timerDuration)
      
      // Store timer for cleanup
      audio.timer = timer
    }
    
    audio.addEventListener('ended', () => {
      console.log('Sound ended:', sound.name)
      
      // Clear timer if sound ends naturally (not by timer)
      if (audio.timer) {
        clearTimeout(audio.timer)
      }
      
      setPlayingSounds(prev => {
        const newSet = new Set(prev)
        newSet.delete(soundKey)
        return newSet
      })
      audioElementsRef.current.delete(soundKey)
    })
    
    setPlayingSounds(prev => new Set(prev).add(soundKey))
    
    audio.play().then(() => {
      console.log('Sound play command sent successfully')
    }).catch(error => {
      console.error('Error playing sound:', error)
      setPlayingSounds(prev => {
        const newSet = new Set(prev)
        newSet.delete(soundKey)
        return newSet
      })
      audioElementsRef.current.delete(soundKey)
    })
  }

  // Initialize active tab
  useEffect(() => {
    if (tabType === 'characters' && characters.length > 0 && !activeTab) {
      setActiveTab(characters[0].id)
    } else if (tabType === 'environment' && environmentSounds.length > 0 && !activeTab) {
      setActiveTab(environmentSounds[0].category)
    }
  }, [tabType, characters, environmentSounds, activeTab])

  return (
    <div className="min-h-screen bg-dark-900 text-slate-200">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Music className="text-lime-500" size={32} />
                <h1 className="text-2xl font-bold">TTRPG Soundboard</h1>
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
              
              {/* Dummy Button - Reserved for future functionality */}
              <button
                className="px-4 py-2 rounded-lg bg-dark-700 text-slate-400 opacity-50 cursor-not-allowed"
                title="Reserved for future functionality"
                disabled
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-dark-800 rounded-xl p-4">
              {/* Edit Button - Moved to sidebar top left */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Categories</h2>
                <button
                  onClick={() => setEditMode(!editMode)}
                  className={`px-3 py-2 rounded-lg transition-colors ${
                    editMode 
                      ? 'bg-lime-600 text-white' 
                      : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                  }`}
                  title={editMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
                >
                  <Edit size={16} />
                </button>
              </div>
              
              {/* Tab Type Selection */}
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => {
                    setTabType('characters')
                    setActiveTab('')
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tabType === 'characters'
                      ? 'bg-lime-600 text-white'
                      : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                  }`}
                >
                  Characters
                </button>
                <button
                  onClick={() => {
                    setTabType('environment')
                    setActiveTab('')
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tabType === 'environment'
                      ? 'bg-lime-600 text-white'
                      : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                  }`}
                >
                  Environment
                </button>
              </div>
              
              {/* Tab List */}
              <div className="space-y-2">
                {tabType === 'characters' && characters.map(character => (
                  <div key={character.id} className="relative group">
                    <button
                      onClick={() => setActiveTab(character.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        activeTab === character.id
                          ? 'bg-lime-600 text-white'
                          : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <User size={16} />
                        <span>{character.name}</span>
                      </div>
                    </button>
                    {editMode && (
                      <>
                        {/* Delete Icon - Top Left */}
                        <button
                          onClick={() => handleDeleteCharacter(character.id)}
                          className="absolute -top-2 -left-2 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100 z-10"
                          title="Delete Character"
                        >
                          <Trash2 size={12} />
                        </button>
                        {/* Edit Icon - Top Right */}
                        <button
                          onClick={() => handleEditCharacter(character.id)}
                          className="absolute -top-2 -right-2 p-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100 z-10"
                          title="Edit Character"
                        >
                          <Edit size={12} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                
                {tabType === 'environment' && environmentSounds.map(category => (
                  <div key={category.category} className="relative group">
                    <button
                      onClick={() => setActiveTab(category.category)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        activeTab === category.category
                          ? 'bg-lime-600 text-white'
                          : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Music size={16} />
                        <span>{category.category}</span>
                      </div>
                    </button>
                    {editMode && (
                      <>
                        {/* Delete Icon - Top Left */}
                        <button
                          onClick={() => handleDeleteCategory(category.category)}
                          className="absolute -top-2 -left-2 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100 z-10"
                          title="Delete Category"
                        >
                          <Trash2 size={12} />
                        </button>
                        {/* Edit Icon - Top Right */}
                        <button
                          onClick={() => handleEditCategory(category.category)}
                          className="absolute -top-2 -right-2 p-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100 z-10"
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
          </div>

          {/* Sound Grid */}
          <div className="lg:col-span-3">
            <div className="bg-dark-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">
                {activeCharacter ? activeCharacter.name : activeEnvironmentCategory ? activeEnvironmentCategory.category : 'Select a category'}
              </h2>
              
              {/* Edit Mode Indicator */}
              {editMode && (
                <div className="mb-4 p-3 bg-lime-600 text-white rounded-lg">
                  <div className="flex items-center justify-between">
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
                        onClick={openAddSoundModal}
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
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Character Sounds */}
                {activeCharacter && activeCharacter.sounds.map(sound => (
                  <div key={sound.id} className="group relative">
                    <button
                      onClick={() => playSound(sound)}
                      className={`w-full bg-dark-700 rounded-xl p-4 hover:bg-dark-600 transition-all duration-200 min-h-[140px] flex flex-col items-center justify-center ${
                        playingSounds.has(sound.id) ? 'ring-2 ring-lime-500' : ''
                      } ${editMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={editMode}
                    >
                      <div className="flex flex-col items-center justify-center mb-2">
                        {sound.icon ? (
                          <img 
                            src={getFileFromLocalStorage(sound.icon) || `/assets/${sound.icon}`} 
                            alt={sound.name}
                            className="w-12 h-12 mb-2 object-contain"

                            style={sound.color !== '#84cc16' ? { 
                              // Gentle tinting for custom colors
                              filter: `sepia(0.5) saturate(200%) hue-rotate(${getHueRotateFromColor(sound.color)}deg) brightness(${sound.brightness || 1})`
                            } : {}}
                          />
                        ) : (
                          (() => {
                            const IconComponent = getSoundIcon(sound.type)
                            return <IconComponent 
                              size={32} 
                              className="mb-2" 
                              style={sound.color === 'transparent' ? { 
                                // Monochrome filtering for transparent mode
                                filter: `brightness(0) saturate(100%) invert(1) sepia(1) saturate(10) hue-rotate(${getHueRotateFromColor(sound.color)}deg) brightness(${sound.brightness || 1})`
                              } : sound.color !== '#84cc16' ? { 
                                // Gentle tinting for custom colors
                                filter: `sepia(0.5) saturate(200%) hue-rotate(${getHueRotateFromColor(sound.color)}deg) brightness(${sound.brightness || 1})`
                              } : {}}
                            />
                          })()
                        )}
                        <div className="text-lg font-medium text-center">{sound.name}</div>

                        {/* Loop Indicator */}
                        {!editMode && sound.loop && (
                          <div className="absolute bottom-2 right-2 w-3 h-3 bg-blue-500 rounded-full" title="Looping sound"></div>
                        )}
                        <div className="text-xs text-slate-400 text-center">
                          {sound.type}
                        </div>
                        <div className="text-xs text-slate-400 text-center">
                          {activeCharacter ? activeCharacter.name : activeEnvironmentCategory?.category}
                        </div>
                      </div>
                    </button>

                    {/* Edit Mode Actions */}
                    {editMode && (
                      <>
                        {/* Delete Icon - Top Left */}
                        <button
                          onClick={() => handleDeleteSound(sound.id)}
                          className="absolute -top-2 -left-2 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100 z-10"
                          title="Delete Sound"
                        >
                          <Trash2 size={12} />
                        </button>
                        {/* Edit Icon - Top Right */}
                        <button
                          onClick={() => openEditSoundModal(sound)}
                          className="absolute -top-2 -right-2 p-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100 z-10"
                          title="Edit Sound"
                        >
                          <Edit size={12} />
                        </button>
                      </>
                    )}
                  </div>
                ))}

                {/* Environment Sounds */}
                {activeEnvironmentCategory && activeEnvironmentCategory.sounds.map(sound => (
                  <div key={sound.id} className="group relative">
                    <button
                      onClick={() => playSound(sound)}
                      className={`w-full bg-dark-700 rounded-xl p-4 hover:bg-dark-600 transition-all duration-200 min-h-[140px] flex flex-col items-center justify-center ${
                        playingSounds.has(sound.id) ? 'ring-2 ring-lime-500' : ''
                      } ${editMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={editMode}
                    >
                      <div className="flex flex-col items-center justify-center mb-2">
                        {sound.icon ? (
                          <img 
                            src={getFileFromLocalStorage(sound.icon) || `/assets/${sound.icon}`} 
                            alt={sound.name}
                            className="w-12 h-12 mb-2 object-contain"

                            style={sound.color !== '#84cc16' ? { 
                              // Gentle tinting for custom colors
                              filter: `sepia(0.5) saturate(200%) hue-rotate(${getHueRotateFromColor(sound.color)}deg) brightness(${sound.brightness || 1})`
                            } : {}}
                            style={sound.color === 'transparent' ? { 
                              // Monochrome filtering for transparent mode
                              filter: `brightness(0) saturate(100%) invert(1) sepia(1) saturate(10) hue-rotate(${getHueRotateFromColor(sound.color)}deg) brightness(${sound.brightness || 1})`
                            } : sound.color !== '#84cc16' ? { 
                              // Gentle tinting for custom colors
                              filter: `sepia(0.5) saturate(200%) hue-rotate(${getHueRotateFromColor(sound.color)}deg) brightness(${sound.brightness || 1})`
                            } : {}}
                          />
                        ) : (
                          (() => {
                            const IconComponent = getSoundIcon(sound.type)
                            return <IconComponent 
                              size={32} 
                              className="mb-2" 
                              style={sound.color !== '#84cc16' ? { 
                                // Gentle tinting for custom colors
                                filter: `sepia(0.5) saturate(200%) hue-rotate(${getHueRotateFromColor(sound.color)}deg) brightness(${sound.brightness || 1})`
                              } : {}}
                              style={sound.color === 'transparent' ? { 
                                // Monochrome filtering for transparent mode
                                filter: `brightness(0) saturate(100%) invert(1) sepia(1) saturate(10) hue-rotate(${getHueRotateFromColor(sound.color)}deg) brightness(${sound.brightness || 1})`
                              } : sound.color !== '#84cc16' ? { 
                                // Gentle tinting for custom colors
                                filter: `sepia(0.5) saturate(200%) hue-rotate(${getHueRotateFromColor(sound.color)}deg) brightness(${sound.brightness || 1})`
                              } : {}}
                            />
                          })()
                        )}
                        <div className="text-lg font-medium text-center">{sound.name}</div>

                        {/* Loop Indicator */}
                        {!editMode && sound.loop && (
                          <div className="absolute bottom-2 right-2 w-3 h-3 bg-blue-500 rounded-full" title="Looping sound"></div>
                        )}
                        <div className="text-xs text-slate-400 text-center">
                          {sound.type}
                        </div>
                        <div className="text-xs text-slate-400 text-center">
                          {activeCharacter ? activeCharacter.name : activeEnvironmentCategory?.category}
                        </div>
                      </div>
                    </button>

                    {/* Edit Mode Actions */}
                    {editMode && (
                      <>
                        {/* Delete Icon - Top Left */}
                        <button
                          onClick={() => handleDeleteSound(sound.id)}
                          className="absolute -top-2 -left-2 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100 z-10"
                          title="Delete Sound"
                        >
                          <Trash2 size={12} />
                        </button>
                        {/* Edit Icon - Top Right */}
                        <button
                          onClick={() => openEditSoundModal(sound)}
                          className="absolute -top-2 -right-2 p-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100 z-10"
                          title="Edit Sound"
                        >
                          <Edit size={12} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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
                            src={iconPreview || (getFileFromLocalStorage(soundFormData.icon) || `/assets/${soundFormData.icon}`)} 
                            alt="Icon preview" 
                            className="w-16 h-16 object-contain"
                            style={soundFormData.color !== '#84cc16' ? { 
                              // Gentle tinting for custom colors
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
                      {/* Two-button color system */}
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
                          className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                            soundFormData.color === '#84cc16' 
                              ? 'bg-lime-600 border-lime-500 text-white' 
                              : 'bg-dark-700 border-dark-600 hover:bg-dark-600'
                          }`}
                        >
                          Default
                        </button>
                      </div>
                      
                      {/* Brightness control - only show when custom color is selected */}
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
                    <label className="block text-sm font-medium mb-1">Upload Audio File *</label>
                    <input
                      type="file"
                      accept=".mp3,.wav,.ogg"
                      onChange={handleAudioUpload}
                      className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-500 file:bg-dark-600 file:border-0 file:text-slate-300 file:mr-4"
                    />
                    {audioPreview && (
                      <div className="mt-2">
                        <audio controls src={audioPreview} className="w-full" />
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-slate-400">{soundFormData.file}</span>
                          <button
                            type="button"
                            onClick={clearAudioUpload}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    </div>
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
                        disabled={!soundFormData.name.trim() || (!audioFile && !soundFormData.file)}
                        className="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors disabled:bg-dark-600 disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        {editingSound ? 'Save Changes' : 'Add Sound'}
                      </button>
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
    </div>
  )
}

export default App
