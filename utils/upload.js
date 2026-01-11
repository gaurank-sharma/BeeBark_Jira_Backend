// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const multer = require('multer');

// const storage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: async (req, file) => {
//     return {
//       folder: 'jira-uploads',
//       resource_type: 'auto', 
//       public_id: file.originalname.split('.')[0] + '-' + Date.now(),
//     };
//   },
// });

// const upload = multer({ storage: storage });
// module.exports = upload;


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