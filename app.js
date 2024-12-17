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
const plotly = require('plotly')('username', 'apiKey'); // Configure your Plotly credentials.
const { JSDOM } = require('jsdom');
const { createCanvas } = require('canvas');
const chokidar = require('chokidar');

const DATA_FILE = path.join(__dirname, 'A.txt');
const PLOTS_DIR = path.join(__dirname, 'plots');
const MAX_POINTS = 50; // Number of points before saving plots

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

// Function to call the Python script
function processLinesWithPython(lines) {
    console.log('lim',lines)
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', ['./processing&detection.py', lines]);
        let result = '';

        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python Error: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve(result.trim());
            } else {
                reject(new Error(`Python script exited with code ${code}`));
            }
        });
    });
}


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

// Watch the `data.txt` file for changes
// const filePath = './data.txt';
// let fileSize = 0;

// fs.watch(filePath, async (eventType) => {
//     if (eventType === 'change') {
//         console.log(`Detected change in ${filePath}`);

//         // Get the current file size
//         const stats = fs.statSync(filePath);
//         const newFileSize = stats.size;

//         if (newFileSize > fileSize) {
//             // Read only the appended portion
//             const stream = fs.createReadStream(filePath, {
//                 start: fileSize,
//                 end: newFileSize - 1,
//                 encoding: 'utf8',
//             });

//             let newData = '';
//             stream.on('data', (chunk) => {
//                 newData += chunk;
//             });

//             stream.on('end', async () => {
//                 fileSize = newFileSize; // Update the tracked file size

//                 try {
//                     // Parse the newly appended JSON object
//                     const jsonObject1 = JSON.parse(newData.trim());

//                     // Perform decryption on `jsonObj1.Data` and create `jsonObj2`
//                     const decryptedData = await decrypt(jsonObject1.Dev_Address, jsonObject1.Data);

//                     const jsonObject = {
//                         ...jsonObject1, // Spread the properties of jsonObj1
//                         Data: decryptedData, // Replace `Data` with the decrypted value
//                     };

//                     console.log(jsonObject.Data); // Processed array of objects

//                     const { Dev_Address } = jsonObject;
//                     if (!Dev_Address) {
//                         console.error('Invalid JSON object: Missing `Dev_Address` field');
//                         return;
//                     }

//                     // File specific to `Dev_Address`
//                     const devFilePath = `.temp/${Dev_Address}.txt`;

//                     // Append decrypted data to the file
//                     fs.appendFileSync(devFilePath, JSON.stringify(jsonObject) + '\n');

//                     // With the following code:
//                     const formattedData = jsonObject.Data
//                         .replace(/[()]/g, '')  // Remove round brackets
//                         .replace(/,\s*/g, ' ') // Replace commas with a single space
//                         .trim();               // Trim any extra whitespace

//                     fs.appendFileSync(devFilePath, formattedData + '\n');

//                     // fs.appendFileSync(devFilePath, JSON.stringify(jsonObject) + '\n');

//                     // Check the number of lines in the file
//                     const fileLines = fs.readFileSync(devFilePath, 'utf8').trim().split('\n');
//                     if (fileLines.length > 100) {
//                         // Extract the first 50 lines
//                         const first50Lines = fileLines.slice(0, 50);
//                         const remainingLines = fileLines.slice(50);

//                         // Pass the first 50 lines to the Python function
//                         const result = await processLinesWithPython(first50Lines);

//                         console.log(`Python function result: ${result}`);

//                         // Overwrite the file with the remaining lines
//                         fs.writeFileSync(devFilePath, remainingLines.join('\n'));
//                     }
//                 } catch (err) {
//                     console.error('Error processing JSON:', err);
//                 }
//             });
//         }
//     }
// });

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
                    const jsonObject1 = JSON.parse(newData.trim());

                    // Perform decryption on `jsonObj1.Data` and create `jsonObj2`
                    const decryptedData = await decrypt(jsonObject1.Dev_Address, jsonObject1.Data);

                    const jsonObject = {
                        ...jsonObject1,         // Spread the properties of jsonObj1
                        Data: decryptedData, // Replace `Data` with the decrypted value
                    };

                    // console.log(jsonObject.Data); // Processed array of objects

                    // const jsonObject = await Promise.all(
                    //     jsonObject1.map(async (obj) => {
                    //         const decryptedData = await decrypt(obj.Dev_Address,obj.Data); // Await the decryption result
                    //         console.log(decryptedData)
                    //         return {
                    //         ...obj, // Spread the other properties
                    //         Data: decryptedData, // Set the resolved value of Data
                    //         };
                    //     })
                    //     );
                    const { Dev_Address } = jsonObject;

                    if (!Dev_Address) {
                        console.error('Invalid JSON object: Missing `Dev_Address` field');
                        return;
                    }

                    // Define the file path
                    const devFilePath = path.join('./temp', `${Dev_Address}.txt`);

                    // Ensure the directory exists
                    const dirPath = path.dirname(devFilePath);
                    if (!fs.existsSync(dirPath)) {
                        fs.mkdirSync(dirPath, { recursive: true });
                    }

                    // Check if the file exists; if not, create it
                    if (!fs.existsSync(devFilePath)) {
                        fs.writeFileSync(devFilePath, '', 'utf8'); // Create an empty file
                        console.log(`File created: ${devFilePath}`);
                    } else {
                        console.log(`File already exists: ${devFilePath}`);
                    }

                    // File specific to `Dev_Address`
                    // const devFilePath = `./temp/${Dev_Address}.txt`;

                    // Append decrypted data to the file
                    // fs.appendFileSync(devFilePath, JSON.stringify(jsonObject) + '\n');

                    // With the following code:
                    const formattedData = jsonObject.Data
                        .replace(/[()]/g, '')  // Remove round brackets
                        .replace(/,\s*/g, ' ') // Replace commas with a single space
                        .trim();               // Trim any extra whitespace

                    fs.appendFileSync(devFilePath, formattedData + '\n');

                    // fs.appendFileSync(devFilePath, JSON.stringify(jsonObject) + '\n');

                    // Check the number of lines in the file
                    const fileLines = fs.readFileSync(devFilePath, 'utf8').trim().split('\n');
                    let result = 0
                    if (fileLines.length > 100) {
                        // Extract the first 50 lines
                        const first100Lines = fileLines.slice(0, 100);
                        const remainingLines = fileLines.slice(50);

                        // console.log(first50Lines)

                        // Combine the first 50 lines into a single string
                        const first100LinesString = first100Lines.join('\n');
                        // console.log(first50LinesString)
                        // Pass the first 50 lines as a string to the Python function
                        result = await processLinesWithPython(first100LinesString);


                        console.log(`Python function result: ${result}`,'\n');

                        // Overwrite the file with the remaining lines
                        fs.writeFileSync(devFilePath, remainingLines.join('\n')+'\n');
                    }

                    if(result==0){
                        console.log("New data is too large");
                        io.emit('Threshold1',jsonObject.Dev_Address); //green
                    }
                    else if(result==1) {
                        io.emit('Threshold',jsonObject.Dev_Address); //red
                    }

                    // Use `Dev_Address` to determine the collection name
                    const collectionName = `sensor_${Dev_Address}`;
                    const DynamicModel = getModel(collectionName);

                    // Save the new object as a document in the collection
                    const newDocument = await DynamicModel.create(jsonObject);

                    // console.log(`New document added to collection: ${collectionName}`);
                    // console.log('Document:', newDocument);
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
// app.use(express.static(path.join(__dirname, 'public')));
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

// Add window size for standard deviation
// Default window size
let WINDOW_SIZE = 10;

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('Frontend connected');

  // Listen for window size updates from the frontend
  socket.on('updateWindowSize', (newWindowSize) => {
    if (Number.isInteger(newWindowSize) && newWindowSize > 0) {
      WINDOW_SIZE = newWindowSize;
      console.log(`Updated WINDOW_SIZE to: ${WINDOW_SIZE}`);
      socket.emit('windowSizeUpdated', { success: true, windowSize: WINDOW_SIZE });
    } else {
      socket.emit('windowSizeUpdated', { success: false, error: 'Invalid window size' });
    }
  });
});
// const WINDOW_SIZE = 10;

// Store standard deviation data
let xStdDev = [];
let yStdDev = [];
let zStdDev = [];

// Function to calculate standard deviation
function calculateStdDev(data) {
  const n = data.length;
  if (n === 0) return 0;
  const mean = data.reduce((sum, val) => sum + val, 0) / n;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  return Math.sqrt(variance);
}

// // Watch File for Updates
// chokidar.watch(DATA_FILE).on('change', () => {
//   const fileData = fs.readFileSync(DATA_FILE, 'utf8');
//   const lines = fileData.trim().split('\n');
//   lines.forEach((line) => {
//     const [x, y, z] = line.split(' ').map(Number);
//     xData.push(x);
//     yData.push(y);
//     zData.push(z);

//     // Maintain sliding window for standard deviation
//     if (xData.length >= WINDOW_SIZE) {
//       xStdDev.push(calculateStdDev(xData.slice(-WINDOW_SIZE)));
//       yStdDev.push(calculateStdDev(yData.slice(-WINDOW_SIZE)));
//       zStdDev.push(calculateStdDev(zData.slice(-WINDOW_SIZE)));

//       // Emit standard deviation data to frontend
//       io.emit('stdDevUpdate', {
//         xStdDev,
//         yStdDev,
//         zStdDev,
//       });
//     }

//     // Emit live data to frontend
//     io.emit('dataUpdate', { x, y, z });
//   });

//   if (xData.length >= MAX_POINTS) {
//     // Save standard deviation plots
//     savePlot(xStdDev, 'X-StdDev');
//     savePlot(yStdDev, 'Y-StdDev');
//     savePlot(zStdDev, 'Z-StdDev');

//     // Reset Data Arrays
//     xData = [];
//     yData = [];
//     zData = [];
//     xStdDev = [];
//     yStdDev = [];
//     zStdDev = [];
//   }
// });
// Global Variables
let xData = [];
let yData = [];
let zData = [];

// Helper Function: Save Plot
async function savePlot(data, axisName) {
  const timeStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(PLOTS_DIR, `${axisName}-${timeStamp}.png`);

  const dom = new JSDOM(`<body></body>`);
  global.document = dom.window.document;

  const canvas = createCanvas(800, 600);
  const ctx = canvas.getContext('2d');

  // Create the Plot using Plotly
  const layout = {
    title: `${axisName} vs Points`,
    xaxis: { title: 'Data Points' },
    yaxis: { title: axisName },
  };

  const trace = {
    x: Array.from({ length: data.length }, (_, i) => i + 1),
    y: data,
    type: 'scatter',
  };

  await plotly.plot([trace], layout, { format: 'png' }).then((imageStream) => {
    imageStream.pipe(fs.createWriteStream(filename));
  });

  return filename;
}

// Watch File for Updates
chokidar.watch(DATA_FILE).on('change', () => {
    const fileData = fs.readFileSync(DATA_FILE, 'utf8');
    const lines = fileData.trim().split('\n');
    const remainingLines = [];
  
    lines.forEach((line, index) => {
      const [x, y, z] = line.split(' ').map(Number);
      xData.push(x);
      yData.push(y);
      zData.push(z);
  
      // Maintain sliding window for standard deviation
      if (xData.length >= WINDOW_SIZE) {
        xStdDev.push(calculateStdDev(xData.slice(-WINDOW_SIZE)));
        yStdDev.push(calculateStdDev(yData.slice(-WINDOW_SIZE)));
        zStdDev.push(calculateStdDev(zData.slice(-WINDOW_SIZE)));
  
        // Emit standard deviation data to frontend
        io.emit('stdDevUpdate', {
          xStdDev,
          yStdDev,
          zStdDev,
        });
      }
  
      // Emit live data to frontend
      io.emit('dataUpdate', { x, y, z });
  
      // Add this line to remaining lines if we haven't reached the limit
      if (xData.length < MAX_POINTS) {
        remainingLines.push(line);
      }
    });
  
    if (xData.length >= MAX_POINTS) {
      // Save standard deviation plots
      savePlot(xStdDev, 'X-StdDev');
      savePlot(yStdDev, 'Y-StdDev');
      savePlot(zStdDev, 'Z-StdDev');
  
      // Reset Data Arrays
      xData = [];
      yData = [];
      zData = [];
      xStdDev = [];
      yStdDev = [];
      zStdDev = [];
  
      // Rewrite file with remaining data
      fs.writeFileSync(DATA_FILE, remainingLines.join('\n'));
    }
  });

// // Watch File for Updates
// chokidar.watch(DATA_FILE).on('change', () => {
//   const fileData = fs.readFileSync(DATA_FILE, 'utf8');
//   const lines = fileData.trim().split('\n');
//   lines.forEach((line) => {
//     const [x, y, z] = line.split(' ').map(Number);
//     xData.push(x);
//     yData.push(y);
//     zData.push(z);

//     // Emit Data to Frontend
//     io.emit('dataUpdate', { x, y, z });
//   });

//   if (xData.length >= MAX_POINTS) {
//     // Save Plots
//     savePlot(xData, 'X');
//     savePlot(yData, 'Y');
//     savePlot(zData, 'Z');

//     // Reset Data Arrays
//     xData = [];
//     yData = [];
//     zData = [];
//   }
// });

// Route: Serve Main Page
app.get('/plot', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create Plots Directory if Not Exists
if (!fs.existsSync(PLOTS_DIR)) {
  fs.mkdirSync(PLOTS_DIR);
}


//*********************************************************************** */

app.get('/check',(req,res)=>{
    io.emit('do','ami udit');
    return res.end();
})


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
            // const recentData1 = await Promise.all(
            //     recentData.map(async (obj) => {
            //         const decryptedData = await decrypt(obj.Dev_Address,obj.Data); // Await the decryption result
            //         console.log(decryptedData)
            //         return {
            //         ...obj, // Spread the other properties
            //         Data: decryptedData, // Set the resolved value of Data
            //         };
            //     })
            //     );
            // console.log(recentData1)
            socket.emit('realTimeData', { Dev_Address, data_sensor: recentData });
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
const PORT = 3000;
http.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
