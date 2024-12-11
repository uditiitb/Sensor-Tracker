const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('./db'); // MongoDB connection
const NodeCache = require('node-cache');
const SensorMeta = require('./models/SensorMetadata')

// Cache for storing real-time data
// const realTimeCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
const userRoutes = require('./routes/user');
// const adminRoutes = require('./routes/admin');

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
    console.log(req.body)
    const { sensorId, lat, lng } = req.body;
    const sensorMeta = new SensorMeta({ sensorId, location: { lat, lng } });

    try {
        await sensorMeta.save();
        console.log(`New sensor added: ${sensorMeta.sensorId}`);

        // Emit the new sensor to all connected clients
        // const io = req.app.get('io');
        // await io.emit('sensorUpdated', { action: 'add', sensorMeta });
        io.emit('sensorUpdated', sensorMeta);
        
        res.redirect('/admin');
    } catch (err) {
        console.error('Error adding sensor:', err);
        res.status(500).send('Server Error');
    }
});

// Update Sensor Route
app.post('/admin/update/:id', async (req, res) => {
    const { lat, lng } = req.body;
    
    try {
        const sensorMeta = await SensorMeta.findByIdAndUpdate(req.params.id, {
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
        const deletedSensor = await SensorMeta.findByIdAndDelete(req.params.id);
        
        if (deletedSensor) {
            console.log(`Sensor deleted: ${deletedSensor.sensorId}`);
            
            // Emit the deleted sensor to all connected clients
            // const io = req.app.get('io');
            // io.emit('sensorUpdated', { action: 'delete', sensorId: deletedSensor.sensorId });
            io.emit('sensorDelete', deletedSensor);

            res.redirect('/admin');
        } else {
            res.status(404).send('Sensor not found');
        }
    } catch (err) {
        console.error('Error deleting sensor:', err);
        res.status(500).send('Server Error');
    }
});

//******************************************************************** */

app.get('/check',(req,res)=>{
    io.emit('do','ami udit');
    return res.end();
})


// Real-time data socket
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('getSensorData', (sensorId) => {
        // Simulate fetching live data
        // const realTimeData = realTimeCache.get(sensorId) || Math.random() * 100;
        fetch('https://jsonplaceholder.typicode.com/todos/1')
            .then(res => res.json())
            .then(json => {
                const j = [
                    {
                        "id": 1,
                        "title": "delectus aut autem",
                        "completed": false,
                        "temp": 20
                    },
                    {
                        "id": 2,
                        "title": "quis ut nam facilis et officia qui",
                        "completed": false,
                        "humid": 30
                    }
                ];
                console.log(sensorId)
                const data_sensor = j.find(item => item.id == sensorId) || null;
                const currentTime = new Date().toISOString(); 
                data_sensor.time = currentTime;
                // data_sensor.unshift({"time": currentTime});
                
                // const data_sensor = Object.values(j).find(item => item.id === sensorId) || null;
                console.log(data_sensor)
                socket.emit('realTimeData', { sensorId, data_sensor});
            })
            .catch(err => {
                console.error('Error fetching real-time data:', err);
                socket.emit('realTimeData', { sensorId, data_sensor: null});
            });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});


// Start server
const PORT = 3000;
http.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
