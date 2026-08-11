import { useState, useEffect, useRef } from 'react'
import { User, Music, Volume2, VolumeX, Settings, Flame, Zap, Shield, Sword, Heart, Cloud, CloudRain, Wind, Droplets, X, Plus, Edit, Trash2, Folder, Sparkles, Square } from 'lucide-react'
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

// Function to generate glow effect style based on sound color and glow settings
const getGlowEffectStyle = (sound) => {
  if (!sound.glowEnabled) {
    return {}
  }
  
  // Calculate glow intensity based on prominence
  const intensity = (sound.glowProminence || 0.5) * 0.5 + 0.1 // Range: 0.1 to 0.6
  const spread = (sound.glowProminence || 0.5) * 10 + 5 // Range: 5 to 15
  
  return {
    boxShadow: `0 0 ${spread}px ${intensity}px ${sound.color}, 0 4px 6px -1px rgba(0, 0, 0, 0.3)`
  }
}

function App() {
  const [characters, setCharacters] = useState(data.characters)
  const [environmentSounds, setEnvironmentSounds] = useState(data.environmentSounds)
  const [tabType, setTabType] = useState('characters')
  const [activeTab, setActiveTab] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [masterVolume, setMasterVolume] = useState(1.0) // 0.0 to 1.0
  const [soundInstances, setSoundInstances] = useState({}) // Track sound instances for UI updates
  const audioElementsRef = useRef(new Map())
  
  // Split View & Active Tab States
  const [isSplitView, setIsSplitView] = useState(false)
  const [activeCharacterId, setActiveCharacterId] = useState('')
  const [activeEnvironmentId, setActiveEnvironmentId] = useState('')
  
  // Modal and form states
  const [showSoundModal, setShowSoundModal] = useState(false)
  const [editingSound, setEditingSound] = useState(null)
