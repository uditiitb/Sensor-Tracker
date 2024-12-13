const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const bodyParser = require('body-parser');
// const mongoose = require('./db'); // MongoDB connection
const NodeCache = require('node-cache');
const SensorMeta = require('./models/SensorMetadata')
const sensor = require('./models/sensor')
const fs = require('fs');
const mongoose = require('mongoose');
const { spawn } = require('child_process');

// MongoDB connection
const MONGO_URI = 'mongodb://localhost:27017/sensorDB';
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connected successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

const db = mongoose.connection;


// Cache for storing real-time data
// const realTimeCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
const userRoutes = require('./routes/user');
// const adminRoutes = require('./routes/admin');

const createSchema = () => new mongoose.Schema({}, { strict: false }); // Schema for dynamic collections

const getModel = (collectionName) => {
    if (mongoose.models[collectionName]) {
        return mongoose.models[collectionName];
    }
    return mongoose.model(collectionName, createSchema(), collectionName);
};

// Watch the `data.txt` file for changes
const filePath = './data.txt';
let fileSize = 0;

fs.watch(filePath, async (eventType) => {
    if (eventType === 'change') {
        console.log(`Detected change in ${filePath}`);

        // Get the current file size
        const stats = fs.statSync(filePath);
        const newFileSize = stats.size;

        if (newFileSize > fileSize) {
            // Read only the appended portion
            const stream = fs.createReadStream(filePath, {
                start: fileSize,
                end: newFileSize - 1,
                encoding: 'utf8',
            });

            let newData = '';
            stream.on('data', (chunk) => {
                newData += chunk;
            });

            stream.on('end', async () => {
                fileSize = newFileSize; // Update the tracked file size

                try {
                    // Parse the newly appended JSON object
                    const jsonObject = JSON.parse(newData.trim());
                    const { Dev_Address } = jsonObject;

                    if (!Dev_Address) {
                        console.error('Invalid JSON object: Missing `Dev_Address` field');
                        return;
                    }

                    if(jsonObject.Fcnt > 83){
                        console.log("New data is too large");
                        io.emit('Threshold',jsonObject.Dev_Address);
                    }
                    else if(jsonObject.Fcnt <= 83) {
                        io.emit('Threshold1',jsonObject.Dev_Address);
                    }

                    // Use `Dev_Address` to determine the collection name
                    const collectionName = `sensor_${Dev_Address}`;
                    const DynamicModel = getModel(collectionName);

                    // Save the new object as a document in the collection
                    const newDocument = await DynamicModel.create(jsonObject);

                    console.log(`New document added to collection: ${collectionName}`);
                    console.log('Document:', newDocument);
                } catch (err) {
                    console.error('Error processing JSON:', err);
                }
            });
        }
    }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'views')));
app.set('view engine', 'ejs');

// Routes
app.use('/user', userRoutes);
// app.use('/admin', adminRoutes);

//*********************************************************************** */
app.get('/admin', async (req, res) => {
    const sensors = await SensorMeta.find();
    res.render('admin/dashboard', { sensors });
});

// Add Sensor Route
app.post('/admin/add', async (req, res) => {
    console.log(req.body);
    const { sensorId, type, lat, lng } = req.body;
    const sensorMeta = new SensorMeta({ sensorId, type, location: { lat, lng } });

    try {
        // Save sensor metadata to the 'SensorMeta' collection
        await sensorMeta.save();
        console.log(`New sensor added: ${sensorMeta.sensorId}`);

        // Create the collection with a specific name dynamically
        const collectionName = `sensor_${sensorId}`;
        
        // Access the MongoDB native driver and create the collection
        const db = mongoose.connection.db;

        // Check if the collection already exists
        const collections = await db.listCollections({ name: collectionName }).toArray();
        
        if (collections.length === 0) {
            // Create collection if it doesn't exist
            await db.createCollection(collectionName);
            console.log(`Collection ${collectionName} created.`);
        }

        // Now insert initial data into the collection
        const sensorCollection = db.collection(collectionName);
        await sensorCollection.insertOne({
            Dev_Address:"260B5630",
            Fcnt:0,
            Time:"0000-00-00 00:00:00",
            SF:0,
            Data:"",
            Freq:"0",
            RSSI:0,
            SNR:0,
            BW:0,
            Port:0
        });

        // Emit the new sensor to all connected clients
        io.emit('sensorUpdated', sensorMeta);
        
        res.redirect('/admin');
    } catch (err) {
        console.error('Error adding sensor:', err);
        res.status(500).send('Server Error');
    }
});
// app.post('/admin/add', async (req, res) => {
//     console.log(req.body)
//     const { sensorId, lat, lng } = req.body;
//     const sensorMeta = new SensorMeta({ sensorId, location: { lat, lng } });

//     try {
//         await sensorMeta.save();
//         console.log(`New sensor added: ${sensorMeta.sensorId}`);

//         // Emit the new sensor to all connected clients
//         // const io = req.app.get('io');
//         // await io.emit('sensorUpdated', { action: 'add', sensorMeta });
//         io.emit('sensorUpdated', sensorMeta);
        
//         res.redirect('/admin');
//     } catch (err) {
//         console.error('Error adding sensor:', err);
//         res.status(500).send('Server Error');
//     }
// });

// Update Sensor Route
app.post('/admin/update/:id', async (req, res) => {
    const { type ,lat, lng } = req.body;
    
    try {
        const sensorMeta = await SensorMeta.findByIdAndUpdate(req.params.id, {
            type: type,
            location: { lat, lng },
        }, { new: true });
        
        
        // Emit the updated sensor to all connected clients
        // const io = req.app.get('io');
        // io.emit('sensorUpdated', { action: 'update', sensorMeta });
        io.emit('sensorUpdated', sensorMeta);
        
        res.redirect('/admin');
    } catch (err) {
        console.error('Error updating sensor:', err);
        res.status(500).send('Server Error');
    }
});

// Delete Sensor Route
app.post('/admin/delete/:id', async (req, res) => {
    try {
        // Find and delete the sensor from SensorMeta collection
        const deletedSensor = await SensorMeta.findByIdAndDelete(req.params.id);
        
        if (deletedSensor) {
            console.log(`Sensor deleted: ${deletedSensor.sensorId}`);
            
            // Emit the deleted sensor to all connected clients
            io.emit('sensorDelete', deletedSensor);

            // Now delete the collection associated with this sensor
            const collectionName = `sensor_${deletedSensor.sensorId}`;

            // Access the MongoDB native driver and delete the collection
            const db = mongoose.connection.db;

            try {
                await db.collection(collectionName).drop();
                console.log(`Collection ${collectionName} deleted.`);
            } catch (err) {
                console.error(`Error deleting collection ${collectionName}:`, err);
            }

            res.redirect('/admin');
        } else {
            res.status(404).send('Sensor not found');
        }
    } catch (err) {
        console.error('Error deleting sensor:', err);
        res.status(500).send('Server Error');
    }
});

app.post('/admin/hardreset/', async (req, res) => {
    io.emit('hardDeleted');
    try {
        console.log('Hard Reset received');

        // Access the MongoDB native driver
        const db = mongoose.connection.db;

        // Fetch all collections with the prefix 'sensor_'
        const collections = await db.listCollections({}).toArray();
        const sensorCollections = collections.filter(c => c.name.startsWith('sensor_'));

        // Drop each collection with the prefix 'sensor_'
        for (const collection of sensorCollections) {
            try {
                await db.collection(collection.name).drop();
                console.log(`Collection ${collection.name} deleted.`);
            } catch (err) {
                console.error(`Error deleting collection ${collection.name}:`, err);
            }
        }

        // Clear all documents in the `SensorMeta` collection
        await SensorMeta.deleteMany({});
        console.log('All documents in SensorMeta collection deleted.');

        // Notify all connected clients about the reset
        io.emit('HardResetComplete', 'All sensor data and metadata have been cleared.');
        res.redirect('/admin');

    } catch (err) {
        console.error('Error handling HardReset:', err);
        io.emit('HardResetError', 'An error occurred while performing the reset.');
    }

})

app.post('/admin/softreset/:id', async (req, res) => {
    const { id } = req.params; // Extract the ID from the route parameters
    const collectionName = `sensor_${id}`; // Dynamically generate the collection name

    try {
        // Access the dynamically named collection
        const collection = db.collection(collectionName);

        // Delete all documents in the collection
        const result = await collection.deleteMany({});

        if (result.deletedCount > 0) {
            console.log(`Successfully deleted ${result.deletedCount} documents from ${collectionName}`);
            res.redirect('/admin');
        } else {
            console.log(`No documents found in ${collectionName}`);
            res.redirect('/admin');
        }
    } catch (error) {
        console.error(`Error deleting documents from collection '${collectionName}':`, error);
        res.status(500).send('An error occurred while attempting to delete documents.');
    }
});




// app.post('/admin/delete/:id', async (req, res) => {
//     try {
//         const deletedSensor = await SensorMeta.findByIdAndDelete(req.params.id);
        
//         if (deletedSensor) {
//             console.log(`Sensor deleted: ${deletedSensor.sensorId}`);
            
//             // Emit the deleted sensor to all connected clients
//             // const io = req.app.get('io');
//             // io.emit('sensorUpdated', { action: 'delete', sensorId: deletedSensor.sensorId });
//             io.emit('sensorDelete', deletedSensor);

//             res.redirect('/admin');
//         } else {
//             res.status(404).send('Sensor not found');
//         }
//     } catch (err) {
//         console.error('Error deleting sensor:', err);
//         res.status(500).send('Server Error');
//     }
// });

//******************************************************************** */

app.get('/check',(req,res)=>{
    io.emit('do','ami udit');
    return res.end();
})


// Function to call the Python script
function decrypt(arg1,arg2) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', ['./process_messages.py', arg1,arg2]);

        let output = '';  // Variable to accumulate the output

        // Collect data from Python script's stdout
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        // Handle any errors from the Python script
        pythonProcess.stderr.on('data', (data) => {
            reject(`Python error: ${data.toString()}`);
        });

        // When the Python script finishes
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve(output.trim());  // Resolve the Promise with the output (trim any extra whitespace)
            } else {
                reject(`Python script exited with code ${code}`);
            }
        });
    });
}


// Real-time data socket
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('getSensorData', async (Dev_Address) => {
        try {
            // Dynamically determine the collection name
            const collectionName = `sensor_${Dev_Address}`;
            
            // Fetch the collection
            const collection = db.collection(collectionName);
    
            // Query the 1000 most recent documents from the collection
            const recentData = await collection
                .find({})
                .sort({ Time: -1 }) // Sort by the `Time` field in descending order
                .limit(1000) // Limit to 1000 documents
                .toArray(); // Convert the cursor to an array
    
            if (!recentData || recentData.length === 0) {
                console.log(`No data found for ${collectionName}`);
                socket.emit('realTimeData', { Dev_Address, data_sensor: [] });
                return;
            }
            
            console.log(`Fetched ${recentData.length} records for ${collectionName}`);
            
            // Emit the real-time data
            // console.log('recent data',recentData)
            const recentData1 = await Promise.all(
                recentData.map(async (obj) => {
                    const decryptedData = await decrypt(obj.Dev_Address,obj.Data); // Await the decryption result
                    console.log(decryptedData)
                    return {
                    ...obj, // Spread the other properties
                    Data: decryptedData, // Set the resolved value of Data
                    };
                })
                );
            console.log(recentData1)
            socket.emit('realTimeData', { Dev_Address, data_sensor: recentData1 });
        } catch (err) {
            console.error('Error in getSensorData handler:', err);
            socket.emit('realTimeData', { Dev_Address, data_sensor: [] });
        }
    });

    // socket.on('HardReset', async () => {
    //     io.emit('hardDeleted');
    //     try {
    //         console.log('Hard Reset received');
    
    //         // Access the MongoDB native driver
    //         const db = mongoose.connection.db;
    
    //         // Fetch all collections with the prefix 'sensor_'
    //         const collections = await db.listCollections({}).toArray();
    //         const sensorCollections = collections.filter(c => c.name.startsWith('sensor_'));
    
    //         // Drop each collection with the prefix 'sensor_'
    //         for (const collection of sensorCollections) {
    //             try {
    //                 await db.collection(collection.name).drop();
    //                 console.log(`Collection ${collection.name} deleted.`);
    //             } catch (err) {
    //                 console.error(`Error deleting collection ${collection.name}:`, err);
    //             }
    //         }
    
    //         // Clear all documents in the `SensorMeta` collection
    //         await SensorMeta.deleteMany({});
    //         console.log('All documents in SensorMeta collection deleted.');
    
    //         // Notify all connected clients about the reset
    //         io.emit('HardResetComplete', 'All sensor data and metadata have been cleared.');
    
    //     } catch (err) {
    //         console.error('Error handling HardReset:', err);
    //         io.emit('HardResetError', 'An error occurred while performing the reset.');
    //     }
    // });
    
    
    // socket.on('getSensorData', (Dev_Address) => {
    //     try {
    //         // Dynamically determine the collection name
    //         const collectionName = `sensor_${Dev_Address}`;
    
    //         // Fetch the collection
    //         const collection = db.collection(collectionName);
    
    //         // Query the latest data from the collection based on the time property
    //         collection.findOne({}, { sort: { Time: -1 } }, (err, latestData) => {
    //             if (err) {
    //                 console.error('Error querying MongoDB:', err);
    //                 socket.emit('realTimeData', { Dev_Address, data_sensor: null });
    //                 return;
    //             }

    //             if (!latestData) {
    //                 console.log(`No data found for ${collectionName}`);
    //                 socket.emit('realTimeData', { Dev_Address, data_sensor: null });
    //                 return;
    //             }

    //             // Add a new timestamp to the latest data for the response
    //             // latestData.time = new Date().toISOString();
    //             console.log(1,latestData);

    //             // Emit the real-time data
    //             socket.emit('realTimeData', { Dev_Address, data_sensor: latestData });
    //         });
    //                 } catch (err) {
    //                     console.error('Error in getSensorData handler:', err);
    //         socket.emit('realTimeData', { Dev_Address, data_sensor: null });
    //     }
    // });
    //*********************************** */
    // socket.on('getSensorData', (sensorId) => {
    // // Simulate fetching live data
    //     // const realTimeData = realTimeCache.get(sensorId) || Math.random() * 100;
    //     fetch('https://jsonplaceholder.typicode.com/todos/1')
    //         .then(res => res.json())
    //         .then(json => {
    //             const j = [
    //                 {
    //                     "id": 1,
    //                     "title": "delectus aut autem",
    //                     "completed": false,
    //                     "temp": 20
    //                 },
    //                 {
    //                     "id": 2,
    //                     "title": "quis ut nam facilis et officia qui",
    //                     "completed": false,
    //                     "humid": 30
    //                 }
    //             ];
    //             console.log(sensorId)
    //             const data_sensor = j.find(item => item.id == sensorId) || null;
    //             const currentTime = new Date().toISOString(); 
    //             data_sensor.time = currentTime;
    //             // data_sensor.unshift({"time": currentTime});
                
    //             // const data_sensor = Object.values(j).find(item => item.id === sensorId) || null;
    //             console.log(data_sensor)
    //             socket.emit('realTimeData', { sensorId, data_sensor});
    //         })
    //         .catch(err => {
    //             console.error('Error fetching real-time data:', err);
    //             socket.emit('realTimeData', { sensorId, data_sensor: null});
    //         });
    // });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});


// Start server
const PORT = 3001;
http.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
