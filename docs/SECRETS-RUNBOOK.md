# Secrets Runbook — Code-UP

Where the platform's secrets live, who holds them, and what breaks if one is lost.
**Keep this file out of screenshots/support chats. The values are NOT in this file —
only in the server `.env` and your password manager.**

> Fill in the "Owner / stored in" column for your team and keep it current.

| Secret (env var) | What it protects | If lost / changed | Owner / stored in |
|---|---|---|---|
| `CONFIG_ENCRYPTION_KEY` | AES-256-GCM key that encrypts **AI provider API keys** at rest | **Changing or losing it makes every saved AI key undecryptable** — study-plan AI silently falls back to the static plan until each provider key is re-entered. There is no recovery; you must re-add the keys. | _________ |
| `SUPERADMIN_MASTER_PASSWORD` | Break-glass owner login at `/adminpanel` | If lost, you can still log in as a named superadmin (Ahmed). Can be overridden from the panel (Instance → Master Password); the DB value then wins over this env value. | _________ |
| `BULK_DELETE_PASSWORD` | Unlocks **instant** bulk account deletion (skips the 7-day wait) | If unset, instant delete is disabled (scheduled 7-day delete still works). | _________ |
| `JWT_SECRET` | Signs all auth cookies | Changing it logs **everyone** out immediately. | _________ |
| `SUPERADMIN_ACTION_PASSWORD` | Confirms sensitive panel actions | If lost, sensitive mutations are blocked until reset. | _________ |
| DB creds in `DATABASE_URL` / `DIRECT_URL` | Postgres access | Rotate via DigitalOcean; update server `.env`. | _________ |

## CONFIG_ENCRYPTION_KEY — the one that bites later

- **Must be ≥ 32 characters**, long and random (the app refuses to encrypt a key under a weak passphrase). Generate one with:
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
- It is **derived (SHA-256) to a 32-byte AES key**; there is no salt/stretching, so its strength = the string's strength. Use a long random string, never a word.
- It lives **only** in the server `.env` (never the database, never the repo).
- **Keep it STABLE.** Rotating it = all existing encrypted AI keys become garbage. To rotate safely: re-enter every AI provider key in the panel immediately after changing it.
- Back it up in the team password manager. If the server is rebuilt and this value isn't restored, the AI keys are gone.

## Recovery quick-reference

- **"AI plans went back to the generic default"** → check `CONFIG_ENCRYPTION_KEY` matches what the keys were saved under; if it changed, re-enter provider keys in Instance → Advanced Settings → AI providers.
- **"Locked out of the panel"** → log in with `SUPERADMIN_MASTER_PASSWORD` (or a named superadmin). If the master was changed in-panel and forgotten, set `superadmin_master_password_hash` aside in the DB (delete that `AppSetting` row) to fall back to the env value.
- **"Everyone got logged out"** → `JWT_SECRET` changed; restore the previous value or accept the re-login.
