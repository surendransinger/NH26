#!/usr/bin/env node

/**
 * RE RE MAIL — Database Setup Script
 * Creates and initializes the SQLite database with schema and demo data
 * Run with: node db/setup.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, 'rere.db');

console.log('🚀 Setting up Re Re Mail database...');

// Check if database already exists
if (fs.existsSync(DB_PATH)) {
  console.log('⚠️  Database already exists at:', DB_PATH);
  console.log('   To recreate, delete the file first: rm db/rere.db');
  process.exit(0);
}

function createDbWrapper(SQL) {
  const sqlDb = new SQL.Database();

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
          const stmt = sqlDb.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const stmt = sqlDb.prepare(sql);
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
        run(...params) {
          sqlDb.run(sql, params);
          const lastId = sqlDb.exec('SELECT last_insert_rowid() as id')[0];
          const lastInsertRowid = lastId ? lastId.values[0][0] : 0;
          save();
          return { lastInsertRowid };
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

function seedDemoData(db, userId) {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM mails WHERE user_id = ?').get(userId);
  if (existing.cnt > 0) return;

  const demoMails = [
    { folder:'inbox', sender_name:'Sarah Chen', sender_email:'sarah@company.com', subject:'Q4 Budget Review — Action Required', body:'Hi James,\n\nI wanted to follow up on the Q4 budget review we discussed last week. The finance team needs your final sign-off by end of day Friday.\n\nCould we schedule a quick 30-min sync to align before the deadline?\n\nBest,\nSarah', preview:'Hi James, I wanted to follow up on the Q4 budget allocation…', is_unread:1, is_starred:0, is_important:1, category:'important', tags:'["imp","meet"]', has_meeting:1, meeting_title:'Q4 Budget Review', meeting_date:'2026-03-26', meeting_time:'10:00 AM', meeting_end:'11:00 AM', ai_summary:'Finance needs Q4 sign-off by Friday. Meeting request included.', ai_reply:"Hi Sarah,\n\nThank you for the follow-up. I'll review the Q4 document today and can connect Friday at 10 AM.\n\nBest,\nJames", received_at:'2026-03-23 09:41:00' },
    { folder:'inbox', sender_name:'Alex Rivera', sender_email:'alex@techcorp.com', subject:'Contract Renewal — Urgent Review', body:'Hi,\n\nOur SaaS contract expires March 31st. Legal has flagged several clauses requiring your review and signature before renewal.\n\nPlease treat this as URGENT.\n\nTechCorp Legal', preview:'The SaaS contract expires March 31st. Legal has flagged clauses…', is_unread:1, is_starred:1, is_important:1, category:'important', tags:'["imp","urg"]', has_meeting:0, meeting_title:null, meeting_date:null, meeting_time:null, meeting_end:null, ai_summary:'Contract expires March 31. Urgent legal review and signature required.', ai_reply:"Hello,\n\nI've noted the urgency. I will review the contract clauses and respond before March 31st.\n\nRegards,\nJames", received_at:'2026-03-23 08:15:00' },
    { folder:'inbox', sender_name:'Board Office', sender_email:'board@company.com', subject:'Monthly Report — Due This Friday', body:'All department heads,\n\nThe monthly performance report is due this Friday by 5 PM.\n\nBoard Office', preview:'Reminder: Monthly performance report is due by Friday 5 PM…', is_unread:0, is_starred:0, is_important:1, category:'important', tags:'["imp","dead"]', has_meeting:0, ai_summary:'Monthly report due Friday 5 PM. Include all KPIs.', ai_reply:'Noted. Report submitted by Friday afternoon.\n\nThank you.', received_at:'2026-03-22 14:00:00' },
    { folder:'inbox', sender_name:'David Park', sender_email:'david@company.com', subject:"Can we move Thursday's sync?", body:"Hey James,\n\nSomething came up — would 3 PM on Thursday work instead of 10 AM?\n\nThanks,\nDavid", preview:'Hey, something came up — would 3 PM work instead of 10 AM?', is_unread:1, is_starred:0, is_important:1, category:'important', tags:'["meet"]', has_meeting:1, meeting_title:'Thursday Sync with David', meeting_date:'2026-03-28', meeting_time:'03:00 PM', meeting_end:'04:00 PM', ai_summary:'David requesting reschedule to 3 PM Thursday.', ai_reply:"Hi David,\n\n3 PM Thursday works. I'll update the calendar invite.\n\nThanks!", received_at:'2026-03-22 11:30:00' },
    { folder:'inbox', sender_name:'Newsletter Hub', sender_email:'digest@hub.com', subject:'Weekly Tech Digest — Issue #142', body:'This week in tech:\n\n• AI reasoning models\n• Cloud cost optimization for 2026\n• Top developer tools\n\nRead more at TechHub.', preview:'This week: AI breakthroughs, cloud cost optimization…', is_unread:0, is_starred:0, is_important:0, category:'normal', tags:'[]', has_meeting:0, ai_summary:'Weekly tech newsletter — AI and cloud topics.', ai_reply:null, received_at:'2026-03-22 08:00:00' },
    { folder:'inbox', sender_name:'IT Support', sender_email:'it@company.com', subject:'Scheduled maintenance Saturday', body:'Systems maintenance this Saturday 2:00 AM – 6:00 AM.\n\nSave your work before 1:45 AM.\n\nIT Department', preview:'Systems down Saturday 2 AM – 6 AM for maintenance…', is_unread:0, is_starred:0, is_important:0, category:'normal', tags:'[]', has_meeting:0, ai_summary:'System maintenance Saturday 2–6 AM.', ai_reply:null, received_at:'2026-03-21 16:00:00' },
    { folder:'inbox', sender_name:'TechCorp Hiring', sender_email:'careers@techcorp.com', subject:'Job Opportunity: Senior Frontend Engineer', body:"Hi James,\n\nWe're impressed by your work. Senior frontend role, competitive equity, remote-first.\n\nApply by April 10.\n\nTechCorp Hiring", preview:'We loved your profile! Apply for the role before April 10…', is_unread:1, is_starred:0, is_important:1, category:'important', tags:'["imp","dead"]', has_meeting:0, ai_summary:'Job opportunity at TechCorp. Deadline April 10.', ai_reply:"Hi,\n\nThank you for reaching out. I'm interested — will apply before the deadline.\n\nBest,\nJames", received_at:'2026-03-20 10:00:00' },
    { folder:'inbox', sender_name:'University Registrar', sender_email:'registrar@university.edu', subject:'Semester Fee Payment — Due March 30', body:'Dear Student,\n\nYour spring semester tuition fee is due by March 30, 2026. Late payments incur a 5% penalty.\n\nRegistrar\'s Office', preview:'Your spring semester fees are due by March 30. Late penalty applies…', is_unread:1, is_starred:0, is_important:1, category:'important', tags:'["imp","dead"]', has_meeting:0, ai_summary:'Semester fees due March 30. 5% late penalty after deadline.', ai_reply:"Understood. Payment completed before March 30.\n\nThank you.", received_at:'2026-03-19 09:00:00' },
    { folder:'spam', sender_name:'Spam Corp', sender_email:'win@fake.xyz', subject:'YOU WON $1000!!! CLAIM NOW!', body:'CLAIM YOUR PRIZE NOW! Click the link below. Limited time!!!', preview:'Congratulations lucky winner — click link NOW…', is_unread:1, is_starred:0, is_important:0, category:'spam', tags:'["spam"]', has_meeting:0, ai_summary:'Phishing/scam. Do not interact.', ai_reply:null, received_at:'2026-03-23 02:00:00' },
    { folder:'inbox', sender_name:'Coursera', sender_email:'certs@coursera.org', subject:'Your AI Certification is Ready', body:'Hi James,\n\nCongratulations! You have completed the Generative AI Fundamentals course. Your certificate is ready to download.\n\nCoursera', preview:'Congratulations! Your GenAI certificate has been issued…', is_unread:0, is_starred:1, is_important:1, category:'important', tags:'["imp"]', has_meeting:0, ai_summary:'AI certification earned. Ready to download and share.', ai_reply:null, received_at:'2026-03-18 14:00:00' },
    { folder:'inbox', sender_name:'Startup Internships', sender_email:'interns@startup.co', subject:'Paid Internship — Frontend Developer', body:'Hi James,\n\nPaid frontend developer internship for Summer 2026. Stipend 25,000/month.\n\nApply by April 5.\n\nStartup.co', preview:'Summer 2026 paid internship, apply by April 5…', is_unread:1, is_starred:0, is_important:1, category:'important', tags:'["imp","dead"]', has_meeting:0, ai_summary:'Paid internship. Deadline April 5.', ai_reply:'Hi,\n\nThank you! I will submit my application before April 5.\n\nBest,\nJames', received_at:'2026-03-17 11:00:00' },
    { folder:'inbox', sender_name:'Exam Board', sender_email:'exams@board.org', subject:'Final Exam Schedule — Spring 2026', body:'Dear Student,\n\nYour Spring 2026 final exam schedule has been released. Fees must be cleared before admit card issuance.\n\nExam Board', preview:'Your examination timetable is now available. Fee deadline inside…', is_unread:1, is_starred:0, is_important:1, category:'important', tags:'["imp","dead","meet"]', has_meeting:1, meeting_title:'Final Exam — Data Structures', meeting_date:'2026-04-10', meeting_time:'09:00 AM', meeting_end:'12:00 PM', ai_summary:'Exam schedule out. Fees must be paid before admit card.', ai_reply:'Noted. I will pay the fees and review the schedule.\n\nThank you.', received_at:'2026-03-16 09:00:00' },
  ];

  for (const m of demoMails) {
    db.prepare('INSERT INTO mails (user_id, folder, sender_name, sender_email, subject, body, preview, is_unread, is_starred, is_important, category, tags, has_meeting, meeting_title, meeting_date, meeting_time, meeting_end, ai_summary, ai_reply, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(userId, m.folder, m.sender_name, m.sender_email, m.subject, m.body, m.preview, m.is_unread, m.is_starred, m.is_important, m.category, m.tags, m.has_meeting, m.meeting_title||null, m.meeting_date||null, m.meeting_time||null, m.meeting_end||null, m.ai_summary, m.ai_reply||null, m.received_at);
  }

  db.prepare('INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)').run(userId, 'imp', 'Important Email', 'Q4 Budget Review needs your attention from Sarah Chen');
  db.prepare('INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)').run(userId, 'dead', 'Deadline Alert', 'Semester fees due March 30 — 7 days remaining');
  db.prepare('INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)').run(userId, 'meet', 'Meeting Reminder', 'Q4 Budget Review — March 26 at 10:00 AM');
}

async function setupDatabase() {
  try {
    const SQL = await initSqlJs();
    const db = createDbWrapper(SQL);

    console.log('📋 Creating database schema...');

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, avatar TEXT DEFAULT 'JS', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS mails (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, folder TEXT DEFAULT 'inbox', sender_name TEXT NOT NULL, sender_email TEXT NOT NULL, recipient_email TEXT, subject TEXT NOT NULL, body TEXT, preview TEXT, is_unread INTEGER DEFAULT 1, is_starred INTEGER DEFAULT 0, is_important INTEGER DEFAULT 0, category TEXT DEFAULT 'normal', tags TEXT DEFAULT '[]', has_meeting INTEGER DEFAULT 0, meeting_title TEXT, meeting_date TEXT, meeting_time TEXT, meeting_end TEXT, ai_summary TEXT, ai_reply TEXT, received_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS meetings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, mail_id INTEGER, title TEXT NOT NULL, date TEXT NOT NULL, start_time TEXT, end_time TEXT, sender_name TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT DEFAULT 'info', title TEXT NOT NULL, body TEXT, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS linked_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, provider TEXT NOT NULL, provider_email TEXT NOT NULL, status TEXT DEFAULT 'connected', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS labels (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT NOT NULL, color TEXT DEFAULT '#c8ff00', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
    `);

    console.log('👤 Creating demo user...');

    // Create demo user
    const demoUser = db.prepare('SELECT * FROM users WHERE email = ?').get('demo@rere.app');
    if (!demoUser) {
      const result = db.prepare('INSERT INTO users (name, email, password_hash, avatar) VALUES (?, ?, ?, ?)').run('James Smith', 'demo@rere.app', hashPass('demo123'), 'JS');
      const userId = result.lastInsertRowid;

      console.log('📧 Adding demo emails...');
      seedDemoData(db, userId);
    }

    console.log('✅ Database setup complete!');
    console.log('📍 Database file:', DB_PATH);
    console.log('🔑 Demo login: demo@rere.app / demo123');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };