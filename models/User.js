const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true }, // Needed for notifications
  password: { type: String, required: true },
});

module.exports = mongoose.model('User', userSchema);