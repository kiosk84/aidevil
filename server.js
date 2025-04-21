const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

// API routes
const participantsRoute = require('./functions/routes/participants');
const pendingRoute = require('./functions/routes/pending');
const winnersRoute = require('./functions/routes/winners');
const prizepoolRoute = require('./functions/routes/prizepool');
const spinRoute = require('./functions/routes/spin');
const timerRoute = require('./functions/routes/timer');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
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

// Start server on port 8080
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
