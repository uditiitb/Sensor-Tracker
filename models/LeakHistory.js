const mongoose = require('mongoose');

const LeakSchema = new mongoose.Schema({
    sensorId: { 
        type: String, 
        required: true, 
    },
    type: { 
        type: String, 
        required: true 
    },
    time: { 
        type: String, // Use Date for timestamps
        required: true 
    },
    distanceshistory: {
        type: [String], // Simple array of numbers
        required: true
    }
},{
    capped: { size: 1024 }, // Capped collection with specified size in bytes
    collection: 'leakhistories'
});

module.exports = mongoose.model('LeakHistory', LeakSchema);
