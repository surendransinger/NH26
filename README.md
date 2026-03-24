# RE RE MAIL — Full Stack AI Mail Application
## Read & React · v3.0

A complete full-stack email client with AI features, voice assistant, real database, and multi-platform support.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v16+ (download from https://nodejs.org)
- No other dependencies needed — SQLite is bundled

### Installation & Run

```bash
# 1. Navigate to the project folder
cd rere-app

# 2. Install dependencies
npm install

# 3. (Optional) Setup database with demo data
npm run setup-db

# 4. Start the server
npm start

# 5. Open in browser (Auto-fallback port)
# → http://localhost:3000 (or 3001/3002 if used)

# NOTE
# - now `server.js` auto-falls back if port is in use, so just `npm start` works on first run
# - you can override with `PORT` env: `PORT=3001 npm start`
```

### Development Mode (auto-restart)
```bash
npm run dev
```

---

## �️ Database Setup

The app uses SQLite (via sql.js) with automatic database creation. For manual setup:

```bash
# Create database with schema and demo data
npm run setup-db

# Or delete existing and recreate
rm db/rere.db && npm run setup-db
```

**Demo Account:** `demo@rere.app` / `demo123`

---

## �📁 Project Structure

```
rere-app/
├── server/
│   └── server.js          ← Node.js + Express backend
├── public/
│   ├── index.html          ← Main frontend HTML
│   ├── css/
│   │   └── app.css         ← Full stylesheet (4 themes)
│   └── js/
│       ├── api.js          ← API client module
│       ├── voice.js        ← Voice assistant engine
│       └── app.js          ← Main application logic
├── db/
│   ├── init.js             ← Database initialization
│   ├── seed.js             ← Demo data seeding
│   ├── setup.js            ← Standalone database setup
│   ├── rere.db             ← SQLite database (auto-created)
│   └── schema.sql          ← SQL schema & queries reference
├── middleware/
│   └── auth.js             ← Authentication middleware
├── routes/
│   ├── auth.js             ← Auth routes (signup/login/demo)
│   ├── mails.js            ← Email management routes
│   ├── meetings.js         ← Calendar routes
│   ├── notifications.js    ← Notification routes
│   ├── accounts.js         ← Linked accounts routes
│   └── labels.js           ← Label management routes
├── package.json
├── README.md
└── schema.sql              ← SQL schema & queries reference
└── schema.sql              ← SQL reference (duplicate for easy access)
```

---

## 🗄️ Database Schema (SQL)

| Table | Description |
|-------|-------------|
| `users` | Registered users with hashed passwords |
| `sessions` | Auth tokens (bearer tokens) |
| `mails` | All emails (inbox, sent, draft, spam, trash) |
| `meetings` | Calendar events synced from emails |
| `notifications` | Push notifications |
| `linked_accounts` | Gmail, Outlook, Yahoo linked accounts |
| `labels` | Custom email labels |

---

## 🎙️ Voice Commands

Activate voice assistant by clicking 🎙 or pressing **Ctrl+.**

| Command | Action |
|---------|--------|
| "read inbox" | Reads inbox summary aloud |
| "next email" | Opens next email |
| "read email" | Reads current email |
| "compose" | Opens compose window |
| "reply" | Opens reply with AI draft |
| "forward" | Forwards current email |
| "archive" / "delete" | Moves to trash |
| "mark important" | Marks as important |
| "star this" | Stars current email |
| "show meetings" | Opens calendar |
| "deadlines" | Lists upcoming deadlines |
| "summary" | AI daily briefing |
| "unread count" | Announces unread count |
| "search [term]" | Searches emails |
| "show spam" | Opens spam folder |
| "focus mode" | Toggles focus mode |
| "dark/light/midnight/sepia theme" | Changes theme |
| "stop" | Stops TTS |
| "help" | Shows all commands |
| "edith" or "iron man" | Enable EDITH always-on assistant |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Focus search bar |
| `Ctrl+N` | New compose window |
| `Ctrl+.` | Toggle voice assistant |
| `Ctrl+R` | Reply to selected email |
| `↑ / ↓` | Navigate email list |
| `Escape` | Close modals |

---

## 📱 Platform Support

| Platform | Access Method |
|----------|---------------|
| **Windows** | Chrome/Edge → http://localhost:3000 |
| **macOS** | Safari/Chrome → http://localhost:3000 |
| **iOS** | Safari → Add to Home Screen (PWA) |
| **Android** | Chrome → Add to Home Screen (PWA) |
| **Linux** | Any browser → http://localhost:3000 |

### APK / Mobile App Deployment
For true native APK:
```bash
# Using Capacitor (recommended)
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Re Re Mail" "com.rere.mail"
npx cap add android
npx cap sync
npx cap open android
# → Build APK in Android Studio
```

### Windows Desktop App
```bash
# Using Electron
npm install electron electron-builder
# Add to package.json scripts: "electron": "electron ."
# Create main.js for Electron wrapper
```

---

## 🔑 API Endpoints

### Auth
- `POST /api/auth/signup` — Register new user
- `POST /api/auth/login` — Sign in
- `POST /api/auth/demo` — Demo access
- `POST /api/auth/logout` — Sign out
- `GET /api/auth/me` — Get current user

### Mails
- `GET /api/mails?folder=inbox&filter=unread&search=term` — List emails
- `GET /api/mails/stats` — Get counts/stats
- `GET /api/mails/:id` — Get single email
- `POST /api/mails` — Create email (send/draft)
- `PATCH /api/mails/:id` — Update (star/archive/folder)
- `DELETE /api/mails/:id` — Delete/trash

### Meetings
- `GET /api/meetings` — List all meetings
- `POST /api/meetings` — Sync meeting from email
- `DELETE /api/meetings/:id` — Remove meeting

### Other
- `GET /api/notifications` — List notifications
- `POST /api/notifications/read-all` — Mark all read
- `DELETE /api/notifications` — Clear all
- `GET /api/linked-accounts` — List linked accounts
- `POST /api/accounts/link` — Link Gmail/Outlook/Yahoo
- `GET /api/labels` — Custom labels
- `POST /api/labels` — Create label

---

## 🔗 Real Email Linking

To link real email accounts, implement OAuth2:

### Gmail OAuth2
1. Create project at https://console.cloud.google.com
2. Enable Gmail API
3. Create OAuth2 credentials
4. Set redirect URI: `http://localhost:3000/auth/google/callback`
5. Use `passport-google-oauth20` npm package

### IMAP/SMTP (All email providers)
```bash
npm install nodemailer imapflow
```
- **Send**: nodemailer with SMTP
- **Receive**: imapflow with IMAP polling

---

## 🌐 Deploy to Production

### Heroku
```bash
heroku create rere-mail-app
git push heroku main
```

### Railway
```bash
railway init
railway up
```

### VPS/DigitalOcean
```bash
# Install PM2 for process management
npm install -g pm2
pm2 start server/server.js --name rere-mail
pm2 save
```

---

## 🔒 Security Notes

- Passwords hashed with SHA-256 + salt (production: use bcrypt)
- Bearer token authentication
- SQL injection prevented by parameterized queries (better-sqlite3)
- For production: add HTTPS, rate limiting, CORS

---

## 📞 Support

Built with: Node.js · Express · SQLite (better-sqlite3) · Web Speech API · CSS Variables

Re Re Mail v3.0 — Read & React AI Mail
