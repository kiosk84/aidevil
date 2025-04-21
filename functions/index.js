require('dotenv').config({ path: '../.env' });
const db = require('./db');
const { bot, ADMIN_ID } = require('./bot');
const express = require('express');
const cors = require('cors');
const logger = require('./logger');
const bodyParser = require('body-parser');
const CHANNEL_URL = 'https://t.me/channel_fortune';
const WELCOME_MESSAGE = `👋 Добро пожаловать в игру «Колесо Фортуны»!
✨ Ты на шаг ближе к тому, чтобы испытать удачу и сорвать куш! 🔥

🎁 Каждый день в 20:00 мы разыгрываем призовой фонд среди участников игры.
✅ Всё честно, прозрачно и в реальном времени!

⏰ Следующий розыгрыш уже скоро — не упусти шанс стать победителем! 🍀`;
// Route handlers
const participantsRoute = require('./routes/participants');
const pendingRoute = require('./routes/pending');
const winnersRoute = require('./routes/winners');
const prizepoolRoute = require('./routes/prizepool');
const spinRoute = require('./routes/spin');
const timerRoute = require('./routes/timer');

// Инициализация таблиц
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      telegramId TEXT NOT NULL UNIQUE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS pending (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      telegramId TEXT NOT NULL UNIQUE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS winners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      telegramId TEXT NOT NULL,
      prize INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS prize_pool (
      id INTEGER PRIMARY KEY,
      amount INTEGER NOT NULL
    )
  `);
  db.get('SELECT amount FROM prize_pool WHERE id = 1', (err, row) => {
    if (!row) {
      db.run('INSERT INTO prize_pool (id, amount) VALUES (1, 0)');
    }
  });
});

// Обработка команды /start
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const isAdmin = telegramId === ADMIN_ID;
    logger.info(`Received /start from user: ${telegramId}, isAdmin: ${isAdmin}`);

    if (isAdmin) {
      await ctx.reply('Добро пожаловать, админ! 👑', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➡️ Открыть приложение', web_app: { url: `${process.env.HOST_URL}?telegramId=${telegramId}` } }],
            [{ text: '👥 Список участников', callback_data: 'getParticipants' }, { text: '🏆 Победители', callback_data: 'getWinners' }],
            [{ text: '💰 Призовой фонд', callback_data: 'getPrizePool' }, { text: '🔄 Сброс', callback_data: 'reset' }],
            [{ text: '⏰ Установить таймер', callback_data: 'timerPrompt' }, { text: '🗑 Удалить участника', callback_data: 'deletePrompt' }]
          ]
        }
      });
    } else {
      await ctx.reply(WELCOME_MESSAGE, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➡️ Открыть приложение', web_app: { url: `${process.env.HOST_URL}?telegramId=${telegramId}` } }],
            [{ text: '🔵 Официальный канал', url: CHANNEL_URL }]
          ]
        }
      });
    }
  } catch (err) {
    logger.error('Error in /start:', err);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

// Обработка inline-кнопки 'Участвовать'
bot.action('join', async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = ctx.from.id.toString();
  const name = ctx.from.first_name || 'Участник';
  // Вставляем заявку через тот же join
  db.get('SELECT 1 FROM pending WHERE telegramId = ?', [telegramId], (err, row) => {
    if (err) return ctx.reply('Ошибка при проверке заявки.');
    if (row) return ctx.reply('Вы уже подали заявку. Дождитесь подтверждения.');
    db.get('SELECT 1 FROM participants WHERE telegramId = ?', [telegramId], (err2, row2) => {
      if (err2) return ctx.reply('Ошибка при проверке участия.');
      if (row2) return ctx.reply('Вы уже участник розыгрыша.');
      db.run('INSERT INTO pending (name, telegramId) VALUES (?, ?)', [name, telegramId], (err3) => {
        if (err3) return ctx.reply('Ошибка при подаче заявки.');
        bot.telegram.sendMessage(ADMIN_ID,
          `Новая заявка на участие:
Имя: ${name}
Telegram ID: ${telegramId}`,
          { reply_markup: { inline_keyboard: [
            [{ text: '✅ Подтвердить', callback_data: `approve_${name}` },{ text: '❌ Отклонить', callback_data: `reject_${name}` }]
          ] }}
        );
        ctx.reply('Ваша заявка отправлена. Дождитесь подтверждения администратора.');
      });
    });
  });
});

// Команда /help (только для админа)
bot.command('help', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) {
    // Не показываем ошибку обычным пользователям
    return;
  }
  ctx.reply('Доступные команды:\n/start - Начать работу с ботом\n/help - Показать список команд\n/participants - Список участников\n/winners - История победителей\n/prizepool - Текущий призовой фонд\n/approve <имя> - Подтвердить участника\n/reject <имя> - Отклонить участника');
});

// Команда /join - подать заявку на участие
bot.command('join', (ctx) => {
  const telegramId = ctx.from.id.toString();
  const name = ctx.from.first_name || 'Участник';
  // Проверка на дублирование
  db.get('SELECT 1 FROM pending WHERE telegramId = ?', [telegramId], (err, row) => {
    if (err) { ctx.reply('Ошибка при проверке заявки.'); return; }
    if (row) { ctx.reply('Вы уже подали заявку. Дождитесь подтверждения.'); return; }
    db.get('SELECT 1 FROM participants WHERE telegramId = ?', [telegramId], (err2, row2) => {
      if (err2) { ctx.reply('Ошибка при проверке участия.'); return; }
      if (row2) { ctx.reply('Вы уже участник розыгрыша.'); return; }
      // Вставка в pending
      db.run('INSERT INTO pending (name, telegramId) VALUES (?, ?)', [name, telegramId], (err3) => {
        if (err3) { ctx.reply('Ошибка при подаче заявки.'); return; }
        // Уведомление админа
        bot.telegram.sendMessage(ADMIN_ID,
          `Новая заявка на участие:\nИмя: ${name}\nTelegram ID: ${telegramId}`,
          { reply_markup: { inline_keyboard: [
            [{ text: '✅ Подтвердить', callback_data: `approve_${name}` },{ text: '❌ Отклонить', callback_data: `reject_${name}` }]
          ] }}
        );
        ctx.reply('Ваша заявка отправлена. Дождитесь подтверждения администратора.');
      });
    });
  });
});

// Команда /participants (только для админа)
bot.command('participants', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) {
    // Не показываем ошибку обычным пользователям
    return;
  }
  db.all('SELECT name FROM participants', (err, rows) => {
    if (err) {
      ctx.reply('Ошибка получения списка участников.');
      return;
    }
    if (!rows || rows.length === 0) {
      ctx.reply('Список участников пуст.');
      return;
    }
    const list = rows.map(r => r.name).join('\n');
    ctx.reply('Список участников:\n' + list);
  });
});

// Команда /winners (только для админа)
bot.command('winners', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) {
    // Не показываем ошибку обычным пользователям
    return;
  }
  db.all('SELECT name, prize, date FROM winners ORDER BY date DESC LIMIT 10', (err, rows) => {
    if (err) {
      ctx.reply('Ошибка получения истории победителей.');
      return;
    }
    if (!rows || rows.length === 0) {
      ctx.reply('История победителей пуста.');
      return;
    }
    const list = rows.map(r => `${r.name} - ${r.prize}₽ (${r.date})`).join('\n');
    ctx.reply('История победителей:\n' + list);
  });
});

// Команда /prizepool (только для админа)
bot.command('prizepool', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) {
    // Не показываем ошибку обычным пользователям
    return;
  }
  db.get('SELECT amount FROM prize_pool WHERE id = 1', (err, row) => {
    if (err || !row) {
      ctx.reply('Ошибка получения призового фонда.');
      return;
    }
    ctx.reply(`Текущий призовой фонд: ${row.amount}₽`);
  });
});

// Команда /approve (админ)
bot.command('approve', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) {
    // Не показываем ошибку обычным пользователям
    return;
  }

  const name = ctx.message.text.split(' ')[1];
  if (!name) {
    ctx.reply('Укажите имя участника: /approve <имя>');
    return;
  }

  db.get('SELECT telegramId FROM pending WHERE name = ?', [name], (err, row) => {
    if (err) {
      ctx.reply('Ошибка проверки участника.');
      logger.error('Ошибка approve:', err);
      return;
    }
    if (!row) {
      ctx.reply('Участник не найден в списке ожидающих.');
      return;
    }

    db.run(
      'INSERT INTO participants (name, telegramId) VALUES (?, ?)',
      [name, row.telegramId],
      (err) => {
        if (err) {
          ctx.reply('Ошибка добавления участника.');
          logger.error('Ошибка approve insert:', err);
          return;
        }

        db.run('DELETE FROM pending WHERE name = ?', [name], (err) => {
          if (err) {
            logger.error('Ошибка удаления из pending:', err);
          }
        });

        db.run('UPDATE prize_pool SET amount = amount + 100 WHERE id = 1', (err) => {
          if (err) {
            logger.error('Ошибка обновления призового фонда:', err);
          }
        });

        ctx.reply(`Участник ${name} подтверждён!`);
      }
    );
  });
});

// Команда /reject (админ)
bot.command('reject', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) {
    // Не показываем ошибку обычным пользователям
    return;
  }

  const name = ctx.message.text.split(' ')[1];
  if (!name) {
    ctx.reply('Укажите имя участника: /reject <имя>');
    return;
  }

  db.get('SELECT telegramId FROM pending WHERE name = ?', [name], (err, row) => {
    if (err) {
      ctx.reply('Ошибка проверки участника.');
      logger.error('Ошибка reject:', err);
      return;
    }
    if (!row) {
      ctx.reply('Участник не найден в списке ожидающих.');
      return;
    }

    db.run('DELETE FROM pending WHERE name = ?', [name], (err) => {
      if (err) {
        ctx.reply('Ошибка отклонения участника.');
        logger.error('Ошибка reject delete:', err);
        return;
      }
      ctx.reply(`Участник ${name} отклонён.`);
    });
  });
});

// Обработка inline-кнопок подтверждения/отклонения участника
bot.action(/approve_(.+)/, (ctx) => {
  const name = ctx.match[1];
  if (ctx.from.id.toString() !== ADMIN_ID) return ctx.answerCbQuery('Доступ запрещён');
  db.get('SELECT telegramId FROM pending WHERE name = ?', [name], (err, row) => {
    if (err) return ctx.answerCbQuery('Ошибка БД');
    if (!row) return ctx.answerCbQuery('Участник не найден');
    db.run('INSERT INTO participants (name, telegramId) VALUES (?, ?)', [name, row.telegramId], (err) => {
      if (err) return ctx.answerCbQuery('Ошибка добавления');
      db.run('DELETE FROM pending WHERE name = ?', [name]);
      db.run('UPDATE prize_pool SET amount = amount + 100 WHERE id = 1');
      ctx.editMessageReplyMarkup(); // убираем кнопки
      ctx.reply(`Участник ${name} подтверждён!`);
      ctx.answerCbQuery();
    });
  });
});

bot.action(/reject_(.+)/, (ctx) => {
  const name = ctx.match[1];
  if (ctx.from.id.toString() !== ADMIN_ID) return ctx.answerCbQuery('Доступ запрещён');
  db.run('DELETE FROM pending WHERE name = ?', [name], (err) => {
    if (err) return ctx.answerCbQuery('Ошибка отклонения');
    ctx.editMessageReplyMarkup();
    ctx.reply(`Участник ${name} отклонён.`);
    ctx.answerCbQuery();
  });
});

// Тестовый спин для определения победителя (только для админа)
bot.command('spin', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  ctx.reply('🎡 Крутим колесо...').then(() => {
    db.all('SELECT name, telegramId FROM participants', (err, rows) => {
      if (err) { ctx.reply('Ошибка БД при выборке участников.'); return; }
      if (!rows || rows.length === 0) { ctx.reply('Нет участников для спина.'); return; }
      const winner = rows[Math.floor(Math.random() * rows.length)];
      const prize = Math.floor(Math.random() * 1000) + 100;
      const timestamp = Date.now();
      db.run(
        'INSERT INTO winners (name, telegramId, prize, timestamp) VALUES (?, ?, ?, ?)',
        [winner.name, winner.telegramId, prize, timestamp],
        (err) => { if (err) logger.error('Ошибка вставки победителя:', err); }
      );
      ctx.reply(`🎊 Победитель: ${winner.name}! Приз: ${prize}₽`);
    });
  });
});

// Команда сброса всех данных (только для админа)
bot.command('reset', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  db.serialize(() => {
    db.run('DELETE FROM participants');
    db.run('DELETE FROM pending');
    db.run('DELETE FROM winners');
    db.run('UPDATE prize_pool SET amount = 0 WHERE id = 1');
  });
  ctx.reply('Данные очищены: участники, ожидающие, победители удалены, призовой фонд сброшен.');
});

// Команда удаления участника (только для админа)
bot.command('delete', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) return ctx.reply('Укажите имя: /delete <имя>');
  const name = parts.slice(1).join(' ');
  db.serialize(() => {
    db.run('DELETE FROM participants WHERE name = ?', [name]);
    db.run('DELETE FROM pending WHERE name = ?', [name]);
  });
  ctx.reply(`Участник ${name} удалён.`);
});

// Callback actions for inline buttons
bot.action('getParticipants', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  ctx.answerCbQuery();
  db.all('SELECT name FROM participants', (err, rows) => {
    if (err) return ctx.reply('Ошибка');
    const list = rows.map(r => r.name).join('\n') || 'Пусто';
    ctx.reply(`Список участников:\n${list}`);
  });
});

bot.action('getWinners', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  ctx.answerCbQuery();
  db.all('SELECT name, prize FROM winners', (err, rows) => {
    if (err) return ctx.reply('Ошибка');
    const list = rows.map(r => `${r.name} — ${r.prize}₽`).join('\n') || 'Пусто';
    ctx.reply(`История победителей:\n${list}`);
  });
});

bot.action('getPrizePool', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  ctx.answerCbQuery();
  db.get('SELECT amount FROM prize_pool WHERE id = 1', (err, row) => {
    if (err) return ctx.reply('Ошибка');
    ctx.reply(`Текущий призовой фонд: ${row.amount}₽`);
  });
});

bot.action('reset', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  ctx.answerCbQuery();
  db.serialize(() => {
    db.run('DELETE FROM participants');
    db.run('DELETE FROM pending');
    db.run('DELETE FROM winners');
    db.run('UPDATE prize_pool SET amount = 0 WHERE id = 1');
  });
  ctx.reply('Данные очищены.');
});

bot.action('spin', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  ctx.answerCbQuery();
  ctx.reply('🎡 Крутим колесо...').then(() => {
    db.all('SELECT name, telegramId FROM participants', (err, rows) => {
      const winner = rows[Math.floor(Math.random() * rows.length)];
      const prize = Math.floor(Math.random() * 1000);
      db.run('INSERT INTO winners (name, telegramId, prize, timestamp) VALUES (?, ?, ?, ?)', [winner.name, winner.telegramId, prize, Date.now()]);
      ctx.reply(`Победитель: ${winner.name}, приз: ${prize}₽`);
    });
  });
});

bot.action('deletePrompt', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  ctx.answerCbQuery();
  ctx.reply('Введите имя участника для удаления: /delete <имя>');
});

bot.action('timerPrompt', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  ctx.answerCbQuery();
  ctx.reply('Введите время автоспина в формате HH:MM: /settimer HH:MM');
});

// Команда установки таймера автоспина (только для админа)
let scheduledSpin;
bot.command('settimer', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) return ctx.reply('Укажите время: /settimer HH:MM');
  const [hh, mm] = parts[1].split(':').map(Number);
  if (isNaN(hh) || isNaN(mm) || hh<0 || hh>23 || mm<0 || mm>59) return ctx.reply('Неверный формат времени');
  // Очистить предыдущий таймер
  if (scheduledSpin) clearTimeout(scheduledSpin);
  const now = new Date();
  let target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  if (target <= now) target.setDate(target.getDate()+1);
  const diff = target - now;
  ctx.reply(`Таймер установлен на ${parts[1]}. Спин: ${target.toLocaleString()}`);
  scheduledSpin = setTimeout(() => {
    const chatId = ctx.chat.id;
    bot.telegram.sendMessage(chatId, '🎡 Автоспин: вращаем колесо...');
    db.all('SELECT name, telegramId FROM participants', (err, rows) => {
      if (err || !rows.length) {
        return bot.telegram.sendMessage(chatId, 'Нет участников для спина.');
      }
      const winner = rows[Math.floor(Math.random() * rows.length)];
      const prize = Math.floor(Math.random() * 1000) + 100;
      const timestamp = Date.now();
      db.run(
        'INSERT INTO winners (name, telegramId, prize, timestamp) VALUES (?, ?, ?, ?)',
        [winner.name, winner.telegramId, prize, timestamp],
        (err) => { if (err) logger.error('Ошибка вставки победителя:', err); }
      );
      bot.telegram.sendMessage(chatId, `Победитель: ${winner.name}, приз: ${prize}₽`);
    });
  }, diff);
});

// Функция для часового автоспина
function scheduleHourlySpin() {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0, 0);
  next.setHours(now.getHours() + 1);
  const diff = next - now;
  scheduledSpin = setTimeout(async () => {
    const chatId = ADMIN_ID; // отправляем в админ-чат
    bot.telegram.sendMessage(chatId, '🎡 Часовой автоспин: вращаем колесо...');
    db.all('SELECT name, telegramId FROM participants', (err, rows) => {
      if (err || !rows.length) {
        return bot.telegram.sendMessage(chatId, 'Нет участников для спина.');
      }
      const winner = rows[Math.floor(Math.random() * rows.length)];
      const prize = Math.floor(Math.random() * 1000);
      db.run('INSERT INTO winners (name, telegramId, prize, timestamp) VALUES (?, ?, ?, ?)', [winner.name, winner.telegramId, prize, Date.now()]);
      bot.telegram.sendMessage(chatId, `Победитель: ${winner.name}, приз: ${prize}₽`);
    });
    scheduleHourlySpin();
  }, diff);
  logger.info(`Часовой автоспин запланирован на ${next.toLocaleString()}`);
}

// Express API
const app = express();

// Serve static front-end files
app.use(express.static(require('path').join(__dirname, '..')));

// Enable CORS
app.use(cors());
// Parse JSON bodies
app.use(bodyParser.json());

// Webhook endpoint: raw parsing to capture updates and log them
if (process.env.HOST_URL) {
  const hookPath = process.env.WEBHOOK_PATH || '/bot';
  app.post(
    hookPath,
    bodyParser.json(), async (req, res) => {
      try {
        const update = req.body;
        logger.info(`Webhook update received: ${JSON.stringify(update)}`);
        await bot.handleUpdate(update);
        return res.sendStatus(200);
      } catch (err) {
        logger.error('Webhook error:', err);
        return res.status(400).send('Invalid update');
      }
    }
  );
}

app.use(express.json());
app.use(cors());

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'index.html'));
});

// Подключение маршрутов
app.use('/participants', participantsRoute);
app.use('/pending', pendingRoute);
app.use('/winners', winnersRoute);
app.use('/prizepool', prizepoolRoute);
app.use('/spin', spinRoute);
app.use('/timer', timerRoute);

// Запуск сервера и глобальный обработчик ошибок Express
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server listening on ${PORT}`));
app.use((err, req, res, next) => {
  logger.error('Unhandled Express error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Запуск бота: polling локально, webhook в продакшн
bot.catch((err, ctx) => logger.error(`Bot error: ${ctx.updateType}`, err));
const HOST_URL = process.env.HOST_URL;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/bot';
logger.info(`HOST_URL=${HOST_URL}, WEBHOOK_PATH=${WEBHOOK_PATH}`);
if (HOST_URL) {
  // Production Webhook
  (async () => {
    try {
      // Очищаем старые обновления
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      logger.info('Предыдущий webhook удалён, pending updates сброшены');
      await bot.telegram.setWebhook(`${HOST_URL}${WEBHOOK_PATH}`);
      logger.info(`Webhook установлен: ${HOST_URL}${WEBHOOK_PATH}`);
      const webhookInfo = await bot.telegram.getWebhookInfo();
      logger.info(`Webhook info: ${JSON.stringify(webhookInfo)}`);
    } catch (err) {
      logger.error('Ошибка установки webhook:', err);
    }
  })();
} else {
  // Local polling
  bot.launch()
    .then(() => logger.info('Telegram bot started (polling)'))
    .catch(err => logger.error('Bot launch error:', err));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
  // Запускаем часовой автоспин
  scheduleHourlySpin();
}

// Закрытие базы
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      logger.error('Ошибка закрытия базы:', err);
    }
    logger.info('База закрыта');
    process.exit();
  });
});