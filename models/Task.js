const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String }, // Rich text
  status: { type: String, default: 'To Do' },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  
  // Dates
  startDate: { type: Date, default: Date.now },
  deadline: { type: Date },

  // Organization
  pod: { type: String, required: true }, // e.g., "Development", "Design" (Stored as string or Ref)
  isPrivate: { type: Boolean, default: false }, // Private to the assignee/reporter?

  // People
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Files (Cloudinary)
  attachments: [{
    url: String,
    name: String,
    format: String
  }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', taskSchema);