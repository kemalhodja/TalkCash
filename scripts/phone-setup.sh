#!/usr/bin/env bash
# Phone test setup: backend + health check + APK build hints
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

detect_ip() {
  if command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
    return
  fi
  hostname -I 2>/dev/null | awk '{print $1}' || true
}

echo "==> TalkCash telefon test kurulumu"
echo

echo "==> 1/3 Backend (Docker)..."
docker compose up -d

LAN_IP="${API_HOST:-$(detect_ip)}"
if [ -z "$LAN_IP" ]; then
  echo "WARNING: LAN IP bulunamadı. API_HOST=192.168.x.x ile tekrar çalıştırın."
  LAN_IP="192.168.1.1"
fi

HEALTH="http://${LAN_IP}:8000/health"
API="http://${LAN_IP}:8000/api/v1"

echo
echo "==> 2/3 Sağlık kontrolü..."
sleep 3
if curl -sf "$HEALTH" >/dev/null; then
  echo "  OK  $HEALTH"
else
  echo "  FAIL $HEALTH"
  echo "  docker compose logs backend --tail 30"
  exit 1
fi

echo
echo "==> 3/3 Telefon adımları"
echo "  Telefondan tarayıcıda aç: $HEALTH"
echo "  APK build:  ./scripts/build-android-apk.sh --wait --download"
echo "  veya indir: ./scripts/download-android-apk.sh"
echo
echo "  Kurulum sonrası uygulamada: Ayarlar → Bağlantıyı test et"
echo "  Rehber: docs/ANDROID_APK.md"
