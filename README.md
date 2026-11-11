# Deriv Live Scanner — second GitHub deployment + Telegram alerts

This starter is based on the supplied `legacy-trading-deriv-live 5.html` file. It keeps the existing Deriv scanner strategy and market-analysis logic, adds a small Telegram settings panel, and includes a Cloudflare Worker relay so the Telegram bot token is never placed in the public HTML repository.

## What runs where

- **GitHub Pages** hosts `index.html`. It does not run a browser scanner in the background.
- **The browser tab** connects to Deriv WebSocket feeds and performs the scanning. Keep the page open and the device awake for continuous browser scanning. Mobile browsers may pause a background tab.
- **Cloudflare Worker** receives a READY alert from the browser and sends it to Telegram. It does not scan markets itself.
- **Telegram** receives READY alerts only. The scanner's existing local sound/vibration/browser alerts remain available.

This is an alert relay, not an automated trading system. It does not place orders. Always verify prices and setups manually.

---

# Part A — Create a second GitHub repository

1. Sign in to the GitHub account that hosts your first signal project.
2. Open https://github.com/new.
3. Repository name: `deriv-live-scanner-telegram` (or another name you prefer).
4. Description: `Independent Deriv live market scanner with Telegram READY alerts`.
5. Choose **Public** if you want to use GitHub Pages on the free GitHub plan. The source code will be public. Do not put secrets in it.
6. Select **Add a README file** only if creating an empty repository from the GitHub website. If uploading this prepared folder, either choice is okay; avoid overwriting the prepared README if GitHub asks.
7. Click **Create repository**.

## Upload the app files

1. Open the new repository page.
2. Click **Add file → Upload files**.
3. Extract the ZIP downloaded with this guide on your computer.
4. Upload the contents of the folder (not an extra enclosing folder): `index.html`, `README.md`, `worker.js`, `wrangler.toml`, and `.gitignore`.
5. Scroll down and click **Commit changes**.
6. Confirm that `index.html` is visible at the top level of the repository. GitHub Pages needs it there.

## Turn on GitHub Pages

1. In the repository, open **Settings**.
2. In the left menu, open **Pages** (under Code and automation).
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Branch: `main`; folder: `/(root)`.
5. Click **Save**.
6. Wait for the Pages deployment to finish. Refresh Settings → Pages until GitHub displays the live URL, usually `https://YOUR-USERNAME.github.io/deriv-live-scanner-telegram/`.
7. Open that HTTPS URL. Do not open the HTML as a local file; the browser may block the live WebSocket connection from a `file://` address.
8. Test that the scanner page loads and shows its live connection / scan status.

Your first GitHub signal repository remains unchanged. This new repository has its own Pages URL and deployment.

---

# Part B — Create or choose a Telegram bot

You can use a new bot for this scanner (recommended for separation) or reuse an existing bot if you want both systems to message the same Telegram chat. A bot can send messages to a chat once that chat has started the bot or the bot has been added to the group/channel.

## Create a new bot with BotFather

1. Open Telegram and search for the verified account `@BotFather`.
2. Open the chat and send `/newbot`.
3. Enter a display name, e.g. `Deriv Live Scanner Alerts`.
4. Enter a unique username ending in `bot`, e.g. `YourDerivLiveAlertsBot` (if available).
5. BotFather returns an API token. Copy it and keep it private. Anyone with this token can control your bot.
6. Open your new bot using its `t.me/...` link and press **Start**. This is required before it can message you privately.

## Find your Telegram chat ID

1. In Telegram, open the bot you just created and press **Start**; send `/start` or a short message.
2. In a browser, visit this URL after replacing `BOT_TOKEN` with your actual token:
   `https://api.telegram.org/botBOT_TOKEN/getUpdates`
3. Find the JSON section containing `"chat":{"id":...}`. The number after `id` is your private chat ID. Copy it.
4. Treat the bot token and chat ID as private. Do not paste the token into GitHub, `index.html`, a screenshot, or a public chat.

For a group/channel, add the bot to the destination and grant permission to post. The chat ID may be a negative number for a group/channel. Use the destination's chat ID, not your personal ID.

---

# Part C — Deploy the secure Telegram relay on Cloudflare Workers

The free Cloudflare Workers allowance is generally enough for a light alert relay, subject to Cloudflare's current limits and terms. This Worker only forwards READY alerts; it does not keep the scanner running.

## Create the Worker

1. Sign in at https://dash.cloudflare.com/ (create a free account if needed).
2. Open **Workers & Pages**.
3. Choose **Create application** → **Create Worker**.
4. Name it `deriv-live-telegram-relay` and deploy the starter Worker.
5. Open the Worker and choose **Edit code**.
6. Replace the sample code with the complete contents of this folder's `worker.js`.
7. Save and deploy.
8. Open the Worker **Settings** → **Variables and Secrets** (the exact menu label may vary).
9. Add these three values as **secrets**, not plain text variables:
   - `TELEGRAM_BOT_TOKEN` = the token BotFather gave you.
   - `TELEGRAM_CHAT_ID` = the chat ID you retrieved.
   - `ALERT_KEY` = a long random password that you create. Use a different value from your Telegram bot token. A password manager can generate one; 32+ random characters is a good target.
10. Save the secrets and redeploy if Cloudflare asks.
11. Copy the Worker URL, e.g. `https://deriv-live-telegram-relay.YOUR-SUBDOMAIN.workers.dev`.
12. Test it by opening `WORKER_URL/health`. It should return JSON similar to `{"ok":true,"service":"Deriv Live Telegram relay"}`.

### Important security rules

- Never add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, or your `ALERT_KEY` to a GitHub commit, public issue, HTML source, or screenshot.
- The bot token and chat ID live only in Cloudflare Worker secrets.
- The alert key is entered in the scanner settings on your device. It is not the bot token. If you think it has been exposed, change the `ALERT_KEY` secret in Cloudflare and update the value in the scanner.
- If the bot token is exposed, revoke it with BotFather and create a replacement.

---

# Part D — Connect the GitHub app to Telegram

1. Open the GitHub Pages URL for the new scanner.
2. On the scanner page, open **Telegram alert connection**.
3. Paste the Cloudflare Worker URL into **Cloudflare Worker URL**. Do not add `/telegram` to the end; the app adds that route itself.
4. Paste the exact `ALERT_KEY` value you saved as a Cloudflare secret into **Alert access key**.
5. Click **Save Telegram settings**.
6. The settings are saved in this browser on this device. If you open the app on another device/browser, enter them there too.
7. Keep the page open, enable browser alerts if you also want sound/vibration, and wait for a new READY transition. The Worker sends Telegram messages when a market changes into READY; it does not send every scan cycle or repeat an unchanged READY state.

## Test without waiting for a market signal

The `/health` endpoint only checks that the Worker is deployed; it does not send a Telegram message. To test the complete path, you can temporarily add a test request from your computer's terminal (replace the URL and key locally; do not commit them):

```bash
curl -X POST "https://YOUR-WORKER.workers.dev/telegram" \
  -H "Content-Type: application/json" \
  -H "X-Alert-Key: YOUR_ALERT_KEY" \
  -d '{"market":"TEST MARKET","symbol":"TEST","direction":"BUY","status":"READY","score":8,"entry":"test entry","stop_loss":"test stop","take_profits":["test TP1","test TP2"],"zone":"test zone","trigger":"Manual connection test"}'
```

A successful response includes `"ok":true`, and the Telegram chat should receive a test message. Delete the test message if desired.

---

# Part E — Updating this second app later

1. Open the second repository on GitHub.
2. Open `index.html` and click the pencil (Edit) icon, or upload a replacement file.
3. Make changes and commit them to `main`.
4. GitHub Pages automatically rebuilds the site. Refresh the live URL after deployment.
5. If you change `worker.js`, open the Cloudflare Worker, edit its code, and deploy again. GitHub Pages does not deploy the Worker automatically.
6. Keep the Worker secrets configured in Cloudflare; do not copy them into GitHub.

## Troubleshooting

- **Scanner says it cannot connect from a local file:** use the HTTPS GitHub Pages URL, not a downloaded `file://` page.
- **Page loads but scanning stops:** keep the browser tab open and the device awake. GitHub Pages is hosting, not a background compute service.
- **Telegram alerts do not arrive:** confirm you pressed Start in the bot chat; verify the Worker URL; verify `ALERT_KEY` matches exactly; check Cloudflare Worker logs; confirm bot token and chat ID secrets.
- **HTTP 401:** the alert key sent by the page does not match Cloudflare's `ALERT_KEY` secret.
- **HTTP 500:** one or more Worker secrets are missing.
- **Telegram rejects the message:** check the token and destination chat ID, and confirm the bot has permission to post there.
- **No Telegram alert despite a READY card:** this integration sends only on a new READY transition, not continuously for a setup that was already READY before the Telegram settings were saved.

## Important limitation: 24/7 operation

This setup does not make the browser scanner run 24/7 by itself. If you close the page, the device sleeps, or the browser suspends the tab, scanning may stop. To scan continuously without an open browser, the scan engine itself would need to be moved into a server-side service (for example a separately designed Worker/ durable service or a small always-on server), with appropriate Deriv connection handling. This starter deliberately preserves the supplied browser-based scanner rather than pretending GitHub Pages is a server.
