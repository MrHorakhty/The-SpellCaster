# Quick Test Guide for Audio Control Fixes

## Before Testing
1. Open app in browser: `npm run dev`
2. Open DevTools: Press `F12`
3. Go to Console tab
4. Filter logs (type "Timer" or "Sound")

---

## Test 1: Loop Toggle ✅

### Character Sound Loop Test (2 min)
```
1. Click User icon (Characters tab)
2. Click "Edit" button
3. Click blue edit button on "Fireball"
4. Check the "Loop" checkbox
5. Save and exit edit mode
6. Play sound - should loop continuously
7. Click Edit, click sound, uncheck Loop
8. Save and exit
9. Play sound - should stop when finished
```

**Expected**: ✅ Checkbox controls looping

### Environment Sound Loop Test (2 min)
```
1. Click Music icon (Environment tab)
2. Click "Edit" button
3. Click blue edit button on "Forest Ambience"
4. CHECK "Loop" (should be unchecked by default)
5. Save and exit
6. Play - should NOW LOOP
7. Click Edit, click sound, UNCHECK Loop
8. Save and exit
9. Play - should play ONCE and stop
```

**Expected**: ✅ Thunder loops when checked

---

## Test 2: Timer/Duration ✅

### Timer with Fade Test (3 min)
```
1. Characters tab → Edit → "Caustic Blast"
2. Duration: "3" seconds
3. Fade Out: "1" second
4. Save and exit
5. OPEN CONSOLE (F12)
6. Play sound
7. Watch console for "Timer setup"
8. After 3 seconds: "Timer fired"
9. Then: "Starting fade out"
10. Then: "Stopping sound"
```

**Console Should Show**:
- "Timer setup: { soundKey: '...', duration: 3, fadeOut: 1 }"
- "Timer scheduled for 3000 ms"
- "Timer fired for sound: ..."
- "Starting fade out..."

**Expected**: ✅ Sound stops after 3 seconds with fade

### Timer No Fade Test (2 min)
```
1. Edit "Frostbite"
2. Duration: "2", Fade Out: "0"
3. Save and play
4. Watch console
5. After 2 seconds: stops immediately
```

**Expected**: ✅ Sound stops immediately

---

## Test 3: Icon Colors ✅

### Color Check (3 min)
```
Check each icon color matches:
- Caustic Blast: BRIGHT GREEN
- Frostbite: BRIGHT BLUE
- Fireball: BRIGHT ORANGE
- Forest Ambience: BRIGHT GREEN
- Tavern Music: BRIGHT ORANGE
- Rain: BRIGHT BLUE
- Wind: BRIGHT LIME
```

**Expected**: ✅ Vibrant solid colors

### Change Color (2 min)
```
1. Edit any sound
2. Change color to red
3. Save
4. Icon should be red immediately
```

**Expected**: ✅ Color updates instantly

---

## Quick Checklist

- [ ] Loop toggle works for characters
- [ ] Loop toggle works for environment
- [ ] Timer stops sound after duration
- [ ] Fade-out triggers before stop
- [ ] Colors display as vibrant solids
- [ ] Color changes update immediately

**All Passed?** ✅ Ready for production!
