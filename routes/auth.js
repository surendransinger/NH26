const express = require('express');
const router = express.Router();

module.exports = (db, hashPass, genToken, seedDemoData) => {
  // AUTH
  router.post('/signup', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password too short' });
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Email already registered' });
    const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const result = db.prepare('INSERT INTO users (name, email, password_hash, avatar) VALUES (?, ?, ?, ?)').run(name, email, hashPass(password), avatar);
    const userId = result.lastInsertRowid;
    seedDemoData(userId);
    const token = genToken();
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
    res.json({ token, user: { id: userId, name, email, avatar } });
  });

  router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || user.password_hash !== hashPass(password)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = genToken();
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
  });

  router.post('/demo', (req, res) => {
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get('demo@rere.app');
    if (!user) {
      const r = db.prepare('INSERT INTO users (name, email, password_hash, avatar) VALUES (?, ?, ?, ?)').run('James Smith', 'demo@rere.app', hashPass('demo123'), 'JS');
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
    }
    seedDemoData(user.id);
    const token = genToken();
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
  });

  router.post('/logout', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    res.json(db.prepare('SELECT id, name, email, avatar FROM users WHERE id = ?').get(req.userId));
  });

  return router;
};