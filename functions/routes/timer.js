const express = require('express');
const router = express.Router();

// Время автоспина в формате HH:MM
let scheduledTime = '20:00';

// GET /timer
router.get('/', (req, res) => {
  res.json({ time: scheduledTime });
});

// POST /timer
router.post('/', (req, res) => {
  const { time } = req.body;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return res.status(400).json({ error: 'Invalid time format' });
  scheduledTime = time;
  res.json({ success: true, time: scheduledTime });
});

module.exports = router;
