require('dotenv').config();
const db = require('./db');
const { bot, ADMIN_ID } = require('./bot');
const express = require('express');
const cors = require('cors');
const logger = require('./logger');
const path = require('path');
// Route handlers
const participantsRoute = require('./routes/participants');
const pendingRoute = require('./routes/pending');
const winnersRoute = require('./routes/winners');
const prizepoolRoute = require('./routes/prizepool');
const spinRoute = require('./routes/spin');

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

// Обработка команды /start (только для админа)
bot.command('start', (ctx) => {
  if (ctx.from.id.toString() === ADMIN_ID) {
    ctx.reply('Добро пожаловать, админ!\nДоступные команды:\n/start - Начать работу с ботом\n/help - Показать список команд\n/participants - Список участников\n/winners - История победителей\n/prizepool - Текущий призовой фонд\n/approve <имя> - Подтвердить участника\n/reject <имя> - Отклонить участника');
  } else {
    ctx.reply('Добро пожаловать! Это бот, в котором ты можешь выиграть крупную сумму денег. Открой приложение и участвуй — твой Telegram ID будет зарегистрирован автоматически!', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Открыть приложение', web_app: { url: 'https://aidevil-production.up.railway.app' } }
          ],
          [
            { text: '🔵 Официальный канал', url: 'https://t.me/channel_fortune' }
          ]
        ]
      }
    });
  }
});

// Команда /help (только для админа)
bot.command('help', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) {
    // Не показываем ошибку обычным пользователям
    return;
  }
  ctx.reply('Доступные команды:\n/start - Начать работу с ботом\n/help - Показать список команд\n/participants - Список участников\n/winners - История победителей\n/prizepool - Текущий призовой фонд\n/approve <имя> - Подтвердить участника\n/reject <имя> - Отклонить участника');
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

// Express API
const app = express();
app.use(express.json());
app.use(cors());

// Серверим статическую папку с фронтендом
app.use(express.static(path.join(__dirname, '..')));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Подключение маршрутов
app.use('/participants', participantsRoute);
app.use('/pending', pendingRoute);
app.use('/winners', winnersRoute);
app.use('/prizepool', prizepoolRoute);
app.use('/spin', spinRoute);

// Запуск бота: polling локально, webhook в продакшн
bot.catch((err, ctx) => logger.error(`Bot error: ${ctx.updateType}`, err));
const HOST_URL = process.env.HOST_URL;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/bot';
if (HOST_URL) {
  // Production Webhook
  (async () => {
    try {
      await bot.telegram.setWebhook(`${HOST_URL}${WEBHOOK_PATH}`);
      logger.info(`Webhook установлен: ${HOST_URL}${WEBHOOK_PATH}`);
    } catch (err) {
      logger.error('Ошибка установки webhook:', err);
    }
  })();
  app.use(WEBHOOK_PATH, bot.webhookCallback(WEBHOOK_PATH));
} else {
  // Local polling
  bot.launch()
    .then(() => logger.info('Telegram bot started (polling)'))
    .catch(err => logger.error('Bot launch error:', err));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`API запущен на http://localhost:${PORT}`));

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

// Глобальный обработчик ошибок Express
app.use((err, req, res, next) => {
  logger.error('Unhandled Express error', err);
  res.status(500).json({ error: 'Internal server error' });
});