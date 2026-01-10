require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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

// --- TEAM ROUTES (For Privacy/Access Control) ---
app.post('/api/teams', authenticateToken, async (req, res) => {
    try {
        const { name, members, isPrivate } = req.body;
        // Ensure creator is included in members
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
        // Return teams where user is a member OR team is public
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

// 1. CREATE TASK (With Files, Pods, Dates)
app.post('/api/tasks', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { 
        title, description, priority, pod, // New fields
        assigneeId, teamId, startDate, deadline 
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
        pod, // Saves "Development", "Marketing", etc.
        startDate: startDate || Date.now(),
        deadline: deadline || null,
        team: teamId || null, // Optional link to a Team model
        assignee: assigneeId || null,
        reporter: req.user._id,
        attachments
    });

    await task.save();
    
    // --- EMAIL NOTIFICATION ---
    const populatedTask = await task.populate(['assignee', 'reporter']);
    
    // 1. Notify the Assignee
    if (populatedTask.assignee && populatedTask.assignee.email) {
        await sendEmail(
            populatedTask.assignee.email,
            `New Assignment: ${title}`, 
            `
              <h3>Hello ${populatedTask.assignee.username},</h3>
              <p>You have been assigned a new task in <b>BeeBark Jira</b>.</p>
              <div style="background:#f4f4f4; padding:15px; border-radius:5px; margin: 10px 0;">
                <p><strong>Task:</strong> ${title}</p>
                <p><strong>Pod:</strong> ${pod}</p>
                <p><strong>Priority:</strong> ${priority}</p>
                <p><strong>Deadline:</strong> ${deadline ? new Date(deadline).toDateString() : 'No Deadline'}</p>
                <p><strong>Reporter:</strong> ${req.user.username}</p>
              </div>
              <p>Please log in to view details and attachments.</p>
            `
        );
    }

    // 2. Confirmation to Reporter
    if (populatedTask.reporter.email) {
         await sendEmail(
            populatedTask.reporter.email,
            `Task Created: ${title}`,
            `<p>Success! You created the task <b>${title}</b> in the <b>${pod}</b> pod.</p>`
        );
    }

    res.json(populatedTask);
  } catch (err) {
    console.error("Task Creation Error:", err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// 2. GET TASKS (With "My Tasks" Filter)
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const { filter } = req.query; // Check for ?filter=my-tasks
        let query = {};

        // If user wants ONLY their tasks
        if (filter === 'my-tasks') {
            query.assignee = req.user._id;
        }

        // OPTIONAL: Add security check for Private Teams
        // (Uncomment if you want strict privacy)
        /*
        const allowedTeams = await Team.find({
            $or: [{ isPrivate: false }, { members: req.user._id }]
        }).select('_id');
        const teamIds = allowedTeams.map(t => t._id);
        
        // Add to query: Task must be in allowed team OR have no team assigned
        query.$or = [{ team: { $in: teamIds } }, { team: null }];
        */

        const tasks = await Task.find(query)
            .populate('assignee', 'username email')
            .populate('reporter', 'username email')
            .populate('team', 'name')
            .sort({ createdAt: -1 });

        res.json(tasks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fetch failed" });
    }
});

// 3. UPDATE TASK STATUS (Drag & Drop)
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const task = await Task.findById(req.params.id)
            .populate('assignee', 'email username')
            .populate('reporter', 'email username');

        if (!task) return res.status(404).json({error: "Not found"});

        const oldStatus = task.status;
        task.status = status;
        await task.save();

        // --- EMAIL ON STATUS CHANGE ---
        if (oldStatus !== status) {
            const subject = `Task Updated: ${task.title}`;
            const html = `
                <p>Status changed from <b>${oldStatus}</b> to <b>${status}</b>.</p>
                <p>Updated by: ${req.user.username}</p>
            `;
            
            // Notify Assignee
            if (task.assignee && task.assignee.email) {
                await sendEmail(task.assignee.email, subject, html);
            }
            // Notify Reporter (if they are not the one updating it)
            if (task.reporter && task.reporter.email && task.reporter._id.toString() !== req.user._id.toString()) {
                await sendEmail(task.reporter.email, subject, html);
            }
        }

        res.json(task);
    } catch (err) {
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
  res.send('🚀 BeeBark API is running with Pods & Email support!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));