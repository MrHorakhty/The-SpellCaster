import wave
import struct
import math

def create_beep_sound(filename, frequency=440, duration=0.5, volume=0.5):
    """Create a simple beep sound as a WAV file"""
    sample_rate = 44100
    num_samples = int(sample_rate * duration)
    
    # Create WAV file
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)  # mono
        wav_file.setsampwidth(2)  # 2 bytes per sample
        wav_file.setframerate(sample_rate)
        
        # Generate sine wave
        for i in range(num_samples):
            # Simple sine wave
            sample = volume * math.sin(2 * math.pi * frequency * i / sample_rate)
            # Convert to 16-bit integer
            sample_int = int(sample * 32767)
            # Write as little-endian
            wav_file.writeframes(struct.pack('<h', sample_int))

# Create different sounds for different types
sounds = {
    'acid': 220,
    'cold': 440,
    'fire': 660,
    'lightning': 880,
    'healing': 523.25,
    'divine': 587.33,
    'protection': 659.25,
    'stealth': 392,
    'weapon': 493.88
}

for sound_type, frequency in sounds.items():
    filename = f"public/assets/{sound_type}.wav"
    create_beep_sound(filename, frequency=frequency, duration=0.5)
    print(f"Created {filename}")

print("All sound files created successfully!")