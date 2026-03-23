/**
 * RE RE MAIL — API Client
 * All server communication through this module
 */

const API = (() => {
  let _token = localStorage.getItem('rere_token') || null;

  function setToken(t) { _token = t; if (t) localStorage.setItem('rere_token', t); else localStorage.removeItem('rere_token'); }
  function getToken() { return _token; }

  async function req(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (_token) opts.headers['Authorization'] = 'Bearer ' + _token;
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch('/api' + path, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (e) {
      console.error('API Error:', e.message);
      throw e;
    }
  }

  return {
    setToken, getToken,

    // ── Auth ──
    signup: (name, email, password) => req('POST', '/auth/signup', { name, email, password }),
    login: (email, password) => req('POST', '/auth/login', { email, password }),
    demo: () => req('POST', '/auth/demo'),
    logout: () => req('POST', '/auth/logout'),
    me: () => req('GET', '/auth/me'),

    // ── Mails ──
    getMails: (folder = 'inbox', filter = 'all', search = '') => {
      const p = new URLSearchParams({ folder });
      if (filter && filter !== 'all') p.set('filter', filter);
      if (search) p.set('search', search);
      return req('GET', '/mails?' + p.toString());
    },
    getStats: () => req('GET', '/mails/stats'),
    getMail: (id) => req('GET', '/mails/' + id),
    createMail: (data) => req('POST', '/mails', data),
    updateMail: (id, data) => req('PATCH', '/mails/' + id, data),
    deleteMail: (id) => req('DELETE', '/mails/' + id),

    // ── Meetings ──
    getMeetings: () => req('GET', '/meetings'),
    createMeeting: (data) => req('POST', '/meetings', data),
    deleteMeeting: (id) => req('DELETE', '/meetings/' + id),

    // ── Notifications ──
    getNotifications: () => req('GET', '/notifications'),
    markNotifRead: (id) => req('PATCH', '/notifications/' + id + '/read'),
    markAllNotifRead: () => req('POST', '/notifications/read-all'),
    clearNotifications: () => req('DELETE', '/notifications'),

    // ── Accounts ──
    getLinkedAccounts: () => req('GET', '/linked-accounts'),
    linkAccount: (provider, email) => req('POST', '/accounts/link', { provider, provider_email: email }),

    // ── Labels ──
    getLabels: () => req('GET', '/labels'),
    createLabel: (name, color) => req('POST', '/labels', { name, color }),
    deleteLabel: (id) => req('DELETE', '/labels/' + id),
  };
})();
