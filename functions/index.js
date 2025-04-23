const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors'); // Added cors
const { Telegraf } = require('telegraf');

// API routes (Imported from server.js)
const participantsRoute = require('./routes/participants');
const pendingRoute = require('./routes/pending'); // Note: This might conflict with the /pending route defined below
const winnersRoute = require('./routes/winners');
const prizepoolRoute = require('./routes/prizepool');
const spinRoute = require('./routes/spin');
const timerRoute = require('./routes/timer');
const db = require('./db'); // Import database module

// Initialize Express
const app = express();

// Middleware (Combined from server.js and functions/index.js)
// Log all incoming HTTP requests
app.use((req, res, next) => { console.log(`REQ ${req.method} ${req.url} from ${req.ip}`); next(); });
// CORS configuration
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow non-browser or postman
    // Ensure FRONTEND_URL is loaded from .env
    const raw = process.env.FRONTEND_URL || '*';
    const allowed = raw.split(',').map(s => s.trim());
    if (allowed.includes('*') || allowed.includes(origin)) cb(null, true);
    else cb(new Error(`CORS blocked: ${origin}`));
  }
}));
app.use(express.json()); // Replaced bodyParser.json()

// Removed in-memory storage for pending/participants
// const pending = new Map();
// const participantsList = new Set();

// Bot setup (Kept from original functions/index.js)
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("Error: BOT_TOKEN is not defined in .env");
  process.exit(1);
}
const ADMIN_ID = process.env.ADMIN_ID;
const HOST = process.env.HOST_URL; // Used for Web App URL in bot message

// Track next spin time for front-end (Kept from original functions/index.js)
let nextSpinTime = null;
function scheduleNextSpin() {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0,0,0,0);
  next.setHours(now.getHours() + 1);
  nextSpinTime = next;
  setTimeout(scheduleNextSpin, next - now);
}
// Initialize next spin schedule
scheduleNextSpin();

const bot = new Telegraf(BOT_TOKEN);
const users = new Set();

// Handle /start
bot.start(async (ctx) => {
  try {
    const id = ctx.from.id.toString();
    users.add(id);
    const isAdmin = id === ADMIN_ID;
    if (isAdmin) {
      await ctx.reply('Добро пожаловать, админ! 👑', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👥 Список участников', callback_data: 'getParticipants' }, { text: '🏆 Победители', callback_data: 'getWinners' }],
            [{ text: '💰 Призовой фонд', callback_data: 'getPrizePool' }, { text: '🔄 Сброс', callback_data: 'reset' }],
            [{ text: '⏰ Установить таймер', callback_data: 'timerPrompt' }, { text: '🗑 Удалить участника', callback_data: 'deletePrompt' }]
          ]
        }
      });
    } else {
      await ctx.reply(`👋 Добро пожаловать в игру «Колесо Фортуны»!\n✨ Ты на шаг ближе к тому, чтобы испытать удачу и сорвать куш! 🔥\n\n🎁 Каждый день в 20:00 мы разыгрываем призовой фонд среди участников игры.\n✅ Всё честно, прозрачно и в реальном времени!\n\n⏰ Следующий розыгрыш уже скоро — не упусти шанс стать победителем! 🍀`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '➡️ Открыть приложение', web_app: { url: 'https://aidevil.vercel.app/' } }
            ]
          ]
        }
      });
    }
  } catch (err) {
    console.error('Error in /start:', err);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

// Handle admin approve/reject callbacks (Moved before API routes mounting)
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  console.log('Received callback query:', data); // Log received data

  // Handle pending approval/rejection based on name (format: approve_NAME or reject_NAME)
  if (data.startsWith('approve_') || data.startsWith('reject_')) {
    const parts = data.split('_');
    const action = parts[0];
    const name = parts.slice(1).join('_'); // Re-join name if it contained underscores

    try {
      // Find the user in the pending table by name
      db.get('SELECT telegramId FROM pending WHERE name = ?', [name], async (err, pendingUser) => {
        if (err) {
          console.error('DB error fetching pending user:', err);
          await ctx.answerCbQuery('Ошибка базы данных');
          return;
        }
        if (!pendingUser) {
          console.warn(`Pending user not found for name: ${name}`);
          await ctx.answerCbQuery('Заявка не найдена или уже обработана');
          return;
        }

        const telegramId = pendingUser.telegramId;

        if (action === 'approve') {
          // Move from pending to participants
          db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('INSERT INTO participants (name, telegramId) VALUES (?, ?)', [name, telegramId], (insertErr) => {
              if (insertErr) {
                console.error('DB error inserting participant:', insertErr);
                db.run('ROLLBACK');
                ctx.answerCbQuery('Ошибка добавления участника');
                return;
              }
              db.run('DELETE FROM pending WHERE name = ?', [name], (deleteErr) => {
                if (deleteErr) {
                  console.error('DB error deleting pending:', deleteErr);
                  db.run('ROLLBACK');
                  ctx.answerCbQuery('Ошибка удаления заявки');
                  return;
                }
                // Increment prize pool (assuming table prize_pool exists with id=1)
                db.run('UPDATE prize_pool SET amount = amount + 100 WHERE id = 1', (poolErr) => {
                   if (poolErr) console.error('Prize pool update error:', poolErr); // Log error but continue
                   db.run('COMMIT', async (commitErr) => {
                     if (commitErr) {
                        console.error('DB commit error:', commitErr);
                        ctx.answerCbQuery('Ошибка сохранения');
                        return;
                     }
                     console.log(`User ${name} (${telegramId}) approved.`);
                     await bot.telegram.sendMessage(telegramId, '✅ Ваше участие подтверждено! Ожидайте розыгрыш.');
                     await ctx.editMessageText(`Участник ${name} подтвержден.`);
                     await ctx.answerCbQuery('Подтверждено');
                   });
                });
              });
            });
          });
        } else if (action === 'reject') {
          // Just remove from pending
          db.run('DELETE FROM pending WHERE name = ?', [name], async (deleteErr) => {
            if (deleteErr) {
              console.error('DB error deleting pending:', deleteErr);
              await ctx.answerCbQuery('Ошибка удаления заявки');
              return;
            }
            console.log(`User ${name} (${telegramId}) rejected.`);
            await bot.telegram.sendMessage(telegramId, '❌ Ваш платеж отклонен. Свяжитесь с поддержкой.');
            await ctx.editMessageText(`Участник ${name} отклонен.`);
            await ctx.answerCbQuery('Отклонено');
          });
        }
      });
    } catch (error) {
      console.error('Error processing callback query:', error);
      await ctx.answerCbQuery('Внутренняя ошибка');
    }
  } else if (data === 'getParticipants') {
    // Вывод списка участников
    db.all('SELECT name FROM participants', async (err, rows) => {
      if (err) return ctx.reply('Ошибка базы данных');
      if (!rows.length) return ctx.reply('Нет участников');
      const list = rows.map((r, i) => `${i + 1}. ${r.name}`).join('\n');
      await ctx.reply(`Список участников:\n${list}`);
    });
  } else if (data === 'getWinners') {
    // Вывод истории победителей
    db.all('SELECT name, prize, timestamp FROM winners ORDER BY timestamp DESC LIMIT 10', async (err, rows) => {
      if (err) return ctx.reply('Ошибка базы данных');
      if (!rows.length) return ctx.reply('Победителей пока нет');
      const list = rows.map(r => `${r.name} — ${r.prize}₽ (${new Date(r.timestamp).toLocaleString('ru-RU')})`).join('\n');
      await ctx.reply(`Последние победители:\n${list}`);
    });
  } else if (data === 'getPrizePool') {
    // Вывод призового фонда
    db.get('SELECT amount FROM prize_pool WHERE id = 1', async (err, row) => {
      if (err) return ctx.reply('Ошибка базы данных');
      await ctx.reply(`Текущий призовой фонд: ${row?.amount || 0}₽`);
    });
  } else if (data === 'reset') {
    // Сброс участников и призового фонда
    db.serialize(() => {
      db.run('DELETE FROM participants');
      db.run('DELETE FROM pending');
      db.run('UPDATE prize_pool SET amount = 0 WHERE id = 1');
    });
    await ctx.reply('Все участники и призовой фонд сброшены!');
  } else if (data === 'timerPrompt') {
    // Запросить/показать текущее время розыгрыша (заглушка)
    await ctx.reply('Функция установки таймера пока не реализована.');
  } else if (data === 'deletePrompt') {
    // Запросить имя для удаления участника
    await ctx.reply('Введите имя участника, которого нужно удалить, командой: /delete Имя');
  } else {
    // Handle other callback queries if necessary
    console.log(`Unhandled callback query data: ${data}`);
    // Consider calling next() if using middleware pattern or just answering
    await ctx.answerCbQuery(); // Acknowledge other callbacks silently
  }
});

// Handle /delete command
bot.command('delete', async (ctx) => {
  const id = ctx.from.id.toString();
  if (id !== ADMIN_ID) return ctx.reply('Только админ может удалять участников.');
  const args = ctx.message.text.split(' ').slice(1);
  if (!args.length) return ctx.reply('Укажите имя участника: /delete Имя');
  const name = args.join(' ');
  db.get('SELECT * FROM participants WHERE name = ?', [name], (err, row) => {
    if (err) return ctx.reply('Ошибка базы данных');
    if (!row) return ctx.reply('Участник не найден');
    db.run('DELETE FROM participants WHERE name = ?', [name], (err2) => {
      if (err2) return ctx.reply('Ошибка при удалении');
      ctx.reply(`Участник ${name} удалён.`);
    });
  });
});

// --- API Endpoints ---

// Mount API endpoints from routes/ (Copied from server.js)
app.use('/participants', participantsRoute);
app.use('/pending', pendingRoute); // Uncommented: Use routes from pending.js
app.use('/winners', winnersRoute);
app.use('/prizepool', prizepoolRoute);
app.use('/spin', spinRoute);
app.use('/timer', timerRoute);

// API routes defined directly in this file (Kept from original functions/index.js)
// Frontend notification API
app.post('/notify', async (req, res) => {
  const { telegramId, message } = req.body;
  if (!telegramId || !message) return res.status(400).json({ error: 'Missing telegramId or message' });
  try {
    await bot.telegram.sendMessage(telegramId, message);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Removed direct definitions for POST /pending and GET /pending/check
// These are now handled by functions/routes/pending.js

// --- Bot Launch and Server Start ---

// Launch bot (Kept from original functions/index.js)
// Make sure bot is launched *after* routes and handlers are defined
bot.launch({ polling: true }) // Using polling as in original functions/index.js
  .then(() => console.log('Bot launched successfully (polling)'))
  .catch(err => console.error('Bot launch error:', err));

// Graceful shutdown (Kept from original functions/index.js)
process.once('SIGINT', () => { console.log("SIGINT received, stopping bot..."); bot.stop('SIGINT'); process.exit(0); });
process.once('SIGTERM', () => { console.log("SIGTERM received, stopping bot..."); bot.stop('SIGTERM'); process.exit(0); });


// Start Express server (Using port from server.js logic)
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Express server running at http://0.0.0.0:${PORT}`);
  // Optional: Set webhook if HOST_URL and WEBHOOK_PATH are defined (alternative to polling)
  // const webhookPath = process.env.WEBHOOK_PATH;
  // if (HOST && webhookPath) {
  //   const webhookUrl = `${HOST}${webhookPath}`;
  //   bot.telegram.setWebhook(webhookUrl)
  //     .then(() => console.log(`Webhook set to ${webhookUrl}`))
  //     .catch(err => console.error('Error setting webhook:', err));
  //   // Need to handle webhook updates on a specific route, e.g., app.use(bot.webhookCallback(webhookPath));
  // } else {
  //   console.log("Polling mode enabled. HOST_URL or WEBHOOK_PATH not fully configured for webhook mode.");
  // }
});

// Export bot and app for potential use in routes or other modules
module.exports = { app, bot, ADMIN_ID };
