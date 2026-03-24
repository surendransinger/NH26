/**
 * RE RE MAIL — Main Application
 * Full state management, UI rendering, all interactions
 */

const App = (() => {
  // ── State ──
  let currentUser = null;
  let mailList = [];
  let currentView = 'inbox';
  let currentFilter = 'all';
  let selectedMailId = null;
  let selectedMailData = null;
  let meetingsList = [];
  let stats = {};
  let focusActive = false;
  let composingDraftId = null;
  let composeMode = 'new';

  // ── Helpers ──
  const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const $ = (id) => document.getElementById(id);
  const fmt = (s) => (s || '').replace(/\n/g, '<br>');

  // ── Toast ──
  function toast(msg, type = '', duration = 3200) {
    const zone = $('toastZone');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    zone.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'all 0.3s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateX(16px)';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // ── Theme ──
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    document.querySelectorAll('.theme-dot').forEach(d => d.classList.toggle('active', d.dataset.t === t));
    localStorage.setItem('rere_theme', t);
  }

  // ── Auth ──
  function switchTab(tab) {
    ['signin','signup'].forEach(t => {
      $('ltab-' + t)?.classList.toggle('active', t === tab);
      $(t + 'Form')?.classList.toggle('hidden', t !== tab);
    });
  }

  async function doSignin() {
    const email = $('signinEmail').value.trim();
    const pass = $('signinPassword').value;
    const errEl = $('signinError');
    errEl.classList.add('hidden');
    if (!email || !pass) { showErr(errEl, 'Please fill in all fields'); return; }
    setLoading($('signinBtn'), true);
    try {
      const data = await API.login(email, pass);
      API.setToken(data.token);
      bootApp(data.user);
    } catch (e) {
      showErr(errEl, e.message === 'Invalid credentials' ? 'Invalid email or password' : e.message);
    } finally { setLoading($('signinBtn'), false); }
  }

  async function doSignup() {
    const name = $('signupName').value.trim();
    const email = $('signupEmail').value.trim();
    const pass = $('signupPassword').value;
    const errEl = $('signupError');
    errEl.classList.add('hidden');
    if (!name || !email || !pass) { showErr(errEl, 'Please fill in all fields'); return; }
    if (pass.length < 6) { showErr(errEl, 'Password must be at least 6 characters'); return; }
    setLoading($('signupBtn'), true);
    try {
      const data = await API.signup(name, email, pass);
      API.setToken(data.token);
      bootApp(data.user);
    } catch (e) {
      showErr(errEl, e.message);
    } finally { setLoading($('signupBtn'), false); }
  }

  async function doDemo() {
    try {
      const data = await API.demo();
      API.setToken(data.token);
      bootApp(data.user);
    } catch (e) {
      toast('Demo failed: ' + e.message, 't-err');
    }
  }

  async function doLogout() {
    try { await API.logout(); } catch (e) {}
    API.setToken(null);
    currentUser = null;
    closeModal('profileModal');
    $('app').classList.add('hidden');
    $('loginScreen').style.display = 'flex';
    $('signinEmail').value = '';
    $('signinPassword').value = '';
    toast('Signed out successfully');
  }

  function showErr(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  }

  function setLoading(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    btn.style.opacity = on ? '0.6' : '1';
  }

  // ── BOOT ──
  async function bootApp(user) {
    currentUser = user;
    $('loginScreen').style.display = 'none';
    $('app').classList.remove('hidden');

    // Update avatar/name displays
    const av = user.avatar || (user.name || 'JS').split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
    $('avatarBtn').textContent = av;
    $('profileAvatar').textContent = av;
    $('profileName').textContent = user.name || 'User';
    $('profileEmail').textContent = user.email || '';

    await Promise.all([loadStats(), loadMeetings()]);
    await loadMailList();

    setTimeout(() => toast(`👋 Welcome, ${(user.name || 'User').split(' ')[0]}!`, 't-success'), 400);
    setTimeout(() => { if (stats.inbox_unread > 0) toast(`📬 ${stats.inbox_unread} unread emails awaiting you`, 't-acc'); }, 1400);
    setTimeout(() => toast('⏰ Deadline: Semester fees due March 30', 't-acc'), 2800);

    const voiceAlways = localStorage.getItem('rere_voice_always_on') === 'true';
    if (voiceAlways) {
      Voice.enableAlwaysOn(true);
    }
  }

  // ── STATS ──
  async function loadStats() {
    try {
      stats = await API.getStats();
      renderStats();
    } catch (e) {}
  }

  function renderStats() {
    const s = stats;
    const set = (id, val) => { const el = $(id); if(el) el.textContent = val || 0; };
    set('nc-inbox', s.inbox_unread);
    set('nc-important', s.important);
    set('nc-drafts', s.draft_count);
    set('nc-sent', s.sent_count);
    set('nc-spam', s.spam);
    set('nc-trash', s.trash_count);
    set('nc-meetings', s.meetings);
    set('calBadge', s.meetings);
    set('notifBadge', s.notifs);
    set('ov-imp', s.important);
    set('ov-meet', s.meetings);
    set('ov-unr', s.inbox_unread);
    set('ov-draft', s.draft_count);
    set('statImp', s.important);
    set('statMeet', s.meetings);
    const hot = $('nc-inbox');
    if (hot) hot.className = `nav-count ${s.inbox_unread > 0 ? 'hot' : ''}`;
  }

  // ── MAIL LIST ──
  async function loadMailList() {
    const scroll = $('mailListScroll');
    scroll.innerHTML = '<div class="list-loading"><div class="loading-spinner"></div><span>Loading…</span></div>';

    try {
      mailList = await API.getMails(currentView, currentFilter);
      renderMailList();
    } catch (e) {
      scroll.innerHTML = `<div class="empty-list"><div class="empty-list-icon">⚠️</div>Failed to load emails.<br>Check server connection.</div>`;
    }
  }

  function renderMailList() {
    const scroll = $('mailListScroll');
    if (currentView === 'ai-dashboard') { renderAIDashboard(); return; }
    if (currentView === 'voice-commands') { openVoiceHelp(); renderMailList2([]); return; }

    if (!mailList.length) {
      scroll.innerHTML = `<div class="empty-list"><div class="empty-list-icon">📭</div>No messages in ${currentView}</div>`;
      return;
    }

    scroll.innerHTML = mailList.map((m, i) => {
      const pc = m.folder==='spam' ? 'spam' : (m.tags||[]).includes('dead') ? 'dead' : ((m.tags||[]).includes('meet') && m.is_important) ? 'meet' : m.is_important ? 'imp' : '';
      const time = formatTime(m.received_at);
      return `<div class="mi ${pc ? pc+'-p' : ''} ${selectedMailId === m.id ? 'sel' : ''}" data-id="${m.id}" style="animation-delay:${i * 0.028}s">
        <div class="mi-row1">
          <div class="mi-sender">${m.is_unread ? '<span class="upip"></span>' : ''}${esc(m.sender_name)}${m.is_starred ? ' <span style="color:var(--dc)">★</span>' : ''}</div>
          <div class="mi-time">${esc(time)}</div>
        </div>
        <div class="mi-subject ${m.is_unread ? 'bold' : ''}">${esc(m.subject)}</div>
        <div class="mi-preview">${esc((m.preview || '').slice(0, 70))}</div>
        <div class="tag-row">${renderTags(m.tags || [])}</div>
      </div>`;
    }).join('');

    scroll.querySelectorAll('.mi').forEach(el => {
      el.addEventListener('click', () => openMail(Number(el.dataset.id)));
    });
  }

  function renderMailList2(list) {
    const scroll = $('mailListScroll');
    if (!list.length) { scroll.innerHTML = `<div class="empty-list"><div class="empty-list-icon">📭</div>No messages</div>`; return; }
    scroll.innerHTML = list.map((m, i) => `<div class="mi imp-p ${selectedMailId===m.id?'sel':''}" data-id="${m.id}" style="animation-delay:${i*0.03}s">
      <div class="mi-row1"><div class="mi-sender">${esc(m.sender_name)}</div><div class="mi-time">${esc(formatTime(m.received_at))}</div></div>
      <div class="mi-subject bold">${esc(m.subject)}</div>
      <div class="mi-preview">${esc(m.ai_summary || '')}</div>
    </div>`).join('');
    scroll.querySelectorAll('.mi').forEach(el => el.addEventListener('click', () => openMail(Number(el.dataset.id))));
  }

  function renderAIDashboard() {
    const scroll = $('mailListScroll');
    const imp = mailList;
    scroll.innerHTML = `<div class="ai-dashboard-view">
      <div class="adv-title">◎ AI Dashboard</div>
      <div class="adv-stats">
        <div class="adv-stat"><div class="adv-num">${stats.important||0}</div><div class="adv-lbl">Important</div></div>
        <div class="adv-stat"><div class="adv-num">${stats.inbox_unread||0}</div><div class="adv-lbl">Unread</div></div>
        <div class="adv-stat"><div class="adv-num">${stats.meetings||0}</div><div class="adv-lbl">Meetings</div></div>
      </div>
      ${imp.map((m,i) => `<div class="mi imp-p" data-id="${m.id}" style="animation-delay:${i*0.04}s">
        <div class="mi-row1"><div class="mi-sender">${esc(m.sender_name)}</div><div class="mi-time">${esc(formatTime(m.received_at))}</div></div>
        <div class="mi-subject bold">${esc(m.subject)}</div>
        <div class="mi-preview">AI: ${esc(m.ai_summary||'')}</div>
      </div>`).join('')}
    </div>`;
    scroll.querySelectorAll('.mi').forEach(el => el.addEventListener('click', () => openMail(Number(el.dataset.id))));
  }

  function renderTags(tags) {
    const map = { imp:'⭐ Important', urg:'🔴 Urgent', meet:'🗓 Meeting', dead:'⏰ Deadline', spam:'⚠️ Spam' };
    const cls = { imp:'t-imp', meet:'t-meet', dead:'t-dead', spam:'t-spam', urg:'t-urg' };
    return (tags || []).filter(t => map[t]).map(t => `<span class="mi-tag ${cls[t]||''}">${map[t]}</span>`).join('');
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    if (diff < 172800000) return 'Yesterday';
    if (diff < 604800000) return d.toLocaleDateString([], {weekday:'short'});
    return d.toLocaleDateString([], {month:'short',day:'numeric'});
  }

  // ── OPEN MAIL ──
  async function openMail(id) {
    if (!id) return;
    selectedMailId = id;
    // Mark as read immediately in UI
    const inList = mailList.find(m => m.id === id);
    if (inList && inList.is_unread) {
      inList.is_unread = 0;
      API.updateMail(id, { is_unread: 0 }).then(() => loadStats());
    }
    renderMailList();

    // Hide empty, show detail
    $('detailEmpty').classList.add('hidden');
    $('detailView').classList.remove('hidden');

    // Show loading state
    $('detailScroll').innerHTML = '<div class="list-loading" style="padding:60px 0"><div class="loading-spinner"></div><span>Loading…</span></div>';

    try {
      selectedMailData = await API.getMail(id);
      renderDetailView(selectedMailData);

      // Mobile: show detail
      document.getElementById('detailPanel').classList.add('shown-mobile');
      document.getElementById('mailListPanel').classList.add('hidden-mobile');
    } catch (e) {
      $('detailScroll').innerHTML = `<div style="padding:30px;color:var(--t2)">Failed to load email.</div>`;
    }
  }

  function renderDetailView(m) {
    const isSpam = m.folder === 'spam' || m.category === 'spam';
    const isTrash = m.folder === 'trash';
    const isSent = m.folder === 'sent';
    const isDraft = m.folder === 'draft';

    $('detailScroll').innerHTML = `
      <div class="d-subject">${esc(m.subject)}</div>
      <div class="d-meta-bar">
        <div class="d-from-info">
          <strong>${esc(m.sender_name)}</strong>
          &nbsp;<a class="d-email-link" href="mailto:${esc(m.sender_email)}" onclick="return App.openMailLink('${esc(m.sender_email)}')">&lt;${esc(m.sender_email)}&gt;</a>
        </div>
        <div class="d-time-stamp">${esc(formatTime(m.received_at))}</div>
      </div>
      <div class="d-body-card">${fmt(esc(m.body))}</div>
      <div class="action-toolbar">
        ${!isSpam && !isTrash && !isSent && !isDraft ? `<button class="btn btn-primary" onclick="App.openCompose(${m.id})">✉ Reply with AI</button>` : ''}
        ${isDraft ? `<button class="btn btn-primary" onclick="App.editDraft(${m.id})">✏️ Edit Draft</button>` : ''}
        ${m.has_meeting && !isTrash ? `<button class="btn btn-meet" onclick="App.syncMeeting(${m.id})">📅 Sync Meeting</button>` : ''}
        ${!isTrash ? `<button class="btn btn-star" onclick="App.toggleStar(${m.id})">${m.is_starred ? '★ Unstar' : '☆ Star'}</button>` : ''}
        ${!isSpam && !isTrash ? `<button class="btn" onclick="App.toggleImportant(${m.id})">⭐ ${m.is_important ? 'Unmark' : 'Mark Important'}</button>` : ''}
        <button class="btn" onclick="App.readAloud(${m.id})">🔊 Read Aloud</button>
        <button class="btn" onclick="App.openCompose(null,'forward',${m.id})">↗ Forward</button>
        ${!isTrash ? `<button class="btn btn-danger" onclick="App.deleteMail(${m.id})">🗑 Delete</button>` : ''}
        ${isTrash ? `<button class="btn" onclick="App.restoreMail(${m.id})">↩ Restore</button>` : ''}
        ${isSpam ? `<button class="btn btn-meet" onclick="App.notSpam(${m.id})">✅ Not Spam</button>` : ''}
      </div>
    `;

    updateAIPanel(m);
  }

  // ── AI PANEL ──
  function updateAIPanel(m) {
    const panel = $('aiScrollArea');
    if (!panel) return;
    const isSpam = m.folder === 'spam' || m.category === 'spam';
    const tags = m.tags || [];

    const meetHTML = m.has_meeting ? `
      <div class="ai-card" style="animation-delay:0.12s">
        <div class="ac-label">MEETING DETECTED</div>
        <div class="meet-info-block">
          <div class="mib-title">${esc(m.meeting_title)}</div>
          📅 ${esc(m.meeting_date || '')} &nbsp; ⊙ ${esc(m.meeting_time || '')} — ${esc(m.meeting_end || '')}
          <br><button class="btn btn-meet" style="margin-top:8px;font-size:0.65rem;width:100%;padding:6px" onclick="App.syncMeeting(${m.id})">+ Add to Calendar</button>
        </div>
      </div>` : '';

    const replyHTML = m.ai_reply && !isSpam ? `
      <div class="ai-card" style="animation-delay:0.18s">
        <div class="ac-label">SMART REPLIES</div>
        <div class="reply-chip-list">
          <div class="reply-chip" onclick="App.openComposeText(${JSON.stringify(m.ai_reply.split('\n')[0])}, ${m.id})">"${esc(m.ai_reply.split('\n')[0])}"</div>
          <div class="reply-chip" onclick="App.openComposeText('Noted — I will get back to you shortly.', ${m.id})">Noted, will respond shortly.</div>
          <div class="reply-chip" onclick="App.openComposeText('Can we schedule a quick call to discuss?', ${m.id})">Can we schedule a call?</div>
          <div class="reply-chip" onclick="App.openComposeText('Thank you for your message. I will review and respond.', ${m.id})">Will review and respond.</div>
        </div>
      </div>` : '';

    const priLabel = isSpam ? '⚠️ Spam / Phishing' : m.is_important ? '🔥 High Priority' : '📌 Normal';

    panel.innerHTML = `
      <div class="ai-card">
        <div class="ac-label">AI SUMMARY</div>
        <div class="ac-body">${esc(m.ai_summary || 'No summary available.')}</div>
      </div>
      <div class="ai-card" style="animation-delay:0.07s">
        <div class="ac-label">PRIORITY</div>
        <div class="ac-body">${priLabel}</div>
      </div>
      ${meetHTML}${replyHTML}
      ${isSpam ? `<div class="ai-card" style="border-color:var(--sc);animation-delay:0.24s"><div class="ac-label" style="color:var(--sc)">⚠️ SECURITY WARNING</div><div class="ac-body" style="color:var(--t2)">Phishing attempt detected. Do not click any links or share personal information.</div></div>` : ''}
      <div class="ai-card" style="animation-delay:0.3s">
        <div class="ac-label">VOICE ACTIONS</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">
          <button class="btn" style="font-size:0.63rem;padding:5px 10px" onclick="App.readAloud(${m.id})">🔊 Read</button>
          <button class="btn" style="font-size:0.63rem;padding:5px 10px" onclick="Voice.speak(${JSON.stringify(m.ai_summary||'')})">📢 Announce</button>
        </div>
      </div>`;
  }

  // ── MAIL ACTIONS ──
  async function toggleStar(id) {
    const m = mailList.find(x => x.id === id) || selectedMailData;
    if (!m) return;
    const newVal = m.is_starred ? 0 : 1;
    await API.updateMail(id, { is_starred: newVal });
    if (m) m.is_starred = newVal;
    if (selectedMailData?.id === id) selectedMailData.is_starred = newVal;
    renderMailList();
    if (selectedMailData?.id === id) renderDetailView(selectedMailData);
    toast(newVal ? '★ Starred' : 'Unstarred');
  }

  async function toggleImportant(id) {
    const m = mailList.find(x => x.id === id) || selectedMailData;
    if (!m) return;
    const newImp = m.is_important ? 0 : 1;
    const tags = (m.tags || []).filter(t => t !== 'imp');
    if (newImp) tags.push('imp');
    await API.updateMail(id, { is_important: newImp, category: newImp ? 'important' : 'normal', tags });
    if (m) { m.is_important = newImp; m.tags = tags; m.category = newImp ? 'important' : 'normal'; }
    if (selectedMailData?.id === id) { selectedMailData.is_important = newImp; selectedMailData.tags = tags; }
    await loadStats();
    renderMailList();
    if (selectedMailData?.id === id) renderDetailView(selectedMailData);
    toast(newImp ? '⭐ Marked Important' : 'Unmarked as Important');
  }

  async function deleteMail(id) {
    await API.deleteMail(id);
    if (selectedMailId === id) {
      selectedMailId = null;
      selectedMailData = null;
      $('detailEmpty').classList.remove('hidden');
      $('detailView').classList.add('hidden');
    }
    await Promise.all([loadStats(), loadMailList()]);
    toast('🗑 Moved to trash');
  }

  async function restoreMail(id) {
    await API.updateMail(id, { folder: 'inbox' });
    if (selectedMailId === id) {
      $('detailEmpty').classList.remove('hidden');
      $('detailView').classList.add('hidden');
      selectedMailId = null;
    }
    await Promise.all([loadStats(), loadMailList()]);
    toast('↩ Restored to inbox', 't-success');
  }

  async function notSpam(id) {
    await API.updateMail(id, { folder: 'inbox', category: 'normal' });
    await Promise.all([loadStats(), loadMailList()]);
    toast('✅ Moved to inbox', 't-success');
  }

  async function readAloud(id) {
    let m = selectedMailData?.id === id ? selectedMailData : await API.getMail(id);
    Voice.speak(`Email from ${m.sender_name}. Subject: ${m.subject}. ${m.body || ''}`);
    document.getElementById('voiceOverlay').classList.remove('hidden');
  }

  function openMailLink(email) {
    window.open(`mailto:${email}`, '_blank');
    return false;
  }

  // ── MEETINGS ──
  async function loadMeetings() {
    try { meetingsList = await API.getMeetings(); } catch (e) {}
  }

  async function syncMeeting(mailId) {
    const m = selectedMailData?.id === mailId ? selectedMailData : await API.getMail(mailId);
    if (!m?.has_meeting) { toast('No meeting in this email'); return; }
    try {
      await API.createMeeting({
        mail_id: mailId,
        title: m.meeting_title,
        date: m.meeting_date,
        start_time: m.meeting_time,
        end_time: m.meeting_end,
        sender_name: m.sender_name,
        notes: ''
      });
      await Promise.all([loadMeetings(), loadStats()]);
      toast('📅 Meeting synced!', 't-voice');
    } catch (e) {
      if (e.message.includes('exists')) toast('Meeting already in calendar');
      else toast('Failed to sync meeting', 't-err');
    }
  }

  async function openCalendar() {
    await loadMeetings();
    renderCalendarModal();
    $('calModal').classList.remove('hidden');
  }

  function renderCalendarModal() {
    const el = $('calList');
    if (!el) return;
    if (!meetingsList.length) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--t2);font-size:0.77rem">No meetings synced yet.<br>Add meetings from emails with meeting details.</div>';
      return;
    }
    el.innerHTML = meetingsList.map((m, i) => `
      <div class="cal-event-card">
        <div class="cec-title">${esc(m.title)}</div>
        <div class="cec-meta">📅 ${esc(m.date)} &nbsp; ⊙ ${esc(m.start_time||'')} — ${esc(m.end_time||'')}</div>
        <div class="cec-from">From: ${esc(m.sender_name||'')}</div>
        <button class="btn btn-danger" style="margin-top:7px;font-size:0.63rem;padding:4px 10px" onclick="App.removeMeeting(${m.id})">Remove</button>
      </div>`).join('');
  }

  async function removeMeeting(id) {
    await API.deleteMeeting(id);
    await Promise.all([loadMeetings(), loadStats()]);
    renderCalendarModal();
    toast('Meeting removed');
  }

  // ── COMPOSE ──
  function openCompose(replyToId, mode = 'new', fwdId) {
    composeMode = mode;
    composingDraftId = null;
    $('composeModalTitle').textContent = '✉ New Message';
    $('composeTo').value = '';
    $('composeCc').value = '';
    $('composeSubject').value = '';
    $('composeBody').value = '';

    if (replyToId) {
      const m = mailList.find(x => x.id === replyToId) || selectedMailData;
      if (m) {
        $('composeModalTitle').textContent = '↩ Reply';
        $('composeTo').value = m.sender_email || '';
        $('composeSubject').value = `Re: ${m.subject}`;
        $('composeBody').value = m.ai_reply || `Hi ${m.sender_name?.split(' ')[0] || ''},\n\nThank you for your email.\n\nBest,\n${currentUser?.name || 'James'}`;
      }
    }
    if (mode === 'forward' && fwdId) {
      const m = mailList.find(x => x.id === fwdId) || selectedMailData;
      if (m) {
        $('composeModalTitle').textContent = '↗ Forward';
        $('composeSubject').value = `Fwd: ${m.subject}`;
        $('composeBody').value = `\n\n--- Forwarded Message ---\nFrom: ${m.sender_name} <${m.sender_email}>\nSubject: ${m.subject}\n\n${m.body || ''}`;
      }
    }
    $('composeModal').classList.remove('hidden');
  }

  function openComposeText(text, mailId) {
    const m = mailList.find(x => x.id === mailId) || selectedMailData;
    if (!m) return;
    $('composeModalTitle').textContent = '↩ Reply';
    $('composeTo').value = m.sender_email || '';
    $('composeSubject').value = `Re: ${m.subject}`;
    $('composeBody').value = text;
    $('composeModal').classList.remove('hidden');
  }

  function editDraft(id) {
    const m = mailList.find(x => x.id === id);
    if (!m) return;
    composingDraftId = id;
    $('composeModalTitle').textContent = '✏️ Edit Draft';
    $('composeTo').value = m.recipient_email || '';
    $('composeCc').value = '';
    $('composeSubject').value = m.subject || '';
    $('composeBody').value = m.body || '';
    $('composeModal').classList.remove('hidden');
  }

  async function saveDraft() {
    const to = $('composeTo').value.trim();
    const subject = $('composeSubject').value.trim();
    const body = $('composeBody').value.trim();
    if (!subject && !body) { toast('Nothing to save', 't-err'); return; }

    if (composingDraftId) {
      await API.updateMail(composingDraftId, { subject: subject || '(no subject)', body, recipient_email: to });
    } else {
      await API.createMail({
        folder: 'draft',
        sender_name: currentUser.name,
        sender_email: currentUser.email,
        recipient_email: to,
        subject: subject || '(no subject)',
        body,
        category: 'normal'
      });
    }
    closeModal('composeModal');
    await Promise.all([loadStats(), loadMailList()]);
    toast('💾 Draft saved', 't-success');
  }

  async function sendMail() {
    const to = $('composeTo').value.trim();
    const subject = $('composeSubject').value.trim();
    const body = $('composeBody').value.trim();

    if (!to) { toast('Please enter a recipient', 't-err'); return; }

    // Send via API (store in sent)
    await API.createMail({
      folder: 'sent',
      sender_name: currentUser.name,
      sender_email: currentUser.email,
      recipient_email: to,
      subject: subject || '(no subject)',
      body,
      preview: body.slice(0, 80),
      category: 'normal'
    });

    // If editing draft, delete it
    if (composingDraftId) {
      await API.deleteMail(composingDraftId);
    }

    // Also open mailto: link for immediate real email sending
    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // Offer to open in native mail client
    setTimeout(() => {
      if (confirm(`Email sent to Re Re! Open your device mail app to also send via ${to}?`)) {
        window.location.href = mailto;
      }
    }, 300);

    closeModal('composeModal');
    await Promise.all([loadStats(), loadMailList()]);
    toast('✉ Message sent!', 't-success');
    if (Voice.isListening()) Voice.speak(`Email sent to ${to}.`);
  }

  // ── NOTIFICATIONS ──
  async function openNotifications() {
    const notifs = await API.getNotifications();
    await API.markAllNotifRead();
    await loadStats();

    const el = $('notifList');
    if (!notifs.length) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--t2)">No notifications</div>';
    } else {
      el.innerHTML = notifs.map(n => `
        <div class="notif-card ${n.type} ${n.is_read ? '' : 'unread'}">
          <div class="nc-title">${esc(n.title)}</div>
          <div class="nc-body">${esc(n.body)}</div>
          <div class="nc-time">${esc(formatTime(n.created_at))}</div>
        </div>`).join('');
    }
    $('notifModal').classList.remove('hidden');
  }

  async function clearAllNotifs() {
    await API.clearNotifications();
    await loadStats();
    $('notifList').innerHTML = '<div style="padding:20px;text-align:center;color:var(--t2)">Notifications cleared</div>';
    toast('Notifications cleared');
  }

  // ── LINKED ACCOUNTS ──
  async function openProfile() {
    const linked = await API.getLinkedAccounts();
    const el = $('linkedAccountsList');
    if (!linked.length) {
      el.innerHTML = '<div style="font-size:0.74rem;color:var(--t2);margin-bottom:10px">No accounts linked yet.</div>';
    } else {
      el.innerHTML = linked.map(a => `
        <div class="linked-account-row">
          <div class="la-icon" style="background:rgba(66,133,244,0.1)">📧</div>
          <div class="la-info">
            <div class="la-name">${a.provider === 'gmail' ? 'Gmail' : a.provider === 'outlook' ? 'Outlook' : 'Mail'} ${a.is_primary ? '(Primary)' : ''}</div>
            <div class="la-addr">${esc(a.provider_email)}</div>
          </div>
          <div class="la-actions">
            <button class="btn btn-ghost" onclick="App.linkAccount('${a.provider}', '${a.provider_email}', '${a.provider_user_id || ''}', true)">Set Primary</button>
            <button class="btn btn-danger" onclick="App.unlinkAccount(${a.id})">Unlink</button>
          </div>
        </div>`).join('');
    }

    const alwaysOn = localStorage.getItem('rere_voice_always_on') === 'true';
    const voiceStatusEl = $('voiceStatusText');
    const voiceBtnEl = $('voiceAlwaysBtn');
    if (voiceStatusEl) voiceStatusEl.textContent = alwaysOn ? 'EDITH always-on voice is enabled.' : 'EDITH always-on voice is off.';
    if (voiceBtnEl) {
      voiceBtnEl.textContent = alwaysOn ? 'Disable EDITH' : 'Enable EDITH';
      voiceBtnEl.classList.toggle('btn-danger', alwaysOn);
      voiceBtnEl.classList.toggle('btn-primary', !alwaysOn);
    }

    $('profileModal').classList.remove('hidden');
  }

  function updateVoiceStatus() {
    const alwaysOn = localStorage.getItem('rere_voice_always_on') === 'true';
    const voiceStatusEl = $('voiceStatusText');
    const voiceBtnEl = $('voiceAlwaysBtn');
    if (voiceStatusEl) voiceStatusEl.textContent = alwaysOn ? 'EDITH always-on voice is enabled.' : 'EDITH always-on voice is off.';
    if (voiceBtnEl) {
      voiceBtnEl.textContent = alwaysOn ? 'Disable EDITH' : 'Enable EDITH';
      voiceBtnEl.classList.toggle('btn-danger', alwaysOn);
      voiceBtnEl.classList.toggle('btn-primary', !alwaysOn);
    }
  }

  function toggleVoiceAlwaysOn() {
    const enabled = localStorage.getItem('rere_voice_always_on') !== 'true';
    Voice.enableAlwaysOn(enabled);
    localStorage.setItem('rere_voice_always_on', enabled ? 'true' : 'false');
    updateVoiceStatus();
    openProfile();
  }

  }

  async function linkAccount(provider, email, provider_user_id = '', is_primary = false) {
    try {
      await API.linkAccount({ provider, provider_email: email, provider_user_id, is_primary });
      toast(`✅ ${provider} linked${is_primary ? ' as primary' : ''}!`, 't-success');
      // Reopen profile to show linked account
      openProfile();
      // Open real mail service
      const urls = { gmail: 'https://mail.google.com', outlook: 'https://outlook.live.com', yahoo: 'https://mail.yahoo.com' };
      if (urls[provider]) window.open(urls[provider], '_blank');
    } catch (e) {
      toast('Failed to link account', 't-err');
    }
  }

  async function unlinkAccount(id) {
    try {
      await API.unlinkAccount(id);
      toast('✅ Account unlinked', 't-success');
      openProfile();
    } catch (e) {
      toast('Failed to unlink account', 't-err');
    }
  }

  function toggleVoiceAlwaysOn() {
    const enabled = localStorage.getItem('rere_voice_always_on') !== 'true';
    Voice.enableAlwaysOn(enabled);
    openProfile();
  }

  // ── AI QUERY ──
  async function handleAIQuery(query, fromVoice = false) {
    try {
      const result = await API.aiQuery(query);
      const reply = result.reply || 'Sorry, I could not process that request.';
      showAIResponse(query, reply);
      if (fromVoice) Voice.speak(reply);

      // Optional action from AI endpoint
      if (result.context?.actions) {
        result.context.actions.forEach(action => {
          if (action.type === 'openView') switchView(action.view);
        });
      }
    } catch (e) {
      const lq = query.toLowerCase();
      let ans = '';
      const s = stats;

      if (lq.includes('meet')) ans = `${s.meetings || 0} meetings synced. ${meetingsList[0] ? `Next: ${meetingsList[0].title} on ${meetingsList[0].date} at ${meetingsList[0].start_time}.` : 'No meetings synced yet.'}`;
      else if (lq.includes('deadline') || lq.includes('due')) ans = 'Upcoming deadlines: Semester Fees (Mar 30), Internship Application (Apr 5), Final Exam (Apr 10).';
      else if (lq.includes('spam')) ans = `${s.spam || 0} spam emails detected and filtered.`;
      else if (lq.includes('summary') || lq.includes('today') || lq.includes('brief')) ans = `Today: ${s.inbox_unread || 0} unread emails, ${s.important || 0} important, ${s.meetings || 0} meetings, ${s.draft_count || 0} drafts.`;
      else if (lq.includes('important')) ans = `${s.important || 0} important emails. ${mailList.find(m=>m.is_important)?.subject || ''}`;
      else if (lq.includes('unread')) ans = `${s.inbox_unread || 0} unread emails in inbox.`;
      else if (lq.includes('draft')) ans = `${s.draft_count || 0} drafts saved.`;
      else if (lq.includes('sent')) ans = `${s.sent_count || 0} emails in sent folder.`;
      else ans = `You have ${s.inbox_unread || 0} unread emails and ${s.important || 0} important items. ${s.meetings || 0} meetings synced. ${mailList[0] ? `Latest: "${mailList[0].subject}" from ${mailList[0].sender_name}.` : ''}`;

      showAIResponse(query, ans);
      if (fromVoice) Voice.speak(ans);
    }
  }

  function showAIResponse(title, body) {
    const el = $('aiResponseBody');
    el.innerHTML = `<strong style="color:var(--ta);display:block;margin-bottom:10px">${esc(title)}</strong><div id="aiTypeTarget"></div>`;
    $('aiModal').classList.remove('hidden');
    // Typewriter effect
    const target = $('aiTypeTarget');
    if (target) {
      let i = 0;
      const interval = setInterval(() => {
        target.textContent = body.slice(0, i += 3);
        if (i >= body.length) clearInterval(interval);
      }, 18);
    }
  }

  // ── VIEW SWITCHING ──
  function switchView(view) {
    currentView = view;
    currentFilter = 'all';
    selectedMailId = null;
    selectedMailData = null;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));

    // Update title
    const titles = { inbox:'Inbox', important:'Important', starred:'Starred', draft:'Drafts', sent:'Sent', spam:'Spam', trash:'Trash', 'ai-dashboard':'AI Dashboard', 'voice-commands':'Voice Commands', meetings:'Meetings', newsletters:'Newsletters', deadlines:'Deadlines' };
    $('folderTitle').textContent = titles[view] || view;

    // Reset filter chips
    document.querySelectorAll('.fchip').forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));
    currentFilter = 'all';

    // Hide detail
    $('detailEmpty').classList.remove('hidden');
    $('detailView').classList.add('hidden');

    // Reset AI panel
    $('aiScrollArea').innerHTML = `
      <div class="ai-card">
        <div class="ac-label">TODAY'S OVERVIEW</div>
        <div class="overview-grid">
          <div class="ov-cell"><div class="ov-num" id="ov-imp">${stats.important||0}</div><div class="ov-label">Important</div></div>
          <div class="ov-cell"><div class="ov-num" id="ov-meet">${stats.meetings||0}</div><div class="ov-label">Meetings</div></div>
          <div class="ov-cell"><div class="ov-num" id="ov-unr">${stats.inbox_unread||0}</div><div class="ov-label">Unread</div></div>
          <div class="ov-cell"><div class="ov-num" id="ov-draft">${stats.draft_count||0}</div><div class="ov-label">Drafts</div></div>
        </div>
      </div>
      <p class="ai-hint-text">Select an email for AI analysis</p>`;

    // Mobile: show list
    document.getElementById('detailPanel').classList.remove('shown-mobile');
    document.getElementById('mailListPanel').classList.remove('hidden-mobile');

    if (view === 'voice-commands') { openVoiceHelp(); return; }
    loadMailList();
  }

  function openVoiceHelp() {
    const cmds = [
      { cmd: '"read inbox"', desc: 'Reads your inbox summary' },
      { cmd: '"next email"', desc: 'Opens next email' },
      { cmd: '"read email"', desc: 'Reads current email aloud' },
      { cmd: '"reply"', desc: 'Opens AI reply composer' },
      { cmd: '"compose"', desc: 'Opens new message' },
      { cmd: '"forward"', desc: 'Forwards current email' },
      { cmd: '"archive"', desc: 'Moves to trash' },
      { cmd: '"mark important"', desc: 'Marks as important' },
      { cmd: '"star this"', desc: 'Stars/unstars email' },
      { cmd: '"show meetings"', desc: 'Opens calendar' },
      { cmd: '"deadlines"', desc: 'Lists all deadlines' },
      { cmd: '"summary"', desc: 'AI daily briefing' },
      { cmd: '"unread count"', desc: 'Says unread count' },
      { cmd: '"search [term]"', desc: 'Searches your mail' },
      { cmd: '"show spam"', desc: 'Opens spam folder' },
      { cmd: '"show drafts"', desc: 'Opens drafts' },
      { cmd: '"focus mode"', desc: 'Toggles focus mode' },
      { cmd: '"dark/light theme"', desc: 'Changes theme' },
      { cmd: '"stop"', desc: 'Stops speaking' },
      { cmd: '"help"', desc: 'Shows this guide' },
    ];
    $('voiceCmdsGrid').innerHTML = cmds.map(c => `
      <div class="vcmd-card">
        <div class="vcmd-cmd">${c.cmd}</div>
        <div class="vcmd-desc">${c.desc}</div>
      </div>`).join('');
    $('voiceHelpModal').classList.remove('hidden');
  }

  // ── SEARCH ──
  async function doSearch(query) {
    if (!query.trim()) { switchView(currentView); return; }
    $('folderTitle').textContent = `Search: "${query}"`;
    const scroll = $('mailListScroll');
    scroll.innerHTML = '<div class="list-loading"><div class="loading-spinner"></div><span>Searching…</span></div>';
    try {
      const results = await API.getMails('inbox', 'all', query);
      mailList = results;
      renderMailList();
    } catch (e) {
      scroll.innerHTML = '<div class="empty-list">Search failed</div>';
    }
  }

  // ── NAVIGATION ──
  function selectNextMail() {
    const idx = mailList.findIndex(m => m.id === selectedMailId);
    if (idx < mailList.length - 1) openMail(mailList[idx + 1].id);
  }

  function selectPrevMail() {
    const idx = mailList.findIndex(m => m.id === selectedMailId);
    if (idx > 0) openMail(mailList[idx - 1].id);
  }

  // ── FOCUS MODE ──
  function toggleFocus() {
    focusActive = !focusActive;
    document.getElementById('sidebar').style.display = focusActive ? 'none' : '';
    document.getElementById('aiPanel').style.display = focusActive ? 'none' : '';
    const fab = $('focusFab');
    fab.textContent = focusActive ? '✕ Exit Focus' : '🎯 Focus Mode';
    fab.classList.toggle('active', focusActive);
    toast(focusActive ? '🎯 Focus mode — sidebars hidden' : 'Focus mode off');
  }

  // ── ANALYZE ALL ──
  async function analyzeAll() {
    toast('⚡ Analyzing all emails…');
    await new Promise(r => setTimeout(r, 1200));
    await loadStats();
    const imp = stats.important || 0;
    const meet = stats.meetings || 0;
    toast(`✅ Analysis complete — ${imp} important, ${meet} meetings found`, 't-success');
    if (Voice.isListening()) Voice.speak(`Analysis complete. ${imp} important emails found.`);
  }

  // ── CLOSE MODAL ──
  function closeModal(id) {
    $(id)?.classList.add('hidden');
  }

  // ── REFRESH ──
  async function refresh() {
    await Promise.all([loadStats(), loadMailList()]);
  }

  // ── GETTERS for Voice module ──
  function getMailList() { return mailList; }
  function getSelectedMail() { return selectedMailData; }
  function getCurrentStats() { return stats; }

  // ── INIT ──
  function init() {
    // Theme
    const savedTheme = localStorage.getItem('rere_theme') || 'dark';
    setTheme(savedTheme);

    // Auto-login if token exists
    if (API.getToken()) {
      API.me().then(user => {
        if (user?.id) bootApp(user);
        else { API.setToken(null); }
      }).catch(() => API.setToken(null));
    }

    // ── Event Listeners ──

    // Login form
    $('signinPassword')?.addEventListener('keypress', e => { if (e.key === 'Enter') doSignin(); });
    $('signinEmail')?.addEventListener('keypress', e => { if (e.key === 'Enter') doSignin(); });
    $('signupPassword')?.addEventListener('keypress', e => { if (e.key === 'Enter') doSignup(); });

    // Compose
    $('composeBtn')?.addEventListener('click', () => openCompose());
    $('saveDraftBtn')?.addEventListener('click', saveDraft);
    $('sendBtn')?.addEventListener('click', sendMail);

    // Voice
    $('voiceBtn')?.addEventListener('click', () => Voice.toggle());
    $('searchVoiceBtn')?.addEventListener('click', () => Voice.startListening());

    // Calendar
    $('calBtn')?.addEventListener('click', openCalendar);
    $('closeCalModal')?.addEventListener('click', () => closeModal('calModal'));

    // Notifications
    $('notifBtn')?.addEventListener('click', openNotifications);
    $('closeNotifModal')?.addEventListener('click', () => closeModal('notifModal'));

    // Profile
    $('avatarBtn')?.addEventListener('click', openProfile);
    $('closeProfileModal')?.addEventListener('click', () => closeModal('profileModal'));

    // AI ask
    $('aiAskSend')?.addEventListener('click', () => {
      const q = $('aiAskInput').value.trim();
      if (!q) return;
      handleAIQuery(q, false);
      $('aiAskInput').value = '';
    });
    $('aiAskInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') $('aiAskSend').click(); });
    $('closeAiModal')?.addEventListener('click', () => closeModal('aiModal'));

    // Nav items
    document.querySelectorAll('.nav-item').forEach(n => {
      n.addEventListener('click', () => switchView(n.dataset.view));
    });

    // Filter chips
    document.querySelectorAll('.fchip').forEach(c => {
      c.addEventListener('click', () => {
        document.querySelectorAll('.fchip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        currentFilter = c.dataset.filter;
        loadMailList();
      });
    });

    // Search
    $('searchInput')?.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      if (!q) { switchView(currentView); return; }
      clearTimeout(window._searchTimer);
      window._searchTimer = setTimeout(() => doSearch(q), 340);
    });

    // Analyze
    $('analyzeAllBtn')?.addEventListener('click', analyzeAll);

    // Focus
    $('focusFab')?.addEventListener('click', toggleFocus);

    // Mobile back button
    document.addEventListener('click', e => {
      if (e.target.closest('.detail-scroll') && window.innerWidth <= 680) {
        // handled by back navigation
      }
    });

    // Overlay click-outside to close
    document.querySelectorAll('.modal-overlay').forEach(o => {
      o.addEventListener('click', e => {
        if (e.target === o) o.classList.add('hidden');
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(o => o.classList.add('hidden'));
        Voice.hideOverlay();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); $('searchInput')?.focus(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openCompose(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '.') { e.preventDefault(); Voice.toggle(); }
      if (e.key === 'ArrowDown' && selectedMailId) { e.preventDefault(); selectNextMail(); }
      if (e.key === 'ArrowUp' && selectedMailId) { e.preventDefault(); selectPrevMail(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && selectedMailData) { e.preventDefault(); openCompose(selectedMailData.id); }
    });
  }

  // Public API
  return {
    init, toast, setTheme, switchView, doSearch, handleAIQuery, showAIResponse,
    openCompose, openComposeText, editDraft, sendMail,
    toggleStar, toggleImportant, deleteMail, restoreMail, notSpam,
    syncMeeting, openCalendar, removeMeeting,
    readAloud, openMailLink, openNotifications, clearAllNotifs,
    openProfile, linkAccount,
    selectNextMail, selectPrevMail,
    toggleFocus, analyzeAll, refresh,
    getMailList, getSelectedMail, getCurrentStats,
    closeModal,
  };
})();

// Global expose for inline HTML handlers
window.App = App;
window.doSignin = () => App.init._signin?.() || document.getElementById('signinBtn')?.click();

// ── BOOT ──
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Expose login functions globally
  window.switchTab = (tab) => {
    ['signin','signup'].forEach(t => {
      document.getElementById('ltab-' + t)?.classList.toggle('active', t === tab);
      document.getElementById(t + 'Form')?.classList.toggle('hidden', t !== tab);
    });
  };
  window.doSignin = async () => {
    const email = document.getElementById('signinEmail').value.trim();
    const pass = document.getElementById('signinPassword').value;
    const errEl = document.getElementById('signinError');
    errEl.classList.add('hidden');
    if (!email || !pass) { errEl.textContent = 'Please fill in all fields'; errEl.classList.remove('hidden'); return; }
    const btn = document.getElementById('signinBtn');
    btn.disabled = true;
    try {
      const data = await API.login(email, pass);
      API.setToken(data.token);
      App.init._boot ? App.init._boot(data.user) : location.reload();
    } catch (e) {
      errEl.textContent = e.message === 'Invalid credentials' ? 'Invalid email or password' : e.message;
      errEl.classList.remove('hidden');
    } finally { btn.disabled = false; }
  };
  window.doSignup = async () => {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const pass = document.getElementById('signupPassword').value;
    const errEl = document.getElementById('signupError');
    errEl.classList.add('hidden');
    if (!name || !email || !pass) { errEl.textContent = 'Please fill in all fields'; errEl.classList.remove('hidden'); return; }
    if (pass.length < 6) { errEl.textContent = 'Password min 6 characters'; errEl.classList.remove('hidden'); return; }
    const btn = document.getElementById('signupBtn');
    btn.disabled = true;
    try {
      const data = await API.signup(name, email, pass);
      API.setToken(data.token);
      location.reload();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    } finally { btn.disabled = false; }
  };
  window.doDemo = async () => {
    try {
      const data = await API.demo();
      API.setToken(data.token);
      location.reload();
    } catch (e) { App.toast('Demo error: ' + e.message, 't-err'); }
  };
  window.doLogout = () => App.doLogout ? App.doLogout() : null;
  window.doLogout = async () => {
    try { await API.logout(); } catch (e) {}
    API.setToken(null);
    App.closeModal('profileModal');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('loginScreen').style.display = 'flex';
  };
  window.linkAccount = (provider, email) => App.linkAccount(provider, email);
  window.closeModal = (id) => App.closeModal(id);
  window.openCalendar = () => App.openCalendar();
  window.stopVoice = () => Voice.stopListening();

  // App.doLogout
  App.doLogout = async () => {
    try { await API.logout(); } catch (e) {}
    API.setToken(null);
    App.closeModal('profileModal');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('loginScreen').style.display = 'flex';
    App.toast('Signed out successfully');
  };
});
