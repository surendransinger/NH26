/**
 * RE RE MAIL — Voice Assistant
 * Google Assistant-style voice commands with TTS
 */

const Voice = (() => {
  const synth = window.speechSynthesis;
  let recognition = null;
  let isListening = false;
  let continuous = false;
  let voiceEnabled = false;

  // ── Setup speech recognition ──
  function init() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return false;
    recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 2;

    recognition.onstart = () => {
      isListening = true;
      document.getElementById('voiceOverlay').classList.remove('hidden');
      document.getElementById('voTranscript').textContent = 'Listening…';
      document.getElementById('voCmd').textContent = 'Say a command…';
      document.querySelector('.voice-btn')?.classList.add('listening');
    };

    recognition.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      const shown = final || interim;
      document.getElementById('voTranscript').textContent = shown || 'Listening…';
      if (final) {
        document.getElementById('voCmd').textContent = 'Processing…';
        processCommand(final.toLowerCase().trim());
      }
    };

    recognition.onerror = (e) => {
      isListening = false;
      document.querySelector('.voice-btn')?.classList.remove('listening');
      if (e.error === 'no-speech') {
        document.getElementById('voCmd').textContent = 'No speech detected. Tap mic to retry.';
        setTimeout(hideOverlay, 2000);
      } else if (e.error === 'not-allowed') {
        document.getElementById('voCmd').textContent = 'Mic permission denied.';
        App.toast('Microphone access denied. Enable in browser settings.', 't-err');
        setTimeout(hideOverlay, 2500);
      } else {
        document.getElementById('voCmd').textContent = `Error: ${e.error}`;
        setTimeout(hideOverlay, 2000);
      }
    };

    recognition.onend = () => {
      isListening = false;
      document.querySelector('.voice-btn')?.classList.remove('listening');
      if (continuous && voiceEnabled) {
        setTimeout(() => { if (voiceEnabled) startListening(); }, 500);
      } else {
        setTimeout(hideOverlay, 1800);
      }
    };

    return true;
  }

  function hideOverlay() {
    document.getElementById('voiceOverlay').classList.add('hidden');
    document.getElementById('voTranscript').textContent = 'Listening…';
    document.getElementById('voCmd').textContent = 'Say a command…';
  }

  // ── Speak ──
  function speak(text, onEnd) {
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.volume = 0.9;
    // Try to get a good voice
    const voices = synth.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') && v.lang === 'en-US')
      || voices.find(v => v.lang === 'en-US' && !v.name.includes('compact'))
      || voices[0];
    if (preferred) utterance.voice = preferred;
    if (onEnd) utterance.onend = onEnd;
    synth.speak(utterance);

    // Update overlay if visible
    if (!document.getElementById('voiceOverlay').classList.contains('hidden')) {
      document.getElementById('voCmd').textContent = '🔊 ' + text;
    }
  }

  function stopSpeaking() {
    synth && synth.cancel();
  }

  function startListening() {
    if (!recognition && !init()) {
      App.toast('Speech recognition not supported in this browser', 't-err');
      return;
    }
    try {
      recognition.start();
    } catch (e) {
      recognition = null;
      if (init()) try { recognition.start(); } catch (e2) { App.toast('Could not start voice assistant', 't-err'); }
    }
  }

  function stopListening() {
    continuous = false;
    voiceEnabled = false;
    isListening = false;
    try { recognition && recognition.stop(); } catch (e) {}
    stopSpeaking();
    document.querySelector('.voice-btn')?.classList.remove('listening');
    hideOverlay();
  }

  function toggle() {
    if (isListening) {
      stopListening();
      App.toast('Voice assistant off');
    } else {
      voiceEnabled = true;
      startListening();
      speak('Re Re voice assistant activated. How can I help you?');
      App.toast('🎙 Voice assistant ON — Say a command!', 't-voice');
    }
  }

  // ── COMMAND PROCESSOR ──
  async function processCommand(cmd) {
    const say = (text) => speak(text);
    const t = (msg, type) => App.toast(msg, type);
    const mails = App.getMailList();
    const selectedMail = App.getSelectedMail();
    const stats = App.getCurrentStats();

    // ─ Navigation ─
    if (cmd.match(/\b(open|show|go to|navigate to)?\s*(inbox|in box)\b/)) {
      App.switchView('inbox');
      say(`Your inbox has ${stats.inbox_unread} unread emails.`); return;
    }
    if (cmd.match(/\b(show|open)?\s*important\b/)) {
      App.switchView('important');
      say(`Showing ${stats.important} important emails.`); return;
    }
    if (cmd.match(/\b(show|open)?\s*(spam|junk)\b/)) {
      App.switchView('spam');
      say(`Showing spam folder with ${stats.spam} emails.`); return;
    }
    if (cmd.match(/\b(show|open)?\s*(sent|sent mail)\b/)) {
      App.switchView('sent');
      say(`Showing ${stats.sent_count} sent emails.`); return;
    }
    if (cmd.match(/\b(show|open)?\s*(draft|drafts)\b/)) {
      App.switchView('draft');
      say(`You have ${stats.draft_count} drafts.`); return;
    }
    if (cmd.match(/\b(show|open)?\s*(trash|deleted|bin)\b/)) {
      App.switchView('trash'); say('Opening trash.'); return;
    }
    if (cmd.match(/\b(show|open)?\s*meeting(s)?\b|calendar\b/)) {
      App.openCalendar();
      say(`You have ${stats.meetings} meetings synced. Opening calendar.`); return;
    }
    if (cmd.match(/\bstar(red)?\b/)) {
      App.switchView('starred'); say('Showing starred emails.'); return;
    }

    // ─ Reading ─
    if (cmd.match(/\bread\s*(inbox|all)?\b/) && !cmd.includes('unread')) {
      const inboxMails = mails.filter(m => m.folder === 'inbox').slice(0, 3);
      if (!inboxMails.length) { say('Your inbox is empty.'); return; }
      const summary = inboxMails.map((m, i) => `${i+1}. From ${m.sender_name}: ${m.subject}`).join('. ');
      say(`Your inbox. ${summary}`);
      t('📬 Reading inbox summary', 't-voice'); return;
    }
    if (cmd.match(/\bread\s*(this|current|email|message)\b/)) {
      if (selectedMail) {
        say(`Email from ${selectedMail.sender_name}. Subject: ${selectedMail.subject}. ${selectedMail.body || ''}`);
      } else {
        say('Please select an email first.');
        t('Select an email first');
      }
      return;
    }
    if (cmd.match(/\bnext\s*(email|message|mail)\b/)) {
      App.selectNextMail();
      const next = App.getSelectedMail();
      if (next) say(`Opening email from ${next.sender_name}. Subject: ${next.subject}.`);
      else say('No more emails.');
      return;
    }
    if (cmd.match(/\b(previous|prev|back)\s*(email|message|mail)\b/)) {
      App.selectPrevMail();
      const prev = App.getSelectedMail();
      if (prev) say(`Opening email from ${prev.sender_name}.`);
      else say('No previous emails.');
      return;
    }

    // ─ Actions ─
    if (cmd.match(/\bcompose\b|\bnew\s*(email|message|mail)\b|\bwrite\b/)) {
      App.openCompose();
      say('Opening compose window.');
      t('Opening compose…'); return;
    }
    if (cmd.match(/\breply\b|\brespond\b/)) {
      if (selectedMail) {
        App.openCompose(selectedMail.id);
        say('Opening reply with AI draft.');
      } else {
        say('Please select an email to reply to.');
      }
      return;
    }
    if (cmd.match(/\b(archive|delete|trash)\s*(this|email|message|it)?\b/)) {
      if (selectedMail) {
        await App.deleteMail(selectedMail.id);
        say('Email moved to trash.');
      } else {
        say('Please select an email first.');
      }
      return;
    }
    if (cmd.match(/\bmark\s*(as\s*)?\bimportant\b/)) {
      if (selectedMail) {
        await App.toggleImportant(selectedMail.id);
        say(selectedMail.is_important ? 'Unmarked as important.' : 'Marked as important.');
      } else {
        say('Please select an email first.');
      }
      return;
    }
    if (cmd.match(/\bstar\s*(this|email|message|it)?\b/)) {
      if (selectedMail) {
        await App.toggleStar(selectedMail.id);
        say(selectedMail.is_starred ? 'Unstarred.' : 'Starred.');
      } else {
        say('Please select an email first.');
      }
      return;
    }
    if (cmd.match(/\b(add|sync)\s*(meeting|to calendar)\b/)) {
      if (selectedMail?.has_meeting) {
        await App.syncMeeting(selectedMail.id);
        say(`Meeting added: ${selectedMail.meeting_title} on ${selectedMail.meeting_date} at ${selectedMail.meeting_time}.`);
      } else {
        say('No meeting found in this email.');
      }
      return;
    }
    if (cmd.match(/\bnot\s*spam\b|\bmove to inbox\b/)) {
      if (selectedMail) {
        await API.updateMail(selectedMail.id, { folder: 'inbox', category: 'normal' });
        App.refresh();
        say('Moved to inbox.');
      }
      return;
    }
    if (cmd.match(/\bforward\b/)) {
      if (selectedMail) {
        App.openCompose(null, 'forward', selectedMail.id);
        say('Opening forward window.');
      } else {
        say('Please select an email to forward.');
      }
      return;
    }

    // ─ Info queries ─
    if (cmd.match(/\bhow\s*many\s*unread\b|\bunread\s*(count|emails|messages)\b/)) {
      say(`You have ${stats.inbox_unread} unread emails in your inbox.`);
      t(`📬 ${stats.inbox_unread} unread emails`); return;
    }
    if (cmd.match(/\bdeadline(s)?\b|\bdue\s*(date|soon)?\b/)) {
      say('Upcoming deadlines: Semester fees due March 30. Internship application due April 5. Final exam due April 10.');
      t('⏰ Checking deadlines', 't-acc'); return;
    }
    if (cmd.match(/\b(daily\s*)?brief(ing)?\b|\bsummary\b|\btoday\b/)) {
      const briefing = `Today's briefing: ${stats.inbox_unread} unread emails, ${stats.important} important, ${stats.meetings} meetings, ${stats.draft_count} drafts. ${stats.inbox_unread > 0 ? `Most urgent: ${mails[0]?.subject || 'check your inbox'}.` : 'No urgent emails right now.'}`;
      say(briefing);
      App.showAIResponse('Daily Briefing', briefing); return;
    }
    if (cmd.match(/\bnotification(s)?\b/)) {
      App.openNotifications();
      say(`You have ${stats.notifs} unread notifications.`); return;
    }

    // ─ UI controls ─
    if (cmd.match(/\bfocus\s*(mode)?\b/)) {
      App.toggleFocus();
      say(document.getElementById('focusFab').classList.contains('active') ? 'Focus mode on. Sidebars hidden.' : 'Focus mode off.'); return;
    }
    if (cmd.match(/\bstop\b|\bcancel\b|\bnever\s*mind\b|\bquiet\b/)) {
      stopSpeaking();
      hideOverlay();
      say('Stopped.'); return;
    }
    if (cmd.match(/\bhelp\b|\bcommands?\b|\bwhat can you\b/)) {
      document.getElementById('voiceHelpModal').classList.remove('hidden');
      say('Opening voice commands help. You can say: read inbox, compose email, reply, next email, show meetings, deadlines, summary, and more.'); return;
    }

    // ─ Search ─
    const searchMatch = cmd.match(/\b(search|find|look for|search for)\s+(.+)/);
    if (searchMatch) {
      const term = searchMatch[2];
      document.getElementById('searchInput').value = term;
      App.doSearch(term);
      say(`Searching for ${term}.`); return;
    }

    // ─ Theme ─
    if (cmd.match(/\b(dark|light|midnight|sepia)\s*(theme|mode)?\b/)) {
      const themes = ['dark', 'light', 'midnight', 'sepia'];
      const found = themes.find(t => cmd.includes(t));
      if (found) { App.setTheme(found); say(`${found} theme applied.`); return; }
    }

    // ─ Fallback: AI query ─
    say(`Processing your request: ${cmd}`);
    setTimeout(() => App.handleAIQuery(cmd, true), 300);
  }

  return {
    toggle,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    hideOverlay,
    isListening: () => isListening,
    setVoiceEnabled: (v) => { voiceEnabled = v; },
    setContinuous: (v) => { continuous = v; }
  };
})();
