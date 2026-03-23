const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // MAILS
  router.get('/', (req, res) => {
    const { folder = 'inbox', filter, search } = req.query;
    let query = 'SELECT * FROM mails WHERE user_id = ?';
    const params = [req.userId];
    if (folder === 'important') query += ' AND is_important = 1 AND folder NOT IN ("trash","spam")';
    else if (folder === 'meetings') query += ' AND has_meeting = 1 AND folder != "trash"';
    else if (folder === 'newsletters') query += ' AND (sender_name LIKE "%Newsletter%" OR sender_name LIKE "%Coursera%" OR sender_name LIKE "%Digest%")';
    else if (folder === 'deadlines') query += ' AND tags LIKE "%dead%" AND folder != "trash"';
    else if (folder === 'starred') query += ' AND is_starred = 1 AND folder != "trash"';
    else { query += ' AND folder = ?'; params.push(folder); }
    if (filter === 'unread') query += ' AND is_unread = 1';
    else if (filter === 'starred') query += ' AND is_starred = 1';
    else if (filter === 'important') query += ' AND is_important = 1';
    if (search) {
      query += ' AND (subject LIKE ? OR sender_name LIKE ? OR body LIKE ? OR sender_email LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    query += ' ORDER BY received_at DESC';
    const mails = db.prepare(query).all(...params);
    res.json(mails.map(m => ({ ...m, tags: JSON.parse(m.tags || '[]') })));
  });

  router.get('/stats', (req, res) => {
    const uid = req.userId;
    res.json({
      inbox_unread: db.prepare('SELECT COUNT(*) as n FROM mails WHERE user_id=? AND folder="inbox" AND is_unread=1').get(uid).n,
      important: db.prepare('SELECT COUNT(*) as n FROM mails WHERE user_id=? AND is_important=1 AND folder NOT IN ("trash","spam")').get(uid).n,
      spam: db.prepare('SELECT COUNT(*) as n FROM mails WHERE user_id=? AND folder="spam"').get(uid).n,
      trash_count: db.prepare('SELECT COUNT(*) as n FROM mails WHERE user_id=? AND folder="trash"').get(uid).n,
      sent_count: db.prepare('SELECT COUNT(*) as n FROM mails WHERE user_id=? AND folder="sent"').get(uid).n,
      draft_count: db.prepare('SELECT COUNT(*) as n FROM mails WHERE user_id=? AND folder="draft"').get(uid).n,
      meetings: db.prepare('SELECT COUNT(*) as n FROM meetings WHERE user_id=?').get(uid).n,
      notifs: db.prepare('SELECT COUNT(*) as n FROM notifications WHERE user_id=? AND is_read=0').get(uid).n,
    });
  });

  router.get('/:id', (req, res) => {
    const mail = db.prepare('SELECT * FROM mails WHERE id=? AND user_id=?').get(req.params.id, req.userId);
    if (!mail) return res.status(404).json({ error: 'Not found' });
    res.json({ ...mail, tags: JSON.parse(mail.tags || '[]') });
  });

  router.post('/', (req, res) => {
    const { folder = 'sent', sender_name, sender_email, recipient_email, subject, body, preview, category = 'normal', tags = [] } = req.body;
    const r = db.prepare('INSERT INTO mails (user_id, folder, sender_name, sender_email, recipient_email, subject, body, preview, is_unread, is_starred, is_important, category, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)').run(req.userId, folder, sender_name, sender_email, recipient_email, subject, body, preview || body?.slice(0, 80) || '', category, JSON.stringify(tags));
    const mail = db.prepare('SELECT * FROM mails WHERE id=?').get(r.lastInsertRowid);
    res.json({ ...mail, tags: JSON.parse(mail.tags || '[]') });
  });

  router.patch('/:id', (req, res) => {
    const mail = db.prepare('SELECT * FROM mails WHERE id=? AND user_id=?').get(req.params.id, req.userId);
    if (!mail) return res.status(404).json({ error: 'Not found' });
    const { folder, is_unread, is_starred, is_important, category, tags } = req.body;
    const updates = [], vals = [];
    if (folder !== undefined) { updates.push('folder=?'); vals.push(folder); }
    if (is_unread !== undefined) { updates.push('is_unread=?'); vals.push(is_unread); }
    if (is_starred !== undefined) { updates.push('is_starred=?'); vals.push(is_starred); }
    if (is_important !== undefined) { updates.push('is_important=?'); vals.push(is_important ? 1 : 0); }
    if (category !== undefined) { updates.push('category=?'); vals.push(category); }
    if (tags !== undefined) { updates.push('tags=?'); vals.push(JSON.stringify(tags)); }
    if (updates.length) db.prepare(`UPDATE mails SET ${updates.join(',')} WHERE id=? AND user_id=?`).run(...vals, req.params.id, req.userId);
    const updated = db.prepare('SELECT * FROM mails WHERE id=?').get(req.params.id);
    res.json({ ...updated, tags: JSON.parse(updated.tags || '[]') });
  });

  router.delete('/:id', (req, res) => {
    const mail = db.prepare('SELECT * FROM mails WHERE id=? AND user_id=?').get(req.params.id, req.userId);
    if (!mail) return res.status(404).json({ error: 'Not found' });
    if (mail.folder === 'trash') {
      db.prepare('DELETE FROM mails WHERE id=? AND user_id=?').run(req.params.id, req.userId);
      res.json({ deleted: true });
    } else {
      db.prepare('UPDATE mails SET folder="trash" WHERE id=? AND user_id=?').run(req.params.id, req.userId);
      res.json({ moved_to_trash: true });
    }
  });

  return router;
};