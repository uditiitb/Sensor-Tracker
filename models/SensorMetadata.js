const mongoose = require('mongoose');

const SensorMetadataSchema = new mongoose.Schema({
    sensorId: { type: String, required: true, unique: true },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
    },
});

module.exports = mongoose.model('SensorMetadata', SensorMetadataSchema);
