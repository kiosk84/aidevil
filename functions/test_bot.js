require('dotenv').config();
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);
const HOST_URL = process.env.HOST_URL;

bot.start(async (ctx) => {
  console.log('Test bot received /start from', ctx.from.id);
  await ctx.reply('👋 Добро пожаловать!', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➡️ Открыть приложение', url: HOST_URL }]
      ]
    }
  });
});

bot.launch()
  .then(() => console.log('Test bot launched (polling)'))
  .catch(err => console.error('Test bot launch error:', err));
