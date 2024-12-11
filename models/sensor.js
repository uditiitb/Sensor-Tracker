const mongoose = require('mongoose');

const SensorSchema = new mongoose.Schema({
    sensorId: { type: String, required: true, unique: true },
    data: { type: Object, required: true },
});

module.exports = mongoose.model('Sensor', SensorSchema);
