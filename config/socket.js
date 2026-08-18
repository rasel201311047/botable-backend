const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../modules/user/user.model');
const logger = require('../utils/logger');

let io;

/**
 * Initialize Socket.IO
 */
const init = (server) => {
  io = socketIO(server, {
    origin: "*",
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (!user.isActive) {
        return next(new Error('Authentication error: Account deactivated'));
      }

      socket.user = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role
      };

      next();
    } catch (error) {
      logger.error(`Socket.IO authentication error: ${error.message}`);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}, User: ${socket.user.email}`);

    // Join user's private room
    socket.join(`user:${socket.user.id}`);

    // Join admin room if user is admin
    if (socket.user.role === 'admin') {
      socket.join('admin');
    }

    // Handle real-time events
    socket.on('join_room', (room) => {
      socket.join(room);
      logger.info(`User ${socket.user.email} joined room: ${room}`);
    });

    socket.on('leave_room', (room) => {
      socket.leave(room);
      logger.info(`User ${socket.user.email} left room: ${room}`);
    });

    socket.on('user_activity', (data) => {
      // Broadcast user activity to admin room
      socket.to('admin').emit('user_activity_update', {
        userId: socket.user.id,
        activity: data.activity,
        timestamp: new Date()
      });
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}, User: ${socket.user.email}`);
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${socket.user.email}: ${error.message}`);
    });
  });

  logger.info('Socket.IO initialized');
  return io;
};

/**
 * Get Socket.IO instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

/**
 * Emit event to specific user
 */
const emitToUser = (userId, event, data) => {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit(event, data);
    logger.debug(`Emitted ${event} to user ${userId}`);
  } catch (error) {
    logger.error(`Emit to user error: ${error.message}`);
  }
};

/**
 * Emit event to admin room
 */
const emitToAdmin = (event, data) => {
  try {
    const io = getIO();
    io.to('admin').emit(event, data);
    logger.debug(`Emitted ${event} to admin room`);
  } catch (error) {
    logger.error(`Emit to admin error: ${error.message}`);
  }
};

/**
 * Emit event to all connected clients
 */
const emitToAll = (event, data) => {
  try {
    const io = getIO();
    io.emit(event, data);
    logger.debug(`Emitted ${event} to all clients`);
  } catch (error) {
    logger.error(`Emit to all error: ${error.message}`);
  }
};

/**
 * Send real-time notification to user
 */
const sendNotification = (userId, notification) => {
  emitToUser(userId, 'notification', {
    ...notification,
    timestamp: new Date(),
    read: false
  });
};

/**
 * Send real-time reminder to user
 */
const sendReminder = (userId, reminder) => {
  emitToUser(userId, 'reminder', {
    ...reminder,
    timestamp: new Date()
  });
};

/**
 * Broadcast system announcement
 */
const broadcastAnnouncement = (announcement) => {
  emitToAll('announcement', {
    ...announcement,
    timestamp: new Date()
  });
};

module.exports = {
  init,
  getIO,
  emitToUser,
  emitToAdmin,
  emitToAll,
  sendNotification,
  sendReminder,
  broadcastAnnouncement
};