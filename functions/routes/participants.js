const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /participants
router.get('/', (req, res) => {
  db.all('SELECT name FROM participants', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows.map(r => r.name));
  });
});

module.exports = router;
