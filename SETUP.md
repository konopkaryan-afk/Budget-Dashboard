# Budget Dashboard — Setup Guide

A personal budget dashboard that connects to Chase, Wells Fargo, and Charles Schwab
via Plaid, with AI-powered savings suggestions from Claude.

---

## What you'll need
- A computer with Node.js installed (free: https://nodejs.org — download the LTS version)
- A free Plaid developer account
- ~15 minutes

---

## Step 1 — Get your free Plaid API keys

1. Go to **https://dashboard.plaid.com/signup** and create a free account
2. After signing in, go to **Team Settings → Keys**
3. Copy your **Client ID** and **Sandbox Secret** — you'll need both in Step 3
4. You're on the **Trial plan** by default — this is free and supports up to 10 bank accounts

> **Note:** In Sandbox mode, Plaid gives you fake test bank accounts so you can try
> everything without connecting a real bank. When you're ready to connect your real
> Chase, Wells Fargo, and Schwab accounts, you'll switch to Production (see Step 6).

---

## Step 2 — Download and install the dashboard

Open **Terminal** (Mac) or **Command Prompt** (Windows) and run:

```bash
# 1. Move into the budget-dashboard folder
cd budget-dashboard

# 2. Install dependencies (this takes ~30 seconds)
npm install
```

---

## Step 3 — Add your Plaid keys

In the `budget-dashboard` folder, copy the example env file:

```bash
cp .env.example .env
```

Then open `.env` in any text editor (Notepad, TextEdit, VS Code) and fill in:

```
PLAID_CLIENT_ID=paste_your_client_id_here
PLAID_SECRET=paste_your_sandbox_secret_here
PLAID_ENV=sandbox
PORT=3000
```

Save the file.

---

## Step 4 — Start the server

```bash
npm start
```

You should see:

```
✅ Budget dashboard running at http://localhost:3000
```

Open **http://localhost:3000** in your browser (Chrome works best on a tablet).

---

## Step 5 — Connect a test bank (Sandbox)

1. Click **"+ Connect bank"** in the top right
2. Choose any bank (Chase, Wells Fargo, etc.)
3. Plaid's popup will appear — use these **test credentials**:
   - Username: `user_good`
   - Password: `pass_good`
4. Select any accounts shown and click Continue
5. Your fake transactions will load automatically!

The AI suggestions button uses your real Claude account — it will analyze
whichever month you have selected.

---

## Step 6 — Connect your REAL banks (Production)

When you're ready to use real account data:

### 6a — Apply for Production access on Plaid

1. In the Plaid Dashboard, click **"Request access"** → **Production**
2. Fill in the short form (for personal use, describe it as a personal finance tool)
3. Approval usually takes **1–2 business days**

### 6b — Get your Production secret

Once approved, go to **Team Settings → Keys** and copy your **Production Secret**

### 6c — Update your .env file

```
PLAID_SECRET=your_production_secret_here
PLAID_ENV=production
```

Restart the server (`Ctrl+C` then `npm start`) and connect your real banks.

### 6d — Charles Schwab note

Schwab requires a separate approval step:
1. In the Plaid Dashboard, open a support ticket and request **Schwab Production access**
2. This takes up to **5 weeks** — Schwab vets each developer individually
3. Chase and Wells Fargo will work immediately once you're on Production

---

## Step 7 — Open on your tablet

Since the server runs on your computer, you can open the dashboard on any device
on your home Wi-Fi:

1. Find your computer's local IP address:
   - **Mac:** System Settings → Wi-Fi → Details → IP Address
   - **Windows:** Settings → Network → Wi-Fi → Properties → IPv4 address
2. On your tablet, open: `http://YOUR_IP_ADDRESS:3000`
   - Example: `http://192.168.1.42:3000`

The dashboard is fully responsive and optimized for tablet screens.

---

## Keeping it running

The server needs to be running on your computer for the dashboard to work.
To make it start automatically, you can use a tool like **PM2**:

```bash
npm install -g pm2
pm2 start server/index.js --name budget-dashboard
pm2 startup   # makes it auto-start on reboot
pm2 save
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm: command not found` | Install Node.js from https://nodejs.org |
| Dashboard shows "Server not running" | Run `npm start` in the budget-dashboard folder |
| Bank connection fails in Production | Make sure `PLAID_ENV=production` and secret is correct |
| Schwab won't connect | Submit a Plaid support ticket to request Schwab access |
| Transactions not showing | Click "↻ Refresh" — new accounts take ~30 seconds to sync |

---

## Security notes

- Your Plaid API keys live only in `.env` on your computer — never share this file
- The dashboard only runs on your local network — it's not exposed to the internet
- Plaid never shares your bank password with this app — it uses secure OAuth tokens
- To revoke access at any time, go to your bank's app → Security → Connected Apps
