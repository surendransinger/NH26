const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // MEETINGS
  router.get('/', (req, res) => {
    res.json(db.prepare('SELECT * FROM meetings WHERE user_id=? ORDER BY date ASC, start_time ASC').all(req.userId));
  });

  router.post('/', (req, res) => {
    const { mail_id, title, date, start_time, end_time, sender_name, notes } = req.body;
    const existing = db.prepare('SELECT id FROM meetings WHERE user_id=? AND title=? AND date=?').get(req.userId, title, date);
    if (existing) return res.status(409).json({ error: 'Meeting already exists', id: existing.id });
    const r = db.prepare('INSERT INTO meetings (user_id, mail_id, title, date, start_time, end_time, sender_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(req.userId, mail_id || null, title, date, start_time, end_time, sender_name, notes || '');
    res.json(db.prepare('SELECT * FROM meetings WHERE id=?').get(r.lastInsertRowid));
  });

  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM meetings WHERE id=? AND user_id=?').run(req.params.id, req.userId);
    res.json({ deleted: true });
  });

  return router;
};