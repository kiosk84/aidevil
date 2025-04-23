const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');

// Initialize Express
const app = express();
app.use(bodyParser.json());

// In-memory storage
const pending = new Map();
const participantsList = new Set();

// Bot setup
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const HOST = process.env.HOST_URL;

// Track next spin time for front-end
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
            [{ text: '➡️ Открыть приложение', web_app: { url: HOST } }]
          ]
        }
      });
    }
  } catch (err) {
    console.error('Error in /start:', err);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

// Launch bot
bot.launch({ polling: true })
  .then(() => console.log('Bot launched (polling)'))
  .catch(err => console.error('Bot launch error:', err));

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Frontend notification API
app.post('/notify', async (req, res) => {
  const { telegramId, message } = req.body;
  try {
    await bot.telegram.sendMessage(telegramId, message);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// User submits participation
app.post('/pending', (req, res) => {
  const { name, telegramId } = req.body;
  if (!name || !telegramId) return res.status(400).json({ error: 'Missing name or telegramId' });
  if (participantsList.has(telegramId)) return res.status(400).json({ error: 'Уже участник' });
  if (pending.has(telegramId)) return res.status(400).json({ error: 'Ваш платеж на проверке' });
  pending.set(telegramId, name);
  // Notify admin
  bot.telegram.sendMessage(ADMIN_ID, `Новый участник: ${name} (ID: ${telegramId})`, {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Подтвердить', callback_data: `approve:${telegramId}` },
        { text: '❌ Отклонить', callback_data: `reject:${telegramId}` }
      ]]
    }
  });
  res.json({ status: 'pending' });
});

// Check pending or approved
app.get('/pending/check', (req, res) => {
  const telegramId = req.query.telegramId;
  if (participantsList.has(telegramId)) return res.status(400).json({ error: 'Вы уже участник' });
  if (pending.has(telegramId)) return res.status(400).json({ error: 'Ваш платеж на проверке' });
  res.json({ status: 'ok' });
});

// Handle admin approve/reject callbacks
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const [action, telegramId] = data.split(':');
  const name = pending.get(telegramId);
  if (!name) { await ctx.answerCbQuery('Не найден'); return; }
  if (action === 'approve') {
    pending.delete(telegramId);
    participantsList.add(telegramId);
    await bot.telegram.sendMessage(telegramId, 'Ваше участие подтверждено! Ожидайте розыгрыш.');
    await ctx.editMessageText(`Участник ${name} подтвержден`);
  } else if (action === 'reject') {
    pending.delete(telegramId);
    await bot.telegram.sendMessage(telegramId, 'Ваш платеж отклонен. Свяжитесь с поддержкой.');
    await ctx.editMessageText(`Участник ${name} отклонен`);
  }
  await ctx.answerCbQuery();
});

// Provide next spin time for countdown
app.get('/next-spin', (req, res) => {
  if (!nextSpinTime) return res.status(503).json({ error: 'Not scheduled yet' });
  res.json({ nextSpinTime: nextSpinTime.toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Express server listening on ${PORT}`));