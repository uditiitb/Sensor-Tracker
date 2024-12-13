// const { app, BrowserWindow } = require('electron');
// const path = require('path');

// // Start your Node.js server
// const { fork } = require('child_process');
// const server = fork(path.join(__dirname, 'app.js'));

// let mainWindow;

// app.on('ready', () => {
//     mainWindow = new BrowserWindow({
//         width: 800,
//         height: 600,
//         webPreferences: {
//             nodeIntegration: false, // For security reasons
//             contextIsolation: true,
//             enableRemoteModule: false,
//         },
//     });

//     mainWindow.loadURL('http://localhost:3000/user'); // Load the server's URL
//     mainWindow.loadURL('http://localhost:3000/admin'); // Load the server's URL

//     mainWindow.on('closed', () => {
//         mainWindow = null;
//     });
// });

// app.on('window-all-closed', () => {
//     if (process.platform !== 'darwin') {
//         app.quit();
//     }
// });

// app.on('will-quit', () => {
//     server.kill(); // Stop the Node.js server when the app is closed
// });



// const { app, BrowserWindow, dialog } = require('electron');
// const path = require('path');

// // Start your Node.js server
// const { fork } = require('child_process');
// const server = fork(path.join(__dirname, 'app.js'));

// let mainWindow;

// // Function to prompt user for choice
// const askForPageChoice = () => {
//     const options = {
//         type: 'question',
//         buttons: ['User Dashboard', 'Admin Dashboard', 'Cancel'],
//         title: 'Select a Page',
//         message: 'Which page would you like to open?',
//     };

//     dialog.showMessageBox(null, options).then(result => {
//         if (result.response === 0) {
//             mainWindow.loadURL('http://localhost:3000/user');
//         } else if (result.response === 1) {
//             mainWindow.loadURL('http://localhost:3000/admin');
//         } else {
//             app.quit(); // Close the app if canceled
//         }
//     });
// };

// // When the app is ready
// app.on('ready', () => {
//     mainWindow = new BrowserWindow({
//         width: 800,
//         height: 600,
//         webPreferences: {
//             nodeIntegration: false,
//             contextIsolation: true,
//             enableRemoteModule: false,
//         },
//     });

//     askForPageChoice(); // Show the dialog to choose a page

//     mainWindow.on('closed', () => {
//         mainWindow = null;
//     });
// });

// app.on('window-all-closed', () => {
//     if (process.platform !== 'darwin') {
//         app.quit();
//     }
// });

// app.on('will-quit', () => {
//     server.kill(); // Stop the Node.js server when the app is closed
// });

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

// Start your Node.js server
const { fork } = require('child_process');
const server = fork(path.join(__dirname, 'app.js'));

let mainWindow;

// Function to prompt user for choice
const askForPageChoice = () => {
  const options = {
    type: 'question',
    buttons: ['User Dashboard', 'Admin Dashboard', 'Cancel'],
    title: 'Select a Page',
    message: 'Which page would you like to open?',
  };

  dialog.showMessageBox(null, options).then((result) => {
    if (result.response === 0) {
      mainWindow.loadURL('http://localhost:3000/user');
    } else if (result.response === 1) {
      mainWindow.loadURL('http://localhost:3000/admin');
    } else {
      app.quit(); // Close the app if canceled
    }
  });
};

// When the app is ready
app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  askForPageChoice(); // Show the dialog to choose a page

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  server.kill(); // Stop the Node.js server when the app is closed
});
