# TTRPG Soundboard Backup Guide

## Overview
This guide covers the backup and version control system implemented for the TTRPG Soundboard project using Git.

## Git Repository Setup
- **Repository**: Initialized with full project history
- **Initial Commit**: Contains complete v0.1.0 application with audio icons feature
- **Backup Scope**: All source code, configuration files, and critical documentation

## Backup Commands

### Automatic Backups
- Git automatically tracks all changes
- Each commit creates a backup point
- Use `git log` to view backup history

### Manual Backup Commands
```bash
# Create a backup
npm run backup

# Create a feature-specific backup
npm run backup-feature --message="Description of feature"

# View backup status
npm run status

# View backup history (last 10 entries)
npm run log

# Restore last backup (undo last commit)
npm run restore-last
```

### Git Commands (Advanced)
```bash
# View detailed commit history
git log --oneline

# View changes in last commit
git show HEAD

# View file changes
git diff

# Restore to specific commit
git reset --hard <commit-hash>

# Create a backup branch
git checkout -b backup-branch
```

## Backup Workflow

### After Feature Implementation
1. Test the feature works correctly
2. Run `npm run backup-feature --message="Feature name"`
3. Verify backup was created with `npm run status`

### Before Major Changes
1. Run `npm run backup` to create a safe point
2. Make your changes
3. If something breaks, use `npm run restore-last`

### Daily Development
1. Git automatically tracks all changes
2. Commit regularly with descriptive messages
3. Use branches for experimental features

## Emergency Recovery

### Restore Last Working State
```bash
# Undo last commit (if it broke something)
npm run restore-last

# Or use git directly
git reset --hard HEAD~1
```

### Restore Specific Version
```bash
# Find the commit hash
git log --oneline

# Restore to that commit
git reset --hard <commit-hash>
```

### File-Level Recovery
```bash
# Restore specific file from last commit
git checkout HEAD -- filename.js

# Restore specific file from specific commit
git checkout <commit-hash> -- filename.js
```

## Backup Best Practices

1. **Commit Frequently**: Small, focused commits are easier to manage
2. **Descriptive Messages**: Explain what changed and why
3. **Test Before Committing**: Ensure the code works
4. **Use Branches**: Keep experimental work separate
5. **Regular Backups**: Create backups before major changes

## File Backup Priority

### Critical (Backup Always)
- `src/App.jsx` - Main application code
- `src/data.json` - Sound configuration
- Configuration files (`package.json`, `vite.config.js`, etc.)

### Important (Backup Regularly)
- Documentation files
- Test scripts
- Asset files

### Excluded from Backup
- `node_modules/` - Dependencies (can be reinstalled)
- `dist/` - Build output (can be regenerated)
- Temporary files

## Monitoring Backup Health

```bash
# Check repository status
git status

# View backup history
git log --oneline

# Check for uncommitted changes
git diff --name-only

# Verify backup integrity
git fsck
```

## Troubleshooting

### Common Issues
- **Build fails**: Fix issues before committing
- **Merge conflicts**: Use `git mergetool` to resolve
- **Lost changes**: Use `git reflog` to find lost commits

### Getting Help
- Use `git --help` for command reference
- Check Git documentation online
- Review this guide for common scenarios

---

*Last updated: $(date)*