# Color Matching Test Guide

## Current Implementation

### Filter Chain for Tinting Mode
```css
filter: sepia(0.5) saturate(200%) hue-rotate(Xdeg) brightness(1.1)
```

### Hue Rotation Calculation
- **Base Hue**: 20° (light sepia brown)
- **Target Hue**: Calculated from selected color
- **Rotation**: Target Hue - Base Hue (normalized to 0-360°)

## Testing Procedure

### 1. Open Browser Console
- Press F12 → Console tab
- Look for debug logs showing color calculations

### 2. Test Specific Colors

#### Red Colors
- Try `#ff0000` (pure red) - Should show ~0° hue
- Try `#ff6b6b` (softer red) - Should show similar hue

#### Green Colors  
- Try `#00ff00` (pure green) - Should show ~120° hue
- Try `#51cf66` (softer green) - Should show similar hue

#### Blue Colors
- Try `#0000ff` (pure blue) - Should show ~240° hue
- Try `#339af0` (softer blue) - Should show similar hue

### 3. Expected Console Output
```
Color: #ff0000, Target Hue: 0, Rotation: 340
Color: #00ff00, Target Hue: 120, Rotation: 100  
Color: #0000ff, Target Hue: 240, Rotation: 220
```

### 4. Visual Verification
- Pure white PNG with transparent background
- Apply different colors via tinting
- Check if colors appear approximately correct

## Common Color Hue Values

| Color | Hex | Approx Hue |
|-------|-----|------------|
| Red | #ff0000 | 0° |
| Orange | #ff7f00 | 30° |
| Yellow | #ffff00 | 60° |
| Lime | #7fff00 | 90° |
| Green | #00ff00 | 120° |
| Teal | #00ff7f | 150° |
| Cyan | #00ffff | 180° |
| Blue | #0000ff | 240° |
| Purple | #7f00ff | 270° |
| Magenta | #ff00ff | 300° |

## Troubleshooting

### Issue: Red shows as Yellow/Green
**Possible Cause**: Hue rotation calculation incorrect
**Solution**: Check console logs for hue values

### Issue: Colors too muted/washed out
**Possible Cause**: Saturation too low
**Solution**: Increase `saturate()` value

### Issue: Colors too dark
**Possible Cause**: Brightness too low  
**Solution**: Increase `brightness()` value

### Issue: Colors distorted
**Possible Cause**: Sepia effect too strong
**Solution**: Decrease `sepia()` value

## Next Steps Based on Test Results

### If Colors Are Close Enough
- ✅ Implementation successful
- Remove debug logging
- Document final filter chain

### If Colors Still Wrong
- Try alternative filter chains
- Adjust base hue value
- Test different saturation/brightness levels

### If Fundamental Issue
- Consider SVG filter approach for accuracy
- Implement canvas-based color replacement
- Use dual-image system (original + tinted)