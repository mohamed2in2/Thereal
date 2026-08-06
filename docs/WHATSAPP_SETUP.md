# WhatsApp Service Integration Guide (Baileys)

This document provides a comprehensive operational guide for the `@whiskeysockets/baileys` WhatsApp integration built directly into the **Code-UP** platform.

---

## Architectural Highlights

- **Multi-File Auth**: Persisted in `whatsapp-auth/` (excluded from git).
- **Automatic Reconnection**: Re-connects seamlessly without requiring QR scans after server restarts or network blips, as long as the session remains valid.
- **FIFO Message Queue**:
  - Global Cooldown: 5 seconds delay between queued messages.
  - OTP Cooldown: Additional 10 seconds delay between OTP messages.
  - Exponential Backoff Retries: Up to 3 attempts for transient failures.
- **Rate Limiter**:
  - Max 5 OTPs per phone per hour.
  - Max 20 OTPs per phone per day.
  - 60 seconds minimum cooldown between OTP requests from the same phone.
- **Logging**: Rotating log files saved in `logs/whatsapp.log`.
- **Admin UI**: Control panel under **Admin Dashboard ➔ System ➔ WhatsApp** (`🟢 Connected` status, QR pairing scanner, queue counter, disconnect/logout controls).

---

## 1. Installation

Dependencies are pre-installed in `package.json`:

```bash
npm install @whiskeysockets/baileys qrcode
npm install -D @types/qrcode
```

---

## 2. Pairing Your WhatsApp Account (First Time Setup)

1. Start your application locally or on server:
   ```bash
   npm run build
   pm2 restart ecosystem.config.js
   ```
2. Log into the **Code-UP Admin Panel** as a Superadmin or Admin (`/adminpanel`).
3. Navigate to **System ➔ 💬 خدمة WhatsApp** in the sidebar.
4. If status displays `🔴 Not Connected (Not Connected)`, a QR code will be generated on screen.
5. Open **WhatsApp** on your phone:
   - Go to **Settings / Menu ➔ Linked Devices (الأجهزة المقترنة)**
   - Tap **Link a Device (ربط جهاز)**
   - Scan the QR code displayed on the Admin UI page.
6. The Admin page will automatically detect the connection and update to **`🟢 Connected`**.
7. The pairing session is saved to `whatsapp-auth/`. Future application restarts or server reboots will **NOT** require re-scanning.

---

## 3. Usage in Code (Internal API)

Import the global `whatsapp` service:

```typescript
import { whatsapp } from "@/lib/whatsapp/index";

// Send a standard WhatsApp text message
await whatsapp.sendMessage("201012345678", "Hello from Code-UP!");

// Send an OTP code (uses rate limiting & formatted OTP template)
await whatsapp.sendOTP("201012345678", "123456");

// Check current connection status & metrics
const status = whatsapp.getStatus();
console.log(status.connected, status.user, status.queueLength);

// Disconnect & wipe session
await whatsapp.logout();
```

---

## 4. PM2 & Deployment

Ensure `logs/` and `whatsapp-auth/` directories are preserved across PM2 reloads:

```bash
# Check running PM2 processes
pm2 status

# Reload without dropping WhatsApp session
pm2 reload ecosystem.config.js
```

---

## 5. Troubleshooting & Maintenance

### Session Invalidation / Expired Session
If WhatsApp is unlinked from the phone app or session becomes invalid:
1. Navigate to **Admin ➔ WhatsApp**.
2. Click **تسجيل الخروج (Logout)** to clear the corrupted session files in `whatsapp-auth/`.
3. Scan the newly generated QR code to re-pair.

### Updating Baileys
To update Baileys to the latest WhatsApp protocol version:

```bash
npm install @whiskeysockets/baileys@latest
```

---

## 6. Logs & Auditing

Logs are automatically written to `logs/whatsapp.log` with automatic 5MB log file rotation:

```bash
tail -f logs/whatsapp.log
```
