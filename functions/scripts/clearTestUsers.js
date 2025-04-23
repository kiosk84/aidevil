// Скрипт для очистки тестовых пользователей из pending и participants
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/fortune.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Ошибка подключения к БД:', err);
  else console.log('Подключено к БД:', dbPath);
});

const testIds = ['test_user1', 'test_user2', 'test_user3'];

db.serialize(() => {
  for (const tid of testIds) {
    db.run('DELETE FROM pending WHERE telegramId = ?', [tid], (err) => {
      if (err) console.error('Ошибка удаления из pending:', err);
    });
    db.run('DELETE FROM participants WHERE telegramId = ?', [tid], (err) => {
      if (err) console.error('Ошибка удаления из participants:', err);
    });
  }
});

db.close(() => {
  console.log('Очистка завершена.');
});
