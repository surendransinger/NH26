const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // LINKED ACCOUNTS
  router.get('/', (req, res) => {
    res.json(db.prepare('SELECT * FROM linked_accounts WHERE user_id=?').all(req.userId));
  });

  router.post('/link', (req, res) => {
    const { provider, provider_email } = req.body;
    const existing = db.prepare('SELECT * FROM linked_accounts WHERE user_id=? AND provider=?').get(req.userId, provider);
    if (existing) return res.json(existing);
    const r = db.prepare('INSERT INTO linked_accounts (user_id, provider, provider_email) VALUES (?, ?, ?)').run(req.userId, provider, provider_email);
    res.json(db.prepare('SELECT * FROM linked_accounts WHERE id=?').get(r.lastInsertRowid));
  });

  return router;
};