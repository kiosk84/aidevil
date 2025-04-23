const express = require('express');
const router = express.Router();

// Время автоспина в формате HH:MM
let scheduledTime = '20:00';

// GET /timer - Calculate and return seconds remaining
router.get('/', (req, res) => {
  try {
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const now = new Date();

    let nextSpin = new Date();
    nextSpin.setHours(hours, minutes, 0, 0); // Set target time for today

    // If target time has already passed today, set it for tomorrow
    if (now.getTime() > nextSpin.getTime()) {
      nextSpin.setDate(nextSpin.getDate() + 1);
    }

    const secondsRemaining = Math.max(0, Math.floor((nextSpin.getTime() - now.getTime()) / 1000));

    res.json({ secondsRemaining: secondsRemaining });
  } catch (error) {
    console.error("Error calculating timer:", error);
    res.status(500).json({ secondsRemaining: 0, error: "Failed to calculate timer" });
  }
});

// POST /timer
router.post('/', (req, res) => {
  const { time } = req.body;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return res.status(400).json({ error: 'Invalid time format' });
  scheduledTime = time;
  console.log(`Scheduled spin time updated to: ${scheduledTime}`);
  res.json({ success: true, time: scheduledTime });
});

module.exports = router;
