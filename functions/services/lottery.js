const db = require('../db');
const { bot, ADMIN_ID } = require('../bot');

function runLottery() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM participants', [], (err, participants) => {
      if (err) return reject(err);
      if (!participants || participants.length === 0) {
        return resolve(null);
      }

      const winner = participants[Math.floor(Math.random() * participants.length)];
      const prizePool = participants.length * 100;

      db.run(
        'INSERT INTO winners (name, telegramId, prize, timestamp) VALUES (?, ?, ?, ?)',
        [winner.name, winner.telegramId, prizePool, Date.now()],
        (err) => {
          if (err) return reject(err);

          // Notify only the winner
          bot.telegram.sendMessage(winner.telegramId, `🎉 Поздравляем, ${winner.name}! Вы выиграли ${prizePool} ₽!`);

          bot.telegram.sendMessage(
            ADMIN_ID,
            `Розыгрыш завершён! Победитель: ${winner.name}. Приз: ${prizePool} ₽.`
          );

          db.run('DELETE FROM participants', []);
          db.run('UPDATE prize_pool SET amount = 0 WHERE id = 1');

          resolve(winner.name);
        }
      );
    });
  });
}

module.exports = runLottery;
