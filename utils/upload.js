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
    // Detect PDF
    const isPdf = file.mimetype === 'application/pdf';
    
    return {
      folder: 'beebark-tasks',
      // IMPORTANT: 'auto' allows Cloudinary to detect PDF vs Image
      resource_type: 'auto', 
      // Force correct extension
      format: isPdf ? 'pdf' : undefined, 
      public_id: file.originalname.split('.')[0] + '-' + Date.now(), 
    };
  },
});

const upload = multer({ storage: storage });

module.exports = upload;