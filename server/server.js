/**
 * RE RE MAIL — Full Stack Backend
 * Node.js + Express + sql.js (pure JS SQLite — no compilation required)
 */

const express = require('express');
const path = require('path');
const { initDatabase } = require('../db/init');
const seedDemoData = require('../db/seed');
const authMiddleware = require('../middleware/auth');

const authRoutes = require('../routes/auth');
const mailsRoutes = require('../routes/mails');
const meetingsRoutes = require('../routes/meetings');
const notificationsRoutes = require('../routes/notifications');
const accountsRoutes = require('../routes/accounts');
const labelsRoutes = require('../routes/labels');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

initDatabase().then(({ db, hashPass, genToken }) => {
  const auth = authMiddleware(db);

  // Routes
  // auth routes should not require a token (signup/login/demo)
  app.use('/api/auth', authRoutes(db, hashPass, genToken, seedDemoData.bind(null, db)));
  app.use('/api/mails', auth, mailsRoutes(db));
  app.use('/api/meetings', auth, meetingsRoutes(db));
  app.use('/api/notifications', auth, notificationsRoutes(db));
  app.use('/api/accounts', auth, accountsRoutes(db));
  app.use('/api/labels', auth, labelsRoutes(db));

  // FRONTEND
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  const tryListen = (port) => {
    const server = app.listen(port, () => {
      console.log(`\n🚀 Re Re Mail server running on http://localhost:${port}\n`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`Port ${port} in use, trying ${port + 1}...`);
        return tryListen(port + 1);
      }
      console.error('Server error:', err);
      process.exit(1);
    });
  };

  tryListen(PORT);

}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = app;
