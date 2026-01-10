// models/Task.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  taskId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String }, // For rich text description
  status: { type: String, default: 'To Do' },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  
  // --- NEW FIELDS ---
  pod: { type: String, required: true }, // e.g. "Development", "Marketing Pod"
  startDate: { type: Date, default: Date.now },
  deadline: { type: Date },
  
  // Organization
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }, // Optional: if you want to link to a private team
  
  // People
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Files (Cloudinary)
  attachments: [{
    url: String,
    public_id: String,
    format: String,
    name: String // To show original filename
  }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', taskSchema);