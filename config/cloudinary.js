// const cloudinary = require('cloudinary').v2;
// require('dotenv').config();

// const connectCloudinary = async () => {
//   try {
//     cloudinary.config({
//       cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//       api_key: process.env.CLOUDINARY_API_KEY,
//       api_secret: process.env.CLOUDINARY_API_SECRET,
//     });
//     console.log('☁️ Cloudinary Configured');
//   } catch (error) {
//     console.error('❌ Cloudinary Connection Error:', error);
//   }
// };

// module.exports = connectCloudinary;



const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // FIX: Detect if it's a PDF or Image
    const isPdf = file.mimetype === 'application/pdf';
    
    return {
      folder: 'beebark-tasks',
      // 'raw' for PDFs/Docs, 'image' for images. 'auto' works best generally.
      resource_type: 'auto', 
      format: isPdf ? 'pdf' : undefined, // Force PDF extension
      public_id: file.originalname.split('.')[0] + '-' + Date.now(), // Unique Name
    };
  },
});

const upload = multer({ storage: storage });

module.exports = upload;