const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // LABELS
  router.get('/', (req, res) => {
    res.json(db.prepare('SELECT * FROM labels WHERE user_id=?').all(req.userId));
  });

  router.post('/', (req, res) => {
    const { name, color } = req.body;
    const r = db.prepare('INSERT INTO labels (user_id, name, color) VALUES (?, ?, ?)').run(req.userId, name, color || '#c8ff00');
    res.json(db.prepare('SELECT * FROM labels WHERE id=?').get(r.lastInsertRowid));
  });

  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM labels WHERE id=? AND user_id=?').run(req.params.id, req.userId);
    res.json({ deleted: true });
  });

  return router;
};