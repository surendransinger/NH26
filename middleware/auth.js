function authMiddleware(db) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
    if (!session) return res.status(401).json({ error: 'Invalid session' });
    req.userId = session.user_id;
    req.token = token;
    next();
  };
}

module.exports = authMiddleware;