const express = require('express');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
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

// In-memory store for access tokens (use a database in production)
const accessTokens = [];

// ─── Routes ──────────────────────────────────────────────────────────────────

// Create a Plaid Link token (step 1 of the connection flow)
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

// Exchange public token for access token (step 2)
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

// Get all connected accounts
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

// Get transactions for the past 6 months
app.get('/api/transactions', async (req, res) => {
  try {
    const allTransactions = [];
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    for (const { accessToken, institution } of accessTokens) {
      let cursor = null;
      let hasMore = true;

      while (hasMore) {
        const params = {
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          count: 500,
        };
        if (cursor) params.cursor = cursor;

        const response = await plaidClient.transactionsGet(params);
        const txns = response.data.transactions.map(t => ({
          id: t.transaction_id,
          date: t.date,
          name: t.merchant_name || t.name,
          amount: t.amount,         // positive = money out, negative = money in (Plaid convention)
          category: mapCategory(t.personal_finance_category?.primary || t.category?.[0] || 'Other'),
          accountId: t.account_id,
          institution,
          pending: t.pending,
        }));
        allTransactions.push(...txns);
        hasMore = response.data.total_transactions > allTransactions.length;
        cursor = null; // simple pagination for demo
        hasMore = false; // avoid infinite loop — remove for production cursor-based pagination
      }
    }

    res.json(allTransactions);
  } catch (err) {
    console.error('Transactions error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// List connected institutions
app.get('/api/institutions', (req, res) => {
  res.json(accessTokens.map(({ itemId, institution }) => ({ itemId, institution })));
});

// ─── Category mapper ─────────────────────────────────────────────────────────
function mapCategory(plaidCategory) {
  const map = {
    FOOD_AND_DRINK: 'Food',
    RESTAURANTS: 'Food',
    GROCERIES: 'Food',
    ENTERTAINMENT: 'Entertainment',
    RECREATION: 'Entertainment',
    TRAVEL: 'Transport',
    TRANSPORTATION: 'Transport',
    TAXI: 'Transport',
    RENT_AND_UTILITIES: 'Utilities',
    UTILITIES: 'Utilities',
    HOME_IMPROVEMENT: 'Housing',
    MORTGAGE: 'Housing',
    MEDICAL: 'Health',
    HEALTHCARE_SERVICES: 'Health',
    PERSONAL_CARE: 'Health',
    GENERAL_MERCHANDISE: 'Shopping',
    CLOTHING: 'Shopping',
    ELECTRONICS: 'Shopping',
    PAYROLL: 'Income',
    INCOME: 'Income',
    TRANSFER_IN: 'Income',
    TRANSFER_OUT: 'Transfer',
    LOAN_PAYMENTS: 'Housing',
    BANK_FEES: 'Other',
  };
  return map[plaidCategory?.toUpperCase()] || 'Other';
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n✅ Budget dashboard running at http://localhost:${PORT}\n`));
