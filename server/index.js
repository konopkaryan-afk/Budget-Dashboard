const express = require('express');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const PASSWORD = process.env.DASHBOARD_PASSWORD || 'changeme';
const SECRET   = process.env.COOKIE_SECRET      || 'cookie-secret-change-me';

function sign(val) {
  return crypto.createHmac('sha256', SECRET).update(val).digest('hex');
}

function authMiddleware(req, res, next) {
  if (req.path === '/login' || req.path === '/logout') return next();
  const raw = req.headers.cookie || '';
  const match = raw.match(/auth=([^;]+)/);
  if (match) {
    const [val, sig] = match[1].split('.');
    if (sig === sign(val) && val === 'ok') return next();
  }
  res.redirect('/login');
}

// ─── Login page ───────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  const error = req.headers.cookie?.includes('auth=') ? '' : '';
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Budget Dashboard — Login</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f1117; color: #f0f2ff;
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
  }
  .card {
    background: #1a1d27; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px; padding: 40px; width: 340px;
  }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
  h1 span { color: #1db87a; }
  p { font-size: 13px; color: #8892aa; margin-bottom: 28px; }
  input {
    width: 100%; padding: 12px 14px; border-radius: 8px;
    background: #22263a; border: 1px solid rgba(255,255,255,0.1);
    color: #f0f2ff; font-size: 15px; margin-bottom: 14px; outline: none;
  }
  input:focus { border-color: #1db87a; }
  button {
    width: 100%; padding: 12px; border-radius: 8px;
    background: #1db87a; color: #fff; font-size: 15px;
    font-weight: 600; border: none; cursor: pointer;
  }
  button:hover { background: #17a368; }
  .error { color: #e05c5c; font-size: 13px; margin-bottom: 12px; }
</style>
</head>
<body>
<div class="card">
  <h1>Budget<span>.</span></h1>
  <p>Enter your password to access the dashboard.</p>
  ${error ? `<div class="error">${error}</div>` : ''}
  <form method="POST" action="/login">
    <input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password">
    <button type="submit">Sign in</button>
  </form>
</div>
</body>
</html>`);
});

app.post('/login', (req, res) => {
  if (req.body.password === PASSWORD) {
    const val = 'ok';
    const sig = sign(val);
    res.setHeader('Set-Cookie', `auth=${val}.${sig}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`);
    res.redirect('/');
  } else {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Budget Dashboard — Login</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f1117; color: #f0f2ff;
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
  }
  .card {
    background: #1a1d27; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px; padding: 40px; width: 340px;
  }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
  h1 span { color: #1db87a; }
  p { font-size: 13px; color: #8892aa; margin-bottom: 28px; }
  input {
    width: 100%; padding: 12px 14px; border-radius: 8px;
    background: #22263a; border: 1px solid rgba(255,255,255,0.1);
    color: #f0f2ff; font-size: 15px; margin-bottom: 14px; outline: none;
  }
  input:focus { border-color: #1db87a; }
  button {
    width: 100%; padding: 12px; border-radius: 8px;
    background: #1db87a; color: #fff; font-size: 15px;
    font-weight: 600; border: none; cursor: pointer;
  }
  button:hover { background: #17a368; }
  .error { color: #e05c5c; font-size: 13px; margin-bottom: 12px; }
</style>
</head>
<body>
<div class="card">
  <h1>Budget<span>.</span></h1>
  <p>Enter your password to access the dashboard.</p>
  <div class="error">Incorrect password — try again.</div>
  <form method="POST" action="/login">
    <input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password">
    <button type="submit">Sign in</button>
  </form>
</div>
</body>
</html>`);
  }
});

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'auth=; Path=/; HttpOnly; Max-Age=0');
  res.redirect('/login');
});

// Apply auth to all routes below
app.use(authMiddleware);
app.use(express.static(path.join(__dirname, '../public')));

// ─── Plaid client setup ───────────────────────────────────────────────────────
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

const accessTokens = [];

// ─── Routes ──────────────────────────────────────────────────────────────────

app.post('/api/create-link-token', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'budget-dashboard-user' },
      client_name: 'My Budget Dashboard',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('Link token error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

app.post('/api/exchange-token', async (req, res) => {
  const { public_token, institution_name } = req.body;
  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    accessTokens.push({ accessToken, itemId, institution: institution_name });
    res.json({ success: true, institution: institution_name });
  } catch (err) {
    console.error('Token exchange error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

app.get('/api/accounts', async (req, res) => {
  try {
    const allAccounts = [];
    for (const { accessToken, institution } of accessTokens) {
      const response = await plaidClient.accountsGet({ access_token: accessToken });
      const accounts = response.data.accounts.map(a => ({
        id: a.account_id,
        name: a.name,
        officialName: a.official_name,
        type: a.type,
        subtype: a.subtype,
        balance: a.balances.current,
        availableBalance: a.balances.available,
        institution,
      }));
      allAccounts.push(...accounts);
    }
    res.json(allAccounts);
  } catch (err) {
    console.error('Accounts error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const allTransactions = [];
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    for (const { accessToken, institution } of accessTokens) {
      let hasMore = true;
      while (hasMore) {
        const params = { access_token: accessToken, start_date: startDate, end_date: endDate, count: 500 };
        const response = await plaidClient.transactionsGet(params);
        const txns = response.data.transactions.map(t => ({
          id: t.transaction_id,
          date: t.date,
          name: t.merchant_name || t.name,
          amount: t.amount,
          category: mapCategory(t.personal_finance_category?.primary || t.category?.[0] || 'Other'),
          accountId: t.account_id,
          institution,
          pending: t.pending,
        }));
        allTransactions.push(...txns);
        hasMore = false;
      }
    }
    res.json(allTransactions);
  } catch (err) {
    console.error('Transactions error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/institutions', (req, res) => {
  res.json(accessTokens.map(({ itemId, institution }) => ({ itemId, institution })));
});

// ─── Category mapper ─────────────────────────────────────────────────────────
function mapCategory(plaidCategory) {
  const map = {
    FOOD_AND_DRINK: 'Food', RESTAURANTS: 'Food', GROCERIES: 'Food',
    ENTERTAINMENT: 'Entertainment', RECREATION: 'Entertainment',
    TRAVEL: 'Transport', TRANSPORTATION: 'Transport', TAXI: 'Transport',
    RENT_AND_UTILITIES: 'Utilities', UTILITIES: 'Utilities',
    HOME_IMPROVEMENT: 'Housing', MORTGAGE: 'Housing', LOAN_PAYMENTS: 'Housing',
    MEDICAL: 'Health', HEALTHCARE_SERVICES: 'Health', PERSONAL_CARE: 'Health',
    GENERAL_MERCHANDISE: 'Shopping', CLOTHING: 'Shopping', ELECTRONICS: 'Shopping',
    PAYROLL: 'Income', INCOME: 'Income', TRANSFER_IN: 'Income',
    TRANSFER_OUT: 'Transfer', BANK_FEES: 'Other',
  };
  return map[plaidCategory?.toUpperCase()] || 'Other';
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n✅ Budget dashboard running at http://localhost:${PORT}\n`));
