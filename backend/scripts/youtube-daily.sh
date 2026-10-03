#!/bin/bash
# Daily YouTube import — runs at 9:00 AM for 2 weeks
# Day 1-7:  import-youtube-polish (discover channels with avatar/banner/bio)
# Day 1-14: import-youtube-clips  (5 clips per channel)
#
# Quota budget: 10,000 units/day
#   - Polish import: ~50 searches = 5000 units (leaves 5000 for clips)
#   - Clips import:  ~25 streamers × 2 searches × 100 = 5000 units
#
# Installed via: crontab — should run from 2026-04-11 to 2026-04-24

set -e
cd /var/www/xdtv-backend

LOGFILE="/var/www/xdtv-backend/logs/youtube-import-$(date +%Y%m%d).log"
mkdir -p /var/www/xdtv-backend/logs

echo "═══════════════════════════════════════" >> "$LOGFILE"
echo "YouTube daily import — $(date)" >> "$LOGFILE"
echo "═══════════════════════════════════════" >> "$LOGFILE"

# Phase 1: Discover Polish YouTubers (batch 200, target 500 — ~50 searches = 5000 quota)
echo "[$(date +%H:%M:%S)] Phase 1: Discovering Polish YouTubers..." >> "$LOGFILE"
npx tsx scripts/import-youtube-polish.ts 200 500 >> "$LOGFILE" 2>&1 || true

echo "" >> "$LOGFILE"

# Phase 2: Import clips (25 streamers × 5 clips — fits in remaining ~5000 quota)
echo "[$(date +%H:%M:%S)] Phase 2: Importing YouTube clips..." >> "$LOGFILE"
npx tsx scripts/import-youtube-clips.ts 25 5 >> "$LOGFILE" 2>&1 || true

echo "" >> "$LOGFILE"
echo "[$(date +%H:%M:%S)] Done." >> "$LOGFILE"
