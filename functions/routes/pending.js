const express = require('express');
const db = require('../db');
const { bot, ADMIN_ID } = require('../bot');
const router = express.Router();

// GET /pending
router.get('/', (req, res) => {
  db.all('SELECT name FROM pending', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows.map(r => r.name));
  });
});

// GET /pending/check?telegramId=...  Проверка участия по telegramId
router.get('/check', (req, res) => {
  const telegramId = req.query.telegramId;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  // Admin bypass
  if (telegramId === ADMIN_ID) return res.json({ success: true });
  // Проверяем pending
  db.get('SELECT 1 FROM pending WHERE telegramId = ?', [telegramId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (row) return res.status(409).json({ error: 'Вы уже участвуете в розыгрыше. Дождитесь результатов.' });
    // Проверяем participants
    db.get('SELECT 1 FROM participants WHERE telegramId = ?', [telegramId], (err2, row2) => {
      if (err2) return res.status(500).json({ error: 'Database error' });
      if (row2) return res.status(409).json({ error: 'Вы уже участвуете в розыгрыше. Дождитесь результатов.' });
      res.json({ success: true });
    });
  });
});

// POST /pending
router.post('/', (req, res) => {
  const { name, telegramId } = req.body;
  if (!name || !telegramId) return res.status(400).json({ error: 'Name and telegramId required' });

  // Check if user already pending by telegramId
  db.get('SELECT * FROM pending WHERE telegramId = ?', [telegramId], (err, row) => {
    if (row) return res.status(409).json({ error: 'Вы уже участвуете в розыгрыше. Дождитесь результатов.' });
    // Check if already registered by telegramId
    db.get('SELECT * FROM participants WHERE telegramId = ?', [telegramId], (err2, row2) => {
      if (row2) return res.status(409).json({ error: 'Вы уже участвуете в розыгрыше. Дождитесь результатов.' });
      // Check duplicate name
      db.get('SELECT * FROM pending WHERE name = ?', [name], (err3, row3) => {
        if (row3) return res.status(409).json({ error: 'Участник с таким именем уже подал заявку.' });
        // Insert into pending
        db.run('INSERT INTO pending (name, telegramId) VALUES (?, ?)', [name, telegramId], (err4) => {
          if (err4) return res.status(500).json({ error: 'DB error' });

          // Уведомление админа через Telegram на русском
          bot.telegram.sendMessage(
            ADMIN_ID,
            `Новая заявка на участие:\nИмя: ${name}\nTelegram ID: ${telegramId}`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '✅ Подтвердить', callback_data: `approve_${name}` },
                    { text: '❌ Отклонить', callback_data: `reject_${name}` }
                  ]
                ]
              }
            }
          );
          res.json({ success: true });
        });
      });
    });
  });
});

module.exports = router;
