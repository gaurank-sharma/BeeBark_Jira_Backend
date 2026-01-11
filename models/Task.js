const mongoose = require('mongoose');

const subtaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  isCompleted: { type: Boolean, default: false }
});

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true }, 
  status: { type: String, required: true, enum: ['To Do', 'In Progress', 'Blocked', 'Done'] },
  priority: { type: String, required: true, enum: ['Low', 'Medium', 'High', 'Critical'] },
  
  taskId: { type: String, required: true, unique: true },
  
  // Organization (Teams replacing Pods)
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  
  startDate: { type: Date, required: true },
  deadline: { type: Date, required: true },
  
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  subtasks: [subtaskSchema], // New Subtask Array

  attachments: [{
    url: String,
    public_id: String,
    format: String,
    name: String
  }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', taskSchema);