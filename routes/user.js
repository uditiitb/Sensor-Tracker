const express = require('express');
const router = express.Router();
const SensorMeta = require('../models/SensorMetadata');

// User Dashboard
router.get('/', async (req, res) => {
    const sensorsMeta = await SensorMeta.find();
    res.render('user/dashboard', { sensorsMeta });
});

module.exports = router;
