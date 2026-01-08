require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- MODELS ---

// User Model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

// Task Model
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  status: { type: String, default: 'To Do' }, // 'To Do', 'In Progress', 'Done'
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
});
const Task = mongoose.model('Task', taskSchema);

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.status(401).json({ error: "Access Denied" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid Token" });
    req.user = user;
    next();
  });
};

// --- ROUTES ---

// 1. AUTH ROUTES
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    res.status(400).json({ error: "Username already exists" });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.status(400).json({ error: "User not found" });

    // Validate password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Invalid password" });

    // Create Token
    const token = jwt.sign({ _id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ 
        token, 
        user: { _id: user._id, username: user.username } 
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// 2. USERS ROUTE (For Dropdown)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const users = await User.find({}, '-password'); // Return all users excluding passwords
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// 3. TASK ROUTES
// Get all tasks (Populate assignee to get username)
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const tasks = await Task.find().populate('assignee', 'username').sort({ createdAt: 1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// Create a new task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { title, assignee } = req.body;
    const newTask = new Task({
        title,
        assignee: assignee || null // If empty string is sent, make it null
    });
    const savedTask = await newTask.save();
    
    // Populate before sending back so UI updates instantly with username
    await savedTask.populate('assignee', 'username'); 
    res.json(savedTask);
  } catch (err) {
    res.status(500).json({ error: "Failed to create task" });
  }
});

// Update task status (Drag and Drop)
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const updatedTask = await Task.findByIdAndUpdate(
        req.params.id, 
        { status }, 
        { new: true }
    );
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: "Failed to update task" });
  }
});

// Delete a task
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// --- SERVER START ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));