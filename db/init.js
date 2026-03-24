const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '../db/rere.db');

function ensureDatabaseDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createDbWrapper(SQL) {
  ensureDatabaseDir();
  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      sqlDb = new SQL.Database(fileBuffer);
    } catch (err) {
      console.warn('⚠️ DB file is unreadable/corrupt, recreating:', err.message);
      fs.unlinkSync(DB_PATH);
      sqlDb = new SQL.Database();
    }
  } else {
    sqlDb = new SQL.Database();
  }

  function save() {
    const data = sqlDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  return {
    exec(sql) {
      sqlDb.run(sql);
      save();
    },
    prepare(sql) {
      return {
        get(...params) {
          try {
            const stmt = sqlDb.prepare(sql);
            stmt.bind(params);
            if (stmt.step()) {
              const row = stmt.getAsObject();
              stmt.free();
              return row;
            }
            stmt.free();
            return undefined;
          } catch (err) {
            console.error('DB prepare/get error:', err);
            throw err;
          }
        },
        all(...params) {
          try {
            const stmt = sqlDb.prepare(sql);
            stmt.bind(params);
            const rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            stmt.free();
            return rows;
          } catch (err) {
            console.error('DB prepare/all error:', err);
            throw err;
          }
        },
        run(...params) {
          try {
            sqlDb.run(sql, params);
            const lastId = sqlDb.exec('SELECT last_insert_rowid() as id')[0];
            const lastInsertRowid = lastId ? lastId.values[0][0] : 0;
            save();
            return { lastInsertRowid };
          } catch (err) {
            console.error('DB prepare/run error:', err);
            throw err;
          }
        }
      };
    }
  };
}

function hashPass(pass) {
  return crypto.createHash('sha256').update(pass + 'rere_salt_2026').digest('hex');
}

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function initDatabase() {
  const SQL = await initSqlJs();

  const initialize = () => {
    const db = createDbWrapper(SQL);
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, avatar TEXT DEFAULT 'JS', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS mails (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, folder TEXT DEFAULT 'inbox', sender_name TEXT NOT NULL, sender_email TEXT NOT NULL, recipient_email TEXT, subject TEXT NOT NULL, body TEXT, preview TEXT, is_unread INTEGER DEFAULT 1, is_starred INTEGER DEFAULT 0, is_important INTEGER DEFAULT 0, category TEXT DEFAULT 'normal', tags TEXT DEFAULT '[]', has_meeting INTEGER DEFAULT 0, meeting_title TEXT, meeting_date TEXT, meeting_time TEXT, meeting_end TEXT, ai_summary TEXT, ai_reply TEXT, received_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS meetings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, mail_id INTEGER, title TEXT NOT NULL, date TEXT NOT NULL, start_time TEXT, end_time TEXT, sender_name TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT DEFAULT 'info', title TEXT NOT NULL, body TEXT, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS linked_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, provider TEXT NOT NULL, provider_email TEXT NOT NULL, provider_user_id TEXT, status TEXT DEFAULT 'connected', is_primary INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS labels (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT NOT NULL, color TEXT DEFAULT '#c8ff00', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
    `);
    return db;
  };

  try {
    const db = initialize();
    return { db, hashPass, genToken };
  } catch (err) {
    if (err.message.includes('database disk image is malformed') || err.message.includes('malformed')) {
      console.error('🛠️ Database corrupted; recreating now.');
      if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
      const db = initialize();
      return { db, hashPass, genToken };
    }
    throw err;
  }
}

module.exports = { initDatabase, DB_PATH };