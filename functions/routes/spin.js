const express = require('express');
const runLottery = require('../services/lottery');
const { ADMIN_ID, bot } = require('../bot');
const router = express.Router();

// POST /spin
router.post('/', (req, res) => {
  const { adminId } = req.body;
  if (adminId !== ADMIN_ID) return res.status(403).json({ error: 'Access denied' });

  runLottery()
    .then((winner) => {
      if (winner) res.json({ success: true, winner });
      else res.json({ success: false, message: 'No participants' });
    })
    .catch((err) => res.status(500).json({ error: 'Lottery error' }));
});

module.exports = router;
