const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true }, 
  status: { type: String, required: true, enum: ['To Do', 'In Progress', 'Blocked', 'Done'] },
  priority: { type: String, required: true, enum: ['Low', 'Medium', 'High', 'Critical'] },
  
  taskId: { type: String, required: true, unique: true },
  
  // --- ORGANIZATION ---
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true }, // Dynamic Team (Board)
  pod: { type: String, required: true }, // Fixed Function (Dev, Design, etc.)
  
  // --- TIMELINE ---
  startDate: { type: Date, required: true },
  deadline: { type: Date, required: true },
  
  // --- PEOPLE ---
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // --- HIERARCHY (Subtasks) ---
  parentTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  subtasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],

  // --- ASSETS ---
  attachments: [{
    url: String,
    public_id: String,
    format: String,
    name: String
  }],

  createdAt: { type: Date, default: Date.now }
});

// Auto-populate subtasks when finding
taskSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'subtasks',
        select: 'taskId title status priority assignee',
        populate: { path: 'assignee', select: 'username' }
    });
    next();
});

module.exports = mongoose.model('Task', taskSchema);