const express = require('express');
const router = express.Router();

module.exports = (db) => {
  router.post('/query', (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query required' });

    const normalized = query.toLowerCase();
    let response = "Sorry, I couldn't understand that command. Try 'check my inbox' or 'compose email'.";

    if (normalized.includes('inbox') || normalized.includes('check mail') || normalized.includes('unread')) {
      response = 'Opening your inbox now. Showing latest messages.';
    } else if (normalized.includes('compose') || normalized.includes('send email')) {
      response = 'Ready to compose. Who should I send it to?';
    } else if (normalized.includes('summarize') || normalized.includes('summary')) {
      response = 'I will summarize your latest email threads and highlight action items.';
    } else if (normalized.includes('schedule') || normalized.includes('meeting')) {
      response = 'Creating meeting suggestions based on recent conversations.';
    } else if (normalized.includes('link') || normalized.includes('gmail')) {
      response = 'You can link your Gmail account in settings. I will guide you through it.';
    } else if (normalized.includes('edith') || normalized.includes('iron man') || normalized.includes('tony stark')) {
      response = 'EDITH mode is active. I will respond like a proactive AI assistant and keep voice listening on in the background.';
    }

    const ctx = {
      intent: normalized,
      actions: [],
    };

    if (normalized.includes('inbox')) ctx.actions.push({ type: 'openView', view: 'inbox' });
    if (normalized.includes('compose')) ctx.actions.push({ type: 'openView', view: 'compose' });

    res.json({ reply: response, context: ctx });
  });

  return router;
};