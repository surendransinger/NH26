const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // NOTIFICATIONS
  router.get('/', (req, res) => {
    res.json(db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.userId));
  });

  router.patch('/:id/read', (req, res) => {
    db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id, req.userId);
    res.json({ ok: true });
  });

  router.post('/read-all', (req, res) => {
    db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.userId);
    res.json({ ok: true });
  });

  router.delete('/', (req, res) => {
    db.prepare('DELETE FROM notifications WHERE user_id=?').run(req.userId);
    res.json({ cleared: true });
  });

  return router;
};