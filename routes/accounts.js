const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // LINKED ACCOUNTS
  router.get('/', (req, res) => {
    res.json(db.prepare('SELECT * FROM linked_accounts WHERE user_id=?').all(req.userId));
  });

  router.post('/link', (req, res) => {
    const { provider, provider_email, provider_user_id, is_primary } = req.body;
    if (!provider || !provider_email) return res.status(400).json({ error: 'provider and provider_email required' });

    if (is_primary) {
      db.prepare('UPDATE linked_accounts SET is_primary=0 WHERE user_id=?').run(req.userId);
    }

    const existing = db.prepare('SELECT * FROM linked_accounts WHERE user_id=? AND provider=?').get(req.userId, provider);
    if (existing) {
      db.prepare('UPDATE linked_accounts SET provider_email=?, provider_user_id=?, status=?, is_primary=? WHERE id=?')
        .run(provider_email, provider_user_id || existing.provider_user_id, 'connected', is_primary ? 1 : existing.is_primary, existing.id);
      return res.json(db.prepare('SELECT * FROM linked_accounts WHERE id=?').get(existing.id));
    }

    const r = db.prepare('INSERT INTO linked_accounts (user_id, provider, provider_email, provider_user_id, status, is_primary) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.userId, provider, provider_email, provider_user_id || null, 'connected', is_primary ? 1 : 0);

    res.json(db.prepare('SELECT * FROM linked_accounts WHERE id=?').get(r.lastInsertRowid));
  });

  router.delete('/unlink/:id', (req, res) => {
    const account = db.prepare('SELECT * FROM linked_accounts WHERE id=? AND user_id=?').get(req.params.id, req.userId);
    if (!account) return res.status(404).json({ error: 'linked account not found' });
    db.prepare('DELETE FROM linked_accounts WHERE id=?').run(req.params.id);
    res.json({ success: true });
  });

  router.post('/sync/:id', (req, res) => {
    const account = db.prepare('SELECT * FROM linked_accounts WHERE id=? AND user_id=?').get(req.params.id, req.userId);
    if (!account) return res.status(404).json({ error: 'linked account not found' });

    // Fake Gmail sync for demo/demo mode
    const messages = [
      {
        id: `sync-${Date.now()}`,
        from: 'noreply@gmail.com',
        subject: 'Gmail Sync Successful',
        body: `Your ${account.provider} account is now synced with Re Re Mail at ${new Date().toISOString()}`,
      },
    ];

    // In real app, create mails and notifications from Gmail payload
    res.json({ synced: true, account, messages });
  });

  return router;
};