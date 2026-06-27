# TalkCash — Release Kurulumu

GitHub secret'ları eksikse staging deploy atlanır ve release workflow hata verir. Aşağıdaki adımları tamamlayın, ardından **Validate Release Config** workflow'unu yeşile getirin.

## Durum kontrolü

GitHub → **Actions** → **Validate Release Config** → Run workflow

Yerelde:

```bash
./scripts/validate-release-config.sh
```

---

## Adım 1 — Fly.io (API sunucusu)

```bash
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"
flyctl auth login

# Staging (test ortamı)
./scripts/setup-fly-staging.sh

# Production (mağaza API'si)
./scripts/setup-fly-prod.sh
```

### Zorunlu Fly secrets (her app için)

```bash
# Staging örneği (-a talkcash-api)
fly secrets set REDIS_URL='redis://...' -a talkcash-api
fly secrets set OPENAI_API_KEY='sk-...' -a talkcash-api
fly secrets set S3_ENABLED=true S3_ENDPOINT=... S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_BUCKET=talkcash S3_REGION=auto -a talkcash-api
fly secrets set ALLOWED_ORIGINS='*' -a talkcash-api

# Production (-a talkcash-api-prod) — aynı anahtarlar
```

Deploy test:

```bash
./scripts/deploy-staging.sh
API_URL=https://talkcash-api.fly.dev python3 scripts/smoke_test.py
```

---

## Adım 2 — GitHub Secrets & Variables

Repo: **Settings → Secrets and variables → Actions**

### Secrets (gizli)

| Secret | Nasıl alınır |
|--------|----------------|
| `FLY_API_TOKEN` | `flyctl auth token` veya [Fly tokens](https://fly.io/user/personal_access_tokens) |
| `EXPO_TOKEN` | [expo.dev → Access Tokens](https://expo.dev/settings/access-tokens) |

```bash
gh secret set FLY_API_TOKEN
gh secret set EXPO_TOKEN
```

### Variables (açık)

| Variable | Örnek değer |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | `https://talkcash-api-prod.fly.dev/api/v1` |
| `EAS_PROJECT_ID` | Expo dashboard → Project settings → UUID |

```bash
gh variable set EXPO_PUBLIC_API_URL --body 'https://talkcash-api-prod.fly.dev/api/v1'
gh variable set EAS_PROJECT_ID --body '<expo-project-uuid>'
```

---

## Adım 3 — Doğrula

```bash
./scripts/validate-release-config.sh
```

GitHub → **Validate Release Config** workflow'u yeşil olmalı.

---

## Adım 4 — Release (tek tık)

GitHub → **Actions** → **Release Production (Full Pipeline)**

| Input | Değer |
|-------|--------|
| `confirm` | `release` |
| `skip_deploy` | API zaten canlıysa ✓ |
| `skip_build` | Sadece Play submit için ✓ |

Sıra: test → Fly prod deploy + smoke → EAS AAB → Play internal track.

---

## Adım 5 — Cihaz smoke test

[docs/SMOKE_TEST.md](SMOKE_TEST.md) checklist'ini fiziksel cihazda tamamlayın.

---

## Hızlı bootstrap (interaktif)

```bash
./scripts/setup-github-release.sh
```

Fly kurulumunu yapar ve GitHub'a yapıştırmanız gereken komutları yazdırır.

---

## Sorun giderme

| Belirti | Çözüm |
|---------|--------|
| Deploy Staging skipped | `FLY_API_TOKEN` secret ekleyin |
| `Not logged in to Fly.io` in CI | Token süresi dolmuş — yeni token |
| EAS build `EAS_PROJECT_ID` | Repo variable ekleyin |
| Smoke register 500 | Fly'da `alembic upgrade head` (entrypoint otomatik çalışır) |
| Cloud agent release yapamıyor | Normal — secret'lar repo admin'de; GitHub Actions UI kullanın |

---

İlgili dokümanlar: [PRODUCTION.md](PRODUCTION.md) · [PLAY_STORE_LISTING.md](PLAY_STORE_LISTING.md) · [GOOGLE_PLAY_RELEASE.md](GOOGLE_PLAY_RELEASE.md) · [DEPLOY.md](DEPLOY.md)
