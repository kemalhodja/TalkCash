#!/usr/bin/env bash
# Shared checks before phone testing / APK build
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

detect_ip() {
  if command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
    return
  fi
  hostname -I 2>/dev/null | awk '{print $1}' || true
}

require_docker_health() {
  local health_url="$1"
  echo "==> Backend health: $health_url"
  if curl -sf "$health_url" >/dev/null; then
    echo "  OK"
    return 0
  fi
  echo "  FAIL — is Docker running?"
  echo "  Run: docker compose up -d && docker compose logs backend --tail 30"
  return 1
}

require_eas_login() {
  if ! command -v npx >/dev/null 2>&1; then
    echo "ERROR: npx not found (install Node.js 20+)"
    return 1
  fi
  cd "$ROOT/mobile"
  if ! npx eas whoami >/dev/null 2>&1; then
    echo "ERROR: Expo hesabına giriş yapın:"
    echo "  cd mobile && npx eas login"
    echo "  cd mobile && npx eas init   # ilk sefer"
    return 1
  fi
  echo "  Expo: $(npx eas whoami 2>/dev/null | head -1)"
  return 0
}

resolve_lan_ip() {
  local ip="${API_HOST:-$(detect_ip)}"
  if [ -z "$ip" ]; then
    echo "ERROR: LAN IP bulunamadı. API_HOST=192.168.x.x ile tekrar deneyin." >&2
    return 1
  fi
  echo "$ip"
}
