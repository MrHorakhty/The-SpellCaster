import { useState, useEffect, useRef } from 'react'
import { User, Music, Volume2, VolumeX, Settings, Flame, Zap, Shield, Sword, Heart, Cloud, CloudRain, Wind, Droplets } from 'lucide-react'
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

function App() {
  const [characters, setCharacters] = useState(data.characters)
  const [environmentSounds, setEnvironmentSounds] = useState(data.environmentSounds)
  const [tabType, setTabType] = useState('characters')
  const [activeTab, setActiveTab] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [playingSounds, setPlayingSounds] = useState(new Set())
  const audioElementsRef = useRef(new Map())

  // Get active character or environment category
  const activeCharacter = characters.find(char => char.id === activeTab)
  const activeEnvironmentCategory = environmentSounds.find(cat => cat.category === activeTab)

  // Enable audio after user interaction
  const enableAudio = () => {
    setAudioEnabled(true)
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
    const soundUrl = `/assets/${sound.file}`
    
    // Stop if already playing
    if (playingSounds.has(soundKey)) {
      console.log('Stopping sound:', sound.name)
      const existingAudio = audioElementsRef.current.get(soundKey)
      if (existingAudio) {
        existingAudio.pause()
        existingAudio.currentTime = 0
      }
      setPlayingSounds(prev => {
        const newSet = new Set(prev)
        newSet.delete(soundKey)
        return newSet
      })
      audioElementsRef.current.delete(soundKey)
      return
    }
    
    console.log('Playing sound:', sound.name, 'from URL:', soundUrl)
    
    const audio = new Audio(soundUrl)
    audio.loop = false // Basic version - no loop functionality yet
    
    audioElementsRef.current.set(soundKey, audio)
    
    audio.addEventListener('ended', () => {
      console.log('Sound ended:', sound.name)
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
              <button
                onClick={enableAudio}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  audioEnabled 
                    ? 'bg-lime-600 text-white' 
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  editMode 
                    ? 'bg-lime-600 text-white' 
                    : 'bg-dark-700 text-slate-300 hover:bg-dark-600'
                }`}
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
              <h2 className="text-lg font-semibold mb-4">Categories</h2>
              
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
                  <button
                    key={character.id}
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
                ))}
                
                {tabType === 'environment' && environmentSounds.map(category => (
                  <button
                    key={category.category}
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
                  <div className="flex items-center space-x-2">
                    <Settings size={16} />
                    <span className="font-medium">Edit Mode Active</span>
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
                      className={`w-full bg-dark-700 rounded-xl p-4 hover:bg-dark-600 transition-all duration-200 min-h-[120px] flex flex-col items-center justify-center ${
                        playingSounds.has(sound.id) ? 'ring-2 ring-lime-500' : ''
                      } ${editMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={editMode}
                    >
                      <div className="flex items-center justify-center mb-2">
                        {(() => {
                          const IconComponent = getSoundIcon(sound.type)
                          return <IconComponent size={24} className="mr-2" />
                        })()}
                        <div className="text-lg font-medium text-center">{sound.name}</div>
                      </div>
                      <div className="text-xs text-slate-400 text-center">{sound.type}</div>
                    </button>

                    {/* Edit Mode Indicator */}
                    {editMode && (
                      <div className="absolute -top-2 -right-2 p-1 rounded-full bg-lime-600 text-white opacity-0 group-hover:opacity-100 z-10">
                        <Settings size={14} />
                      </div>
                    )}
                  </div>
                ))}

                {/* Environment Sounds */}
                {activeEnvironmentCategory && activeEnvironmentCategory.sounds.map(sound => (
                  <div key={sound.id} className="group relative">
                    <button
                      onClick={() => playSound(sound)}
                      className={`w-full bg-dark-700 rounded-xl p-4 hover:bg-dark-600 transition-all duration-200 min-h-[120px] flex flex-col items-center justify-center ${
                        playingSounds.has(sound.id) ? 'ring-2 ring-lime-500' : ''
                      } ${editMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={editMode}
                    >
                      <div className="flex items-center justify-center mb-2">
                        {(() => {
                          const IconComponent = getSoundIcon(sound.type)
                          return <IconComponent size={24} className="mr-2" />
                        })()}
                        <div className="text-lg font-medium text-center">{sound.name}</div>
                      </div>
                      <div className="text-xs text-slate-400 text-center">{sound.type}</div>
                    </button>

                    {/* Edit Mode Indicator */}
                    {editMode && (
                      <div className="absolute -top-2 -right-2 p-1 rounded-full bg-lime-600 text-white opacity-0 group-hover:opacity-100 z-10">
                        <Settings size={14} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
