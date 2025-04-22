const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();
// Configuration
dotenv.config(); // loads root .env (PORT=8080, FRONTEND_URL)
console.log('DEBUG: Server PORT=', process.env.PORT || 'undefined', 'FRONTEND_URL=', process.env.FRONTEND_URL);
const express = require('express');

// API routes
const participantsRoute = require('./functions/routes/participants');
const pendingRoute = require('./functions/routes/pending');
const winnersRoute = require('./functions/routes/winners');
const prizepoolRoute = require('./functions/routes/prizepool');
const spinRoute = require('./functions/routes/spin');
const timerRoute = require('./functions/routes/timer');

const app = express();
// Log all incoming HTTP requests
app.use((req, res, next) => { console.log(`REQ ${req.method} ${req.url} from ${req.ip}`); next(); });
// CORS: support comma-separated FRONTEND_URL or '*' for all
const raw = process.env.FRONTEND_URL || '*';
const allowed = raw.split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow non-browser or postman
    if (allowed.includes('*') || allowed.includes(origin)) cb(null, true);
    else cb(new Error(`CORS blocked: ${origin}`));
  }
}));
app.use(express.json());

// Mount API endpoints
app.use('/participants', participantsRoute);
app.use('/pending', pendingRoute);
app.use('/winners', winnersRoute);
app.use('/prizepool', prizepoolRoute);
app.use('/spin', spinRoute);
app.use('/timer', timerRoute);

// Serve frontend static files and fallback to index.html for SPA
app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// launch Telegram bot and handlers
// Load bot configuration, register handlers, then instantiate
require('./functions/index'); // loads BOT_TOKEN and registers bot commands
const { bot } = require('./functions/bot');
bot.launch();

// Start server on port 8080
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running at http://0.0.0.0:${PORT}`));
