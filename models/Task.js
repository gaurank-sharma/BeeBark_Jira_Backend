const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String }, // Rich text or long text
  status: { type: String, default: 'To Do' }, // To Do, In Progress, Done
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  
  // Relationships
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Who created it
  
  // Attachments
  attachments: [{
    url: String,
    public_id: String,
    format: String
  }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', taskSchema);