#!/usr/bin/env bash
# Phone test setup: backend + health check + APK build hints
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=preflight-phone.sh
source "$ROOT/scripts/preflight-phone.sh"

echo "==> TalkCash telefon test kurulumu"
echo

echo "==> 1/4 Backend (Docker)..."
docker compose up -d

LAN_IP="$(resolve_lan_ip || true)"
if [ -z "${LAN_IP:-}" ]; then
  echo "WARNING: LAN IP bulunamadı. API_HOST=192.168.x.x ile tekrar çalıştırın."
  LAN_IP="192.168.1.1"
fi

HEALTH="http://${LAN_IP}:8000/health"
API="http://${LAN_IP}:8000/api/v1"

echo
echo "==> 2/4 Sağlık kontrolü..."
sleep 3
require_docker_health "$HEALTH"

echo
echo "==> 3/4 Expo (APK build için)"
if require_eas_login; then
  :
else
  echo "  APK build için yukarıdaki adımları tamamlayın."
fi

echo
echo "==> 4/4 Telefon adımları"
echo "  1) Telefondan tarayıcıda aç: $HEALTH  (JSON {\"status\":\"ok\"} görmelisiniz)"
echo "  2) APK:  ./scripts/build-android-apk.sh --wait --download"
echo "  3) Kur:  USB → ./scripts/install-android-adb.sh"
echo "         veya dist/talkcash-preview.apk dosyasını telefona aktar"
echo
echo "  Uygulamada: Ayarlar → Bağlantıyı test et"
echo "  Staging (Wi‑Fi şart değil): ./scripts/build-android-apk.sh --staging --wait --download"
echo "  Rehber: docs/ANDROID_APK.md"
