const multer = require('multer');
const cloudinary = require('./cloudinary');
const path = require('path');
const logger = require('../utils/logger');
const { Readable } = require('stream');

// Use memory storage for multer (stores files in memory as Buffer)
const storage = multer.memoryStorage();
const workoutStorage = multer.memoryStorage();

// File filter for images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif)'));
  }
};

// File filter for workout files (images and videos)
const workoutFileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif/;
  const allowedVideoTypes = /mp4|avi|mov|wmv|flv|mkv|webm/;
  
  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;
  
  const isImage = allowedImageTypes.test(extname.replace('.', '')) && mimetype.startsWith('image/');
  const isVideo = allowedVideoTypes.test(extname.replace('.', '')) && mimetype.startsWith('video/');
  
  if (isImage || isVideo) {
    return cb(null, true);
  } else {
    cb(new Error('Only image (jpeg, jpg, png, gif) and video (mp4, avi, mov, wmv, flv, mkv, webm) files are allowed'));
  }
};

// Configure multer for profile photos
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Configure multer for workout files
const workoutUpload = multer({
  storage: workoutStorage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for workout files (images + videos)
  },
  fileFilter: workoutFileFilter
});

/**
 * Upload buffer to Cloudinary
 */
const uploadToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          logger.error(`Cloudinary upload error: ${error.message}`);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    // Convert buffer to stream and pipe to cloudinary
    const bufferStream = Readable.from(fileBuffer);
    bufferStream.pipe(uploadStream);
  });
};

/**
 * Upload profile photo to Cloudinary
 */
const uploadProfilePhotoToCloudinary = async (file, userId) => {
  try {
    const result = await uploadToCloudinary(file.buffer, {
      folder: 'bootble-fitness/profile-photos',
      public_id: `profile-${userId}-${Date.now()}`,
      transformation: [{ width: 500, height: 500, crop: 'limit' }],
      resource_type: 'image'
    });
    return result.secure_url;
  } catch (error) {
    logger.error(`Upload profile photo error: ${error.message}`);
    throw error;
  }
};

/**
 * Upload workout file (image or video) to Cloudinary
 */
const uploadWorkoutFileToCloudinary = async (file) => {
  try {
    const isVideo = file.mimetype.startsWith('video/');
    const result = await uploadToCloudinary(file.buffer, {
      folder: 'bootble-fitness/workouts',
      public_id: `workout-${Date.now()}`,
      resource_type: isVideo ? 'video' : 'image',
      transformation: isVideo ? undefined : [{ width: 1200, height: 1200, crop: 'limit' }]
    });
    return result.secure_url;
  } catch (error) {
    logger.error(`Upload workout file error: ${error.message}`);
    throw error;
  }
};

/**
 * Handle single file upload
 */
const uploadSingle = (fieldName) => {
  return upload.single(fieldName);
};

/**
 * Handle workout image upload
 */
const uploadWorkoutImage = () => {
  return workoutUpload;
};

/**
 * Handle multiple file upload
 */
const uploadMultiple = (fieldName, maxCount = 5) => {
  return upload.array(fieldName, maxCount);
};

/**
 * Delete file from Cloudinary
 */
const deleteFile = async (fileUrl) => {
  try {
    if (!fileUrl) return true;
    
    // Extract public_id from Cloudinary URL
    const urlParts = fileUrl.split('/');
    const fileNameWithExt = urlParts[urlParts.length - 1];
    const fileName = fileNameWithExt.split('.')[0];
    const folder = urlParts.slice(-3, -1).join('/');
    const publicId = `${folder}/${fileName}`;
    
    // Determine resource type (video or image)
    const resourceType = fileUrl.includes('/video/') ? 'video' : 'image';
    
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return true;
  } catch (error) {
    logger.error(`Delete file error: ${error.message}`);
    throw error;
  }
};

/**
 * Get file URL for client (returns Cloudinary URL)
 */
const getFileUrl = (cloudinaryResult) => {
  if (!cloudinaryResult) return null;
  
  // If it's already a URL string, return it
  if (typeof cloudinaryResult === 'string') {
    return cloudinaryResult;
  }
  
  // If it's a Cloudinary result object, return the secure URL
  return cloudinaryResult.secure_url || cloudinaryResult.url || null;
};

/**
 * Get workout file URL for client (returns Cloudinary URL)
 */
const getWorkoutFileUrl = (cloudinaryResult) => {
  if (!cloudinaryResult) return null;
  
  // If it's already a URL string, return it
  if (typeof cloudinaryResult === 'string') {
    return cloudinaryResult;
  }
  
  // If it's a Cloudinary result object, return the secure URL
  return cloudinaryResult.secure_url || cloudinaryResult.url || null;
};

module.exports = {
  upload,
  workoutUpload,
  uploadSingle,
  uploadWorkoutImage,
  uploadMultiple,
  deleteFile,
  getFileUrl,
  getWorkoutFileUrl,
  cloudinary,
  uploadProfilePhotoToCloudinary,
  uploadWorkoutFileToCloudinary
};