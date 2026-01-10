require('dotenv').config();
const express = require('express'); // Import Express
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cron = require('node-cron'); 

// --- IMPORTS ---
const connectCloudinary = require('./config/cloudinary');
const upload = require('./utils/upload'); // Use the new upload util
const User = require('./models/User');
const Task = require('./models/Task');
const Team = require('./models/Team');
const sendEmail = require('./utils/sendEmail');

// --- 1. INITIALIZE APP (Must be before app.use) ---
const app = express(); 

// --- 2. CONFIGURE CORS (Fixes Connection Refused) ---
app.use(cors({
  origin: ["http://localhost:5173", "https://beebark-jira.vercel.app"], 
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json());

// --- 3. CONNECT SERVICES ---
connectCloudinary();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ DB Connection Error:', err));

// --- MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Access Denied" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid Token" });
    req.user = user;
    next();
  });
};

// --- CRON JOB ---
cron.schedule('0 9 * * *', async () => {
    console.log("⏰ Checking Deadlines...");
    try {
        const overdueTasks = await Task.find({
            status: { $ne: 'Done' },
            deadline: { $lt: new Date() }
        }).populate('assignee', 'email username');

        for (const task of overdueTasks) {
            if (task.assignee?.email) {
                await sendEmail(task.assignee.email, `Running Late: ${task.title}`, 
                    `<h3 style="color:red">Task Overdue</h3><p>Due: ${new Date(task.deadline).toDateString()}</p>`);
            }
        }
    } catch (err) { console.error(err); }
});

// --- ROUTES ---

// Auth
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(400).json({ error: "User exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "User created" });
  } catch (err) { res.status(500).json({ error: "Server Error" }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ _id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { _id: user._id, username: user.username, email: user.email } });
  } catch (err) { res.status(500).json({ error: "Login failed" }); }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    const users = await User.find({}, 'username email');
    res.json(users);
});

// Teams
app.post('/api/teams', authenticateToken, async (req, res) => {
    try {
        const { name, members, isPrivate } = req.body;
        const memberIds = members ? [...new Set([...members, req.user._id])] : [req.user._id]; 
        const newTeam = new Team({ name, members: memberIds, isPrivate, createdBy: req.user._id });
        await newTeam.save();
        res.json(newTeam);
    } catch(err) { res.status(500).json({error: "Create failed"}); }
});

app.get('/api/teams', authenticateToken, async (req, res) => {
    const teams = await Team.find({ $or: [{ isPrivate: false }, { members: req.user._id }] });
    res.json(teams);
});

// Tasks
app.post('/api/tasks', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { title, description, priority, pod, assigneeId, reporterId, teamId, startDate, deadline } = req.body;
    
    const attachments = req.files ? req.files.map(f => ({
        url: f.path, public_id: f.filename, format: f.mimetype, name: f.originalname
    })) : [];

    const task = new Task({
        title, description, priority, pod, 
        startDate: startDate || Date.now(), deadline, 
        team: teamId || null, assignee: assigneeId || null,
        reporter: reporterId || req.user._id, 
        attachments
    });

    await task.save();
    const populated = await task.populate(['assignee', 'reporter']);
    
    if (populated.assignee?.email) {
        await sendEmail(populated.assignee.email, `[JIRA] Assigned: ${title}`, 
            `<h3>Task Assigned</h3><p>${populated.reporter.username} assigned <b>${title}</b> to you.</p>`);
    }
    res.json(populated);
  } catch (err) { res.status(500).json({ error: "Task failed" }); }
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
    const query = req.query.filter === 'my-tasks' ? { assignee: req.user._id } : {};
    const tasks = await Task.find(query).populate('assignee', 'username email').populate('reporter', 'username email').sort({ createdAt: -1 });
    res.json(tasks);
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .populate('assignee', 'email').populate('reporter', 'email');
        
        // Notify
        [task.assignee?.email, task.reporter?.email].filter(Boolean).forEach(email => {
             sendEmail(email, `[JIRA] Update: ${task.title}`, `<p>Task updated.</p>`);
        });
        
        res.json(task);
    } catch (err) { res.status(500).json({ error: "Update failed" }); }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});

app.get('/', (req, res) => res.send('🚀 BeeBark API Running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));