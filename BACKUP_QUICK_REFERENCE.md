# Backup Quick Reference

## Essential Commands

### Create Backups
```bash
# Quick backup
npm run backup

# Feature-specific backup
npm run backup-feature --message="Feature description"

# Manual git backup
git add . && git commit -m "Backup: description"
```

### View Backups
```bash
# Status
npm run status

# History (last 10)
npm run log

# Detailed history
git log --oneline
```

### Restore Backups
```bash
# Undo last commit
npm run restore-last

# Restore specific file
git checkout HEAD -- src/App.jsx

# Full restore to commit
git reset --hard <commit-hash>
```

## Workflow

### After Feature Implementation
1. Test feature ✅
2. `npm run backup-feature --message="Feature name"`
3. Verify with `npm run status`

### Before Major Changes
1. `npm run backup`
2. Make changes
3. If broken: `npm run restore-last`

## Critical Files
- `src/App.jsx` - Main code
- `src/data.json` - Sound config
- Configuration files

## Emergency Recovery
```bash
# Quick undo
npm run restore-last

# Find commit to restore
git log --oneline

# Restore to commit
git reset --hard <hash>
```

---
*Keep this card handy for quick reference!*