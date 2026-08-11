# Loop Debugging Guide

## Current Issue
- **Environment Tab**: Loop checkbox shows checked ✅
- **But**: Sound doesn't actually loop ❌
- **Workaround**: Untick and retick checkbox fixes it ✅

## Debug Logging Added

### **1. Modal Opening**
```javascript
console.log('🎵 MODAL OPEN - Setting loop default for tab:', tabType, 'Loop:', tabType === 'environment')
```
- Logs when "Add Sound" button is clicked
- Shows which tab and what loop default is being set

### **2. Sound Editing**
```javascript
console.log('🔧 EDIT SOUND - Original:', sound.name, 'Loop:', sound.loop, 'Tab:', tabType)
console.log('🔧 EDIT SOUND - Default loop for tab:', tabType === 'environment')
console.log('🔧 EDIT SOUND - New loop value:', sound.loop !== undefined ? sound.loop : tabType === 'environment')
```
- Logs when editing existing sounds
- Shows original loop value and new calculated value

### **3. Sound Creation**
```javascript
console.log('🎵 ADD SOUND - newSoundData.loop:', newSoundData.loop, 'Type:', typeof newSoundData.loop)
console.log('🎵 ADD SOUND - Tab type:', tabType, 'Environment:', tabType === 'environment')
console.log('🎵 ADD SOUND - Final sound object loop:', newSound.loop)
```
- Logs when creating new sounds
- Shows loop value at different stages

### **4. Sound Playback**
```javascript
console.log('Playing sound:', sound.name, 'Loop property:', sound.loop, 'Sound ID:', sound.id)
```
- Already exists in playSound function
- Shows what loop value the sound has when played

## Testing Procedure

### **Step 1: Open Browser Console**
1. Press F12 → Console tab
2. Clear existing logs

### **Step 2: Test Environment Tab**
1. Switch to Environment tab
2. Click "Add Sound"
3. **Check Console**: Should see:
   ```
   🎵 MODAL OPEN - Setting loop default for tab: environment, Loop: true
   ```
4. Fill in sound details
5. Click "Add Sound"
6. **Check Console**: Should see:
   ```
   🎵 ADD SOUND - newSoundData.loop: true, Type: boolean
   🎵 ADD SOUND - Tab type: environment, Environment: true
   🎵 ADD SOUND - Final sound object loop: true
   ```
7. Play the sound
8. **Check Console**: Should see:
   ```
   Playing sound: [name], Loop property: true, Sound ID: [id]
   ```

### **Step 3: Test Characters Tab**
1. Switch to Characters tab
2. Repeat steps 2-8
3. **Expected**: Loop should be false at all stages

### **Step 4: Test Edit Flow**
1. Edit an existing sound
2. **Check Console**: Should see edit sound logs
3. Save changes
4. Play sound to verify loop behavior

## Expected Console Output

### **Environment Tab**
```
🎵 MODAL OPEN - Setting loop default for tab: environment, Loop: true
🎵 ADD SOUND - newSoundData.loop: true, Type: boolean
🎵 ADD SOUND - Tab type: environment, Environment: true
🎵 ADD SOUND - Final sound object loop: true
Playing sound: Ambient Music, Loop property: true, Sound ID: s_123
```

### **Characters Tab**
```
🎵 MODAL OPEN - Setting loop default for tab: characters, Loop: false
🎵 ADD SOUND - newSoundData.loop: false, Type: boolean
🎵 ADD SOUND - Tab type: characters, Environment: false
🎵 ADD SOUND - Final sound object loop: false
Playing sound: Sword Swing, Loop property: false, Sound ID: s_456
```

## Potential Issues to Look For

### **Issue 1: Wrong Loop Value in addSound**
If `newSoundData.loop` is not `true` when it should be:
- Problem in modal opening logic
- State not being set correctly

### **Issue 2: Final Sound Object Has Wrong Loop**
If `newSound.loop` is not `true` when `newSoundData.loop` is `true`:
- Problem in sound creation logic
- The `|| false` might be causing issues

### **Issue 3: Playback Uses Wrong Loop Value**
If sound has `loop: true` but doesn't loop:
- Problem in audio playback logic
- Not related to our default system

## Next Steps Based on Debug Results

### **If Issue 1 (Wrong modal default)**
- Fix the modal opening logic
- Ensure state is set correctly

### **If Issue 2 (Wrong sound creation)**
- Fix the `addSound` function
- Remove or fix the `|| false` logic

### **If Issue 3 (Playback issue)**
- Debug the audio playback system
- This would be a separate issue from defaults

## Quick Fix to Test
If the logs show that `newSoundData.loop` is `true` but `newSound.loop` becomes `false`, the issue is likely:
```javascript
// Current (problematic):
loop: newSoundData.loop || false

// Should be:
loop: newSoundData.loop !== undefined ? newSoundData.loop : false
```

This ensures that `true` values are preserved and only `undefined` values get the default `false`.