const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'jira-uploads',
      resource_type: 'auto', 
      public_id: file.originalname.split('.')[0] + '-' + Date.now(),
    };
  },
});

const upload = multer({ storage: storage });
module.exports = upload;