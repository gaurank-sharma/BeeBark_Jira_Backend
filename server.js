require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cron = require('node-cron'); // Import Cron for scheduling

// Import Models & Utils
const User = require('./models/User');
const Task = require('./models/Task');
const Team = require('./models/Team');
const { upload } = require('./utils/cloudinaryConfig');
const sendEmail = require('./utils/sendEmail');

const app = express();
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
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

// --- CRON JOB: CHECK FOR OVERDUE TASKS (Runs daily at 9:00 AM) ---
cron.schedule('0 9 * * *', async () => {
    console.log("⏰ Running Daily Deadline Check...");
    try {
        const overdueTasks = await Task.find({
            status: { $ne: 'Done' },
            deadline: { $lt: new Date() } // Deadline is in the past
        }).populate('assignee', 'email username').populate('reporter', 'email username');

        for (const task of overdueTasks) {
            if (task.assignee && task.assignee.email) {
                await sendEmail(
                    task.assignee.email,
                    `Running Late: ${task.title}`,
                    `
                    <h3 style="color:#d32f2f;">⚠️ Task Overdue</h3>
                    <p>This task was due on <b>${new Date(task.deadline).toDateString()}</b>.</p>
                    <p style="font-size: 16px; font-weight: bold;">${task.title}</p>
                    <p>Please update the status or contact your reporter (${task.reporter?.username}).</p>
                    `
                );
            }
        }
    } catch (err) {
        console.error("Cron Job Error:", err);
    }
});

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(400).json({ error: "Username or Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "User created" });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "User not found" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ _id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { _id: user._id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Get All Users (For Assignee Dropdown)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const users = await User.find({}, 'username email');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// --- TEAM ROUTES ---
app.post('/api/teams', authenticateToken, async (req, res) => {
    try {
        const { name, members, isPrivate } = req.body;
        const memberIds = members ? [...new Set([...members, req.user._id])] : [req.user._id]; 
        
        const newTeam = new Team({
            name,
            members: memberIds,
            isPrivate,
            createdBy: req.user._id
        });
        await newTeam.save();
        res.json(newTeam);
    } catch(err) { res.status(500).json({error: "Failed to create team"}); }
});

app.get('/api/teams', authenticateToken, async (req, res) => {
    try {
        const teams = await Team.find({
            $or: [
                { isPrivate: false },
                { members: req.user._id }
            ]
        });
        res.json(teams);
    } catch (err) { res.status(500).json({ error: "Failed to fetch teams" }); }
});

// --- TASK ROUTES ---

// 1. CREATE TASK (Selectable Reporter & Files)
app.post('/api/tasks', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { 
        title, description, priority, pod,
        assigneeId, reporterId, teamId, startDate, deadline 
    } = req.body;
    
    // Process files from Cloudinary
    const attachments = req.files ? req.files.map(f => ({
        url: f.path,
        public_id: f.filename,
        format: f.mimetype,
        name: f.originalname
    })) : [];

    const task = new Task({
        title,
        description,
        priority,
        pod, 
        startDate: startDate || Date.now(),
        deadline: deadline || null,
        team: teamId || null,
        assignee: assigneeId || null,
        // Use selected reporterId, otherwise default to logged-in user
        reporter: reporterId || req.user._id, 
        attachments
    });

    await task.save();
    
    const populatedTask = await task.populate(['assignee', 'reporter']);
    
    // EMAIL: Notify Assignee
    if (populatedTask.assignee && populatedTask.assignee.email) {
        await sendEmail(
            populatedTask.assignee.email,
            `[JIRA] Assigned: ${title}`, 
            `
              <h3>Hello ${populatedTask.assignee.username},</h3>
              <p><b>${populatedTask.reporter.username}</b> assigned this task to you.</p>
              <div style="background:#f4f5f7; padding:15px; border-radius:5px; margin: 10px 0;">
                <p><strong>Task:</strong> ${title}</p>
                <p><strong>Priority:</strong> ${priority}</p>
                <p><strong>Deadline:</strong> ${deadline ? new Date(deadline).toDateString() : 'None'}</p>
              </div>
              <p>Please log in to view attachments.</p>
            `
        );
    }

    res.json(populatedTask);
  } catch (err) {
    console.error("Task Creation Error:", err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// 2. GET TASKS
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const { filter } = req.query;
        let query = {};
        if (filter === 'my-tasks') {
            query.assignee = req.user._id;
        }

        const tasks = await Task.find(query)
            .populate('assignee', 'username email')
            .populate('reporter', 'username email')
            .populate('team', 'name')
            .sort({ createdAt: -1 });

        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

// 3. UPDATE TASK (Edit Any Field + Status Drag/Drop)
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const updates = req.body;
        
        // Find task and update
        const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true })
            .populate('assignee', 'email username')
            .populate('reporter', 'email username');

        if (!task) return res.status(404).json({error: "Not found"});

        // Send Email to involved parties (Assignee & Reporter)
        const recipients = [task.assignee?.email, task.reporter?.email].filter(Boolean);
        const uniqueRecipients = [...new Set(recipients)];

        for (const email of uniqueRecipients) {
            await sendEmail(
                email,
                `[JIRA] Update: ${task.title}`,
                `
                <p>There has been an update to <b>${task.title}</b>.</p>
                <div style="background:#f4f5f7; padding:10px; border-radius:4px; margin-bottom:10px;">
                   ${updates.status ? `<p><b>Status:</b> ${updates.status}</p>` : ''}
                   ${updates.priority ? `<p><b>Priority:</b> ${updates.priority}</p>` : ''}
                   ${updates.description ? `<p><b>Description:</b> Updated</p>` : ''}
                </div>
                <p>Updated by: ${req.user.username}</p>
                `
            );
        }

        res.json(task);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});

// 4. DELETE TASK
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        await Task.findByIdAndDelete(req.params.id);
        res.json({ message: "Task deleted" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete task" });
    }
});

app.get('/', (req, res) => {
  res.send('🚀 BeeBark API is running with Cron & Email support!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));