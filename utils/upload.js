const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Memory storage — files buffered in memory, then streamed to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Upload a single multer file (with .buffer) to Cloudinary
const uploadToCloudinary = (file) => {
  const isPdf = file.mimetype === 'application/pdf';
  const publicId = file.originalname.replace(/\.[^/.]+$/, '') + '-' + Date.now();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'beebark-tasks',
        resource_type: isPdf ? 'raw' : 'image',
        public_id: publicId,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
          format: file.mimetype,
          name: file.originalname,
        });
      }
    );
    Readable.from(file.buffer).pipe(stream);
  });
};

module.exports = { upload, uploadToCloudinary };
