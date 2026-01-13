// const mongoose = require('mongoose');

// const userSchema = new mongoose.Schema({
//   username: { type: String, required: true, unique: true },
//   email: { type: String, required: true, unique: true }, // Needed for notifications
//   password: { type: String, required: true },
// });

// module.exports = mongoose.model('User', userSchema);



const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true }, // Needed for notifications
  password: { type: String, required: true },
  
  // --- ADDED FOR FORGOT PASSWORD ---
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date }
});

module.exports = mongoose.model('User', userSchema);