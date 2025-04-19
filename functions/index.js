const { Telegraf } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const cors = require('cors'); // Добавили cors

// Инициализация SQLite
const db = new sqlite3.Database('./fortune.db', (err) => {
  if (err) {
    console.error('Ошибка подключения к SQLite:', err);
  } else {
    console.log('Подключено к SQLite');
  }
});

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

// Инициализация бота
const bot = new Telegraf('8123757486:AAGgoxj37dpIF4EVdJVoAfxNUqQTYCFWxmA');

// ID админа (замени на свой Telegram ID)
const ADMIN_ID = '192363865';

// Обработка команды /start (только для админа)
bot.command('start', (ctx) => {
  if (ctx.from.id.toString() === ADMIN_ID) {
    ctx.reply('Добро пожаловать, админ!\nДоступные команды:\n/start - Начать работу с ботом\n/help - Показать список команд\n/participants - Список участников\n/winners - История победителей\n/prizepool - Текущий призовой фонд\n/approve <имя> - Подтвердить участника\n/reject <имя> - Отклонить участника');
  } else {
    ctx.reply('Добро пожаловать в бота Колесо Фортуны! Здесь вы сможете участвовать в ежедневных розыгрышах. Следи за новостями — подпишись на наш официальный канал!', {
      reply_markup: {
        inline_keyboard: [
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
      console.error('Ошибка approve:', err);
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
          console.error('Ошибка approve insert:', err);
          return;
        }

        db.run('DELETE FROM pending WHERE name = ?', [name], (err) => {
          if (err) {
            console.error('Ошибка удаления из pending:', err);
          }
        });

        db.run('UPDATE prize_pool SET amount = amount + 100 WHERE id = 1', (err) => {
          if (err) {
            console.error('Ошибка обновления призового фонда:', err);
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
      console.error('Ошибка reject:', err);
      return;
    }
    if (!row) {
      ctx.reply('Участник не найден в списке ожидающих.');
      return;
    }

    db.run('DELETE FROM pending WHERE name = ?', [name], (err) => {
      if (err) {
        ctx.reply('Ошибка отклонения участника.');
        console.error('Ошибка reject delete:', err);
        return;
      }
      ctx.reply(`Участник ${name} отклонён.`);
    });
  });
});

// Функция розыгрыша
function runLottery() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM participants', [], (err, participants) => {
      if (err) {
        console.error('Ошибка получения участников:', err);
        reject('Database error');
        return;
      }
      if (!participants || participants.length === 0) {
        console.log('Нет участников для розыгрыша.');
        bot.telegram.sendMessage(ADMIN_ID, 'Розыгрыш не состоялся: нет участников.');
        resolve(null);
        return;
      }

      const winner = participants[Math.floor(Math.random() * participants.length)];
      const prizePool = participants.length * 100;

      db.run(
        'INSERT INTO winners (name, telegramId, prize, timestamp) VALUES (?, ?, ?, ?)',
        [winner.name, winner.telegramId, prizePool, Date.now()],
        (err) => {
          if (err) {
            console.error('Ошибка записи победителя:', err);
            bot.telegram.sendMessage(ADMIN_ID, 'Ошибка записи победителя.');
            reject('Database error');
            return;
          }

          // Рассылаем сообщения всем участникам
          participants.forEach((participant) => {
            if (participant.telegramId === winner.telegramId) {
              // Победителю — поздравление
              bot.telegram.sendMessage(
                participant.telegramId,
                `🎉 Поздравляем, ${participant.name}! 🎉\n\nВы выиграли в розыгрыше Колеса Фортуны и получаете приз: ${prizePool} ₽!\n\nСвяжитесь с администратором для получения выигрыша.\n\nСпасибо за участие!`
              );
            } else {
              // Остальным — уведомление
              bot.telegram.sendMessage(
                participant.telegramId,
                `Розыгрыш завершён!\n\nПобедитель: ${winner.name}\nПриз: ${prizePool} ₽\n\nСпасибо за участие и удачи в следующий раз!`
              );
            }
          });

          bot.telegram.sendMessage(
            ADMIN_ID,
            `Розыгрыш завершён!\nПобедитель: ${winner.name}\nПриз: ${prizePool} ₽\nСвяжитесь с победителем для передачи приза.`
          );

          db.run('DELETE FROM participants', [], (err) => {
            if (err) console.error('Ошибка очистки участников:', err);
          });
          db.run('UPDATE prize_pool SET amount = 0 WHERE id = 1', (err) => {
            if (err) console.error('Ошибка сброса призового фонда:', err);
          });

          console.log('Розыгрыш завершён. Победитель:', winner.name);
          resolve(winner.name);
        }
      );
    });
  });
}

// Автоматический розыгрыш в 20:00
setInterval(() => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  if (hours === 20 && minutes === 0 && seconds === 0) {
    runLottery();
  }
}, 1000);

// Команда /spin (админ)
bot.command('spin', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) {
    // Не показываем ошибку обычным пользователям
    return;
  }
  runLottery().then(() => {
    ctx.reply('Розыгрыш запущен!');
  }).catch((error) => {
    ctx.reply('Ошибка при запуске розыгрыша.');
  });
});

// Запуск бота
bot.launch().then(() => {
  console.log('Бот запущен с long polling');
});

// Express API
const app = express();
app.use(express.json());
app.use(cors()); // Добавили поддержку CORS

// Получить участников
app.get('/participants', (req, res) => {
  db.all('SELECT name FROM participants', (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
    } else {
      res.json(rows.map(row => row.name));
    }
  });
});

// Получить ожидающих
app.get('/pending', (req, res) => {
  db.all('SELECT name FROM pending', (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
    } else {
      res.json(rows.map(row => row.name));
    }
  });
});

// Получить победителей
app.get('/winners', (req, res) => {
  db.all('SELECT name, prize, timestamp FROM winners ORDER BY timestamp DESC LIMIT 5', (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
    } else {
      res.json(rows.map(row => ({
        name: row.name,
        prize: row.prize,
        date: new Date(row.timestamp).toLocaleDateString('ru-RU')
      })));
    }
  });
});

// Получить призовой фонд
app.get('/prizepool', (req, res) => {
  db.get('SELECT amount FROM prize_pool WHERE id = 1', (err, row) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
    } else {
      res.json({ amount: row.amount });
    }
  });
});

// POST /pending - добавить участника в pending
app.post('/pending', (req, res) => {
  const { name, telegramId } = req.body;
  if (!name || !telegramId) {
    return res.status(400).json({ error: 'Name and telegramId required' });
  }
  db.get('SELECT * FROM pending WHERE name = ?', [name], (err, row) => {
    if (row) {
      return res.status(409).json({ error: 'Участник уже ожидает подтверждения' });
    }
    db.get('SELECT * FROM participants WHERE name = ?', [name], (err, row) => {
      if (row) {
        return res.status(409).json({ error: 'Участник уже зарегистрирован' });
      }
      db.run('INSERT INTO pending (name, telegramId) VALUES (?, ?)', [name, telegramId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Ошибка при добавлении заявки' });
        }
        // Уведомить админа через Telegram с инлайн-кнопками
        bot.telegram.sendMessage(
          ADMIN_ID,
          `Новый участник ожидает подтверждения:\nИмя: ${name}\nTelegram ID: ${telegramId}`,
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

// Обработка нажатий на инлайн-кнопки только для админа
bot.on('callback_query', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) {
    ctx.answerCbQuery('Недостаточно прав');
    return;
  }
  const data = ctx.callbackQuery.data;
  if (data.startsWith('approve_')) {
    const name = data.replace('approve_', '');
    // Повторяем логику /approve
    db.get('SELECT telegramId FROM pending WHERE name = ?', [name], (err, row) => {
      if (err || !row) {
        ctx.answerCbQuery('Ошибка или участник не найден');
        return;
      }
      db.run('INSERT INTO participants (name, telegramId) VALUES (?, ?)', [name, row.telegramId], (err) => {
        if (err) {
          ctx.answerCbQuery('Ошибка при добавлении');
          return;
        }
        db.run('DELETE FROM pending WHERE name = ?', [name]);
        db.run('UPDATE prize_pool SET amount = amount + 100 WHERE id = 1');
        ctx.editMessageText(`✅ Участник ${name} подтверждён и добавлен!`);
        ctx.answerCbQuery('Участник подтверждён!');
      });
    });
  } else if (data.startsWith('reject_')) {
    const name = data.replace('reject_', '');
    db.run('DELETE FROM pending WHERE name = ?', [name], (err) => {
      if (err) {
        ctx.answerCbQuery('Ошибка при отклонении');
        return;
      }
      ctx.editMessageText(`❌ Участник ${name} отклонён.`);
      ctx.answerCbQuery('Участник отклонён!');
    });
  }
});

// Удалить участника
app.delete('/participants/:name', (req, res) => {
  const name = req.params.name;
  db.get('SELECT name FROM participants WHERE name = ?', [name], (err, row) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Participant not found' });
      return;
    }
    db.run('DELETE FROM participants WHERE name = ?', [name], (err) => {
      if (err) {
        res.status(500).json({ error: 'Database error' });
        return;
      }
      db.run('UPDATE prize_pool SET amount = amount - 100 WHERE id = 1', (err) => {
        if (err) {
          res.status(500).json({ error: 'Database error' });
          return;
        }
        res.json({ success: true });
      });
    });
  });
});

// Запустить розыгрыш (для админа через фронтенд)
app.post('/spin', (req, res) => {
  const { adminId } = req.body;
  if (adminId !== ADMIN_ID) {
    return res.status(403).json({ error: 'Access denied' });
  }
  runLottery().then((winner) => {
    if (winner) {
      res.json({ success: true, winner });
    } else {
      res.json({ success: false, message: 'No participants' });
    }
  }).catch((error) => {
    res.status(500).json({ error: 'Database error' });
  });
});

// Запуск сервера
app.listen(3000, () => {
  console.log('API запущен на http://localhost:3000');
});

// Закрытие базы
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Ошибка закрытия базы:', err);
    }
    console.log('База закрыта');
    process.exit();
  });
});