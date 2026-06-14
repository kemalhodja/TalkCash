# GitHub Release Secrets Checklist

Copy this checklist when configuring **Settings → Secrets and variables → Actions**.

## Secrets

- [ ] `FLY_API_TOKEN` — from `flyctl auth token` ([Fly tokens](https://fly.io/user/personal_access_tokens))
- [ ] `EXPO_TOKEN` — from [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)

## Variables

- [ ] `EXPO_PUBLIC_API_URL` = `https://talkcash-api-prod.fly.dev/api/v1`
- [ ] `EAS_PROJECT_ID` = Expo project UUID (not `00000000-0000-0000-0000-000000000000`)

## Fly.io apps (run locally once)

```bash
./scripts/setup-github-release.sh
```

Required Fly secrets per app: `REDIS_URL`, `OPENAI_API_KEY`, `S3_*`, `ALLOWED_ORIGINS`

## Validate

```bash
./scripts/complete-release-setup.sh
```

GitHub: **Actions → Validate Release Config**

## Release

GitHub: **Actions → Release Production (Full Pipeline)** → `confirm`: `release`

See [docs/SETUP_RELEASE.md](../docs/SETUP_RELEASE.md) for full guide.
