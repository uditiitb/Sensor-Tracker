const mongoose = require('mongoose');

const SensorSchema = new mongoose.Schema({
    sensorId: { type: String, required: true, unique: true },
    data: { type: Object, required: true },
    distanceshistory: {
        type: [
            [Number, Number, Number, Date] // Array of arrays with x, y, z, time
        ],
        required: true
    }
});

module.exports = mongoose.model('Sensor', SensorSchema);
