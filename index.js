const app = require('./app');
const http = require('http');
const JobManager = require('./jobs');
const socketService = require('./config/socket');

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
socketService.init(server);

// Initialize background jobs
if (process.env.NODE_ENV !== 'test') {
  JobManager.init();
}

// const PORT = process.env.PORT || 5000;

// const HOST = '10.10.20.17'; 

// server.listen(PORT, HOST, () => {
//   console.log(`Server running at http://${HOST}:${PORT}`);
//   console.log(`Environment: ${process.env.NODE_ENV}`);
//   console.log(`Socket.IO initialized and ready`);
// });




const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Socket.IO initialized and ready`);
});