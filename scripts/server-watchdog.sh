#!/usr/bin/env bash
# ==============================================================================
# Code-UP Autonomous Server Watchdog & Self-Healing Engine
# ==============================================================================
# This script monitors the Next.js server, PM2 processes, and HTTP endpoints.
# If the server is down, hung, crashing, or PM2 is stopped, it automatically:
#  1. Detects failures within 1-2 minutes.
#  2. Kills zombie/hung processes on port 3000.
#  3. Resurrects / restarts PM2 cluster.
#  4. Rebuilds Next.js and regenerates Prisma if the build is corrupt/missing.
#  5. Restores full service and logs all recovery actions.
# ==============================================================================

set -uo pipefail

APP_DIR="/home/ec2-user/Thefake"
LOG_FILE="$APP_DIR/logs/watchdog.log"
LOCK_FILE="/tmp/thefake_watchdog.lock"
HEALTH_URL="http://127.0.0.1:3000/api/health"
HOME_URL="http://127.0.0.1:3000"
MAX_LOG_LINES=5000

# Setup Environment & Node/PM2 paths
export HOME="/home/ec2-user"
export USER="ec2-user"
export PATH="/home/ec2-user/.nvm/versions/node/v20.20.2/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:$PATH"
export NODE_OPTIONS="--max-old-space-size=2048"

mkdir -p "$APP_DIR/logs"

# Ensure single execution at a time via lockfile
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  # Another instance is already running
  exit 0
fi

log() {
  local level="$1"
  local msg="$2"
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$ts] [$level] $msg" | tee -a "$LOG_FILE"
}

# Rotate log if too large
if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt "$MAX_LOG_LINES" ]; then
  tail -n 2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

cd "$APP_DIR" || exit 1

check_http() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$HEALTH_URL" 2>/dev/null || echo "000")
  if [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "204" ]; then
    return 0
  fi
  # Fallback check on root URL
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$HOME_URL" 2>/dev/null || echo "000")
  if [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "204" ] || [ "$code" = "302" ]; then
    return 0
  fi
  return 1
}

check_pm2() {
  # Check if PM2 daemon is alive and Thefake is online
  if ! pm2 ping >/dev/null 2>&1; then
    return 1
  fi
  if pm2 jlist 2>/dev/null | grep -q '"status":"online"'; then
    return 0
  fi
  return 1
}

heal_server() {
  local reason="$1"
  log "WARN" "🚨 Server health check FAILED: $reason. Initiating autonomous self-healing..."

  # 1. Clean any rogue/stuck node process holding port 3000 if PM2 is not online
  log "INFO" "Checking for hung port 3000..."
  if command -v fuser >/dev/null 2>&1; then
    fuser -k 3000/tcp 2>/dev/null || true
  fi

  # 2. Try fast PM2 restart / resurrect
  log "INFO" "Attempting PM2 cluster reload..."
  pm2 restart ecosystem.config.js 2>/dev/null || pm2 start ecosystem.config.js 2>/dev/null || true
  
  sleep 8

  # Verify if fast reload fixed the problem
  if check_http; then
    log "INFO" "✅ Fast PM2 reload successful! Server is back ONLINE (HTTP 200)."
    pm2 save >/dev/null 2>&1 || true
    return 0
  fi

  # 3. Deep Self-Healing (Prisma regeneration + Next.js build validation + Clean Restart)
  log "WARN" "Fast reload was insufficient. Initiating Deep Self-Healing (Prisma sync & Next build)..."
  
  # Stop PM2 to free RAM during build and clear orphaned locks from disconnected SSH sessions
  pm2 stop Thefake >/dev/null 2>&1 || true
  pkill -f "next-server" 2>/dev/null || true
  rm -f .next/lock 2>/dev/null || true
  sleep 2

  # Regenerate Prisma Client
  log "INFO" "Regenerating Prisma client..."
  node scripts/prisma-generate.js >> "$LOG_FILE" 2>&1 || true

  # Check if .next is missing or broken, or force build
  log "INFO" "Running optimized Next.js build..."
  NODE_OPTIONS="--max-old-space-size=2048" npx next build --webpack >> "$LOG_FILE" 2>&1

  if [ $? -eq 0 ]; then
    log "INFO" "Build finished successfully. Starting PM2 cluster..."
    pm2 start ecosystem.config.js >> "$LOG_FILE" 2>&1
    pm2 save >/dev/null 2>&1 || true
    
    sleep 10
    if check_http; then
      log "INFO" "🎉 Deep Self-Healing SUCCEEDED! Server is 100% ONLINE and healthy."
      return 0
    else
      log "ERROR" "❌ Server started but HTTP check failed. Checking logs..."
      pm2 logs Thefake --lines 20 --nostream >> "$LOG_FILE" 2>&1 || true
      return 1
    fi
  else
    log "ERROR" "❌ Next.js build failed during deep self-healing. Retrying PM2 restart..."
    pm2 start ecosystem.config.js >> "$LOG_FILE" 2>&1 || true
    return 1
  fi
}

# --- Main Watchdog Execution ---
FAIL_COUNT_FILE="/tmp/thefake_fail_count"

if check_http && check_pm2; then
  # Healthy - clear any previous failure counter
  rm -f "$FAIL_COUNT_FILE" 2>/dev/null || true
  exit 0
fi

# Not healthy - run healing
HEAL_SUCCESS=0
if ! check_pm2; then
  heal_server "PM2 cluster is not running or instances are down" && HEAL_SUCCESS=1 || HEAL_SUCCESS=0
elif ! check_http; then
  heal_server "HTTP health check endpoint is unresponsive (Port 3000/api/health down)" && HEAL_SUCCESS=1 || HEAL_SUCCESS=0
fi

if [ "$HEAL_SUCCESS" -eq 1 ]; then
  # Successfully healed - reset fail counter
  rm -f "$FAIL_COUNT_FILE" 2>/dev/null || true
  exit 0
else
  # Self-healing attempt failed; increment failure counter
  PREV_FAILS=0
  if [ -f "$FAIL_COUNT_FILE" ]; then
    PREV_FAILS=$(cat "$FAIL_COUNT_FILE" 2>/dev/null || echo 0)
  fi
  NEW_FAILS=$((PREV_FAILS + 1))
  echo "$NEW_FAILS" > "$FAIL_COUNT_FILE"

  log "WARN" "⚠️ Failure counter is now at $NEW_FAILS/3 consecutive failed recovery attempts."

  # Tier 3 (Ultimate Failsafe): If server is stuck for 3 consecutive checks (approx 6-10 min), reboot the entire OS
  if [ "$NEW_FAILS" -ge 3 ]; then
    log "CRITICAL" "🚨 Server is completely frozen after 3 failed auto-recovery attempts. Triggering EMERGENCY OPERATING SYSTEM REBOOT (sudo reboot)..."
    rm -f "$FAIL_COUNT_FILE" 2>/dev/null || true
    sync
    sudo reboot || true
  fi
fi
