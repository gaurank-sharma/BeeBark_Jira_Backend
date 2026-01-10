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

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error(err));

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
    // Check if user exists (username OR email)
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

app.get('/api/users', authenticateToken, async (req, res) => {
    const users = await User.find({}, 'username email');
    res.json(users);
});

// --- TEAM ROUTES (Pods) ---
app.post('/api/teams', authenticateToken, async (req, res) => {
    try {
        const { name, members, isPrivate } = req.body;
        // Ensure creator is in members
        const memberIds = [...new Set([...members, req.user._id])]; 
        
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
    // Return teams where user is a member OR team is public
    const teams = await Team.find({
        $or: [
            { isPrivate: false },
            { members: req.user._id }
        ]
    });
    res.json(teams);
});

// --- TASK ROUTES ---

// Create Task (With File Upload)
app.post('/api/tasks', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { title, description, priority, teamId, assigneeId } = req.body;
    
    // Process files from Cloudinary
    const attachments = req.files ? req.files.map(f => ({
        url: f.path,
        public_id: f.filename,
        format: f.mimetype
    })) : [];

    const task = new Task({
        title,
        description,
        priority,
        team: teamId,
        assignee: assigneeId || null,
        reporter: req.user._id,
        attachments
    });

    await task.save();
    
    // --- EMAIL NOTIFICATION ---
const populatedTask = await task.populate(['assignee', 'reporter']);
    
    // 1. Notify the Assignee (if one exists)
    if (populatedTask.assignee && populatedTask.assignee.email) {
        await sendEmail(
            populatedTask.assignee.email,
            `New Assignment: ${title}`, 
            `
              <h3>Hello ${populatedTask.assignee.username},</h3>
              <p>You have been assigned a new task in <b>BeeBark Jira</b>.</p>
              <div style="background:#f4f4f4; padding:15px; border-radius:5px;">
                <p><strong>Task:</strong> ${title}</p>
                <p><strong>Priority:</strong> ${priority}</p>
                <p><strong>Team:</strong> ${req.user.username} (Reporter)</p>
              </div>
              <p>Please log in to view details.</p>
            `
        );
    }

    // 2. Confirmation to Reporter (You)
    if (populatedTask.reporter.email) {
         await sendEmail(
            populatedTask.reporter.email,
            `Task Created: ${title}`,
            `<p>Success! You created the task <b>${title}</b>.</p>`
        );
    }

    res.json(populatedTask);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// Get Tasks (Filtered by User Privacy)
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        // 1. Find teams the user is allowed to see
        const allowedTeams = await Team.find({
            $or: [{ isPrivate: false }, { members: req.user._id }]
        }).select('_id');
        
        const teamIds = allowedTeams.map(t => t._id);

        // 2. Find tasks belonging to those teams
        const tasks = await Task.find({ team: { $in: teamIds } })
            .populate('assignee', 'username email')
            .populate('reporter', 'username email')
            .populate('team', 'name')
            .sort({ createdAt: -1 });

        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

// Update Status / Drag & Drop
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
            const html = `<p>Status changed from <b>${oldStatus}</b> to <b>${status}</b>.</p>`;
            
            // Notify Assignee
            if (task.assignee) await sendEmail(task.assignee.email, subject, html);
            // Notify Reporter
            if (task.reporter && task.reporter._id.toString() !== task.assignee?._id.toString()) {
                await sendEmail(task.reporter.email, subject, html);
            }
        }

        res.json(task);
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});


app.get('/', (req, res) => {
  res.send('🚀 API is running successfully');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));