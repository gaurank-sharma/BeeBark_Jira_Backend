


// require('dotenv').config();
// const express = require('express'); 
// const mongoose = require('mongoose');
// const cors = require('cors');
// const jwt = require('jsonwebtoken');
// const bcrypt = require('bcryptjs');
// const cron = require('node-cron'); 

// const connectCloudinary = require('./config/cloudinary');
// const upload = require('./utils/upload'); 
// const User = require('./models/User');
// const Task = require('./models/Task');
// const Team = require('./models/Team');
// const sendEmail = require('./utils/sendEmail');

// const app = express(); 

// app.use(cors({
//   origin: ["http://localhost:5173", "https://beebark-jira.vercel.app"], 
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
//   credentials: true
// }));

// app.use(express.json());
// connectCloudinary();

// mongoose.connect(process.env.MONGO_URI)
//   .then(() => console.log('✅ MongoDB Connected'))
//   .catch(err => console.error('❌ DB Connection Error:', err));

// // --- MIDDLEWARE ---
// const authenticateToken = (req, res, next) => {
//   const token = req.headers['authorization']?.split(' ')[1];
//   if (!token) return res.status(401).json({ error: "Access Denied" });
//   jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
//     if (err) return res.status(403).json({ error: "Invalid Token" });
//     req.user = user;
//     next();
//   });
// };

// // --- EMAIL TEMPLATE ---
// const getEmailTemplate = (task, action, actorName) => {
//     const isDone = task.status === 'Done';
//     const isBlocked = task.status === 'Blocked';
//     const isInProgress = task.status === 'In Progress';
    
//     let statusColor = '#42526e'; 
//     let statusBg = '#dfe1e6';

//     if (isDone) { statusColor = '#006644'; statusBg = '#e3fcef'; }
//     else if (isBlocked) { statusColor = '#de350b'; statusBg = '#ffebe6'; }
//     else if (isInProgress) { statusColor = '#0052cc'; statusBg = '#deebff'; }

//     const isCreation = action === "created";

//     return `
//     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ebecf0; border-radius: 4px;">
//         <div style="padding: 20px; border-bottom: 1px solid #ebecf0; background: #f4f5f7;">
//              <span style="background: #0052cc; color: #fff; padding: 3px 6px; border-radius: 3px; font-weight: bold; font-size: 12px;">BeeBark</span>
//              <span style="color: #5e6c84; font-size: 14px; margin-left: 10px;">${task.taskId}</span>
//              <h2 style="margin: 10px 0 0 0; color: #172b4d;">${task.title}</h2>
//         </div>
//         <div style="padding: 20px; background-color: #ffffff;">
//             <p style="color: #172b4d; font-size: 14px;">
//                 <b>${actorName}</b> ${action} this task.
//             </p>
//             <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
//                 <tr>
//                     <td style="padding: 5px 0; color: #5e6c84; font-size: 12px; font-weight: bold; text-transform: uppercase;">Status</td>
//                     <td style="padding: 5px 0;"><span style="background: ${statusBg}; color: ${statusColor}; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 12px;">${task.status}</span></td>
//                 </tr>
//                 <tr>
//                     <td style="padding: 5px 0; color: #5e6c84; font-size: 12px; font-weight: bold; text-transform: uppercase;">Pod</td>
//                     <td style="padding: 5px 0; color: #172b4d; font-weight: bold;">${task.pod}</td>
//                 </tr>
//                 <tr>
//                     <td style="padding: 5px 0; color: #5e6c84; font-size: 12px; font-weight: bold; text-transform: uppercase;">Assignee</td>
//                     <td style="padding: 5px 0; color: #172b4d;">${task.assignee?.username || 'Unassigned'}</td>
//                 </tr>
//             </table>
//             <div style="margin-top: 25px;">
//                 <a href="https://beebark-jira.vercel.app/" style="background-color: #0052cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 3px; font-weight: bold; font-size: 14px;">View Task</a>
//             </div>
//         </div>
//     </div>
//     `;
// };

// // --- ROUTES ---

// app.post('/api/register', async (req, res) => {
//   try {
//     const { username, email, password } = req.body;
//     const existing = await User.findOne({ $or: [{ username }, { email }] });
//     if (existing) return res.status(400).json({ error: "User exists" });
//     const hashedPassword = await bcrypt.hash(password, 10);
//     const newUser = new User({ username, email, password: hashedPassword });
//     await newUser.save();
//     res.status(201).json({ message: "User created" });
//   } catch (err) { res.status(500).json({ error: "Server Error" }); }
// });

// app.post('/api/login', async (req, res) => {
//   try {
//     const { username, password } = req.body;
//     const user = await User.findOne({ username });
//     if (!user) return res.status(400).json({ error: "User not found" });
//     const valid = await bcrypt.compare(password, user.password);
//     if (!valid) return res.status(400).json({ error: "Invalid password" });
//     const token = jwt.sign({ _id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
//     res.json({ token, user: { _id: user._id, username: user.username, email: user.email } });
//   } catch (err) { res.status(500).json({ error: "Login failed" }); }
// });

// app.get('/api/users', authenticateToken, async (req, res) => {
//     const users = await User.find({}, 'username email');
//     res.json(users);
// });

// // TEAMS
// app.post('/api/teams', authenticateToken, async (req, res) => {
//     try {
//         const { name, members, isPrivate } = req.body;
//         const memberIds = members ? [...new Set([...members, req.user._id])] : [req.user._id]; 
//         const newTeam = new Team({ name, members: memberIds, isPrivate, createdBy: req.user._id });
//         await newTeam.save();
//         res.json(newTeam);
//     } catch(err) { res.status(500).json({error: "Create failed"}); }
// });

// app.get('/api/teams', authenticateToken, async (req, res) => {
//     const teams = await Team.find({ $or: [{ isPrivate: false }, { members: req.user._id }] });
//     res.json(teams);
// });

// // TASKS
// app.post('/api/tasks', authenticateToken, upload.array('files'), async (req, res) => {
//   try {
//     const { title, description, priority, teamId, pod, assigneeId, reporterId, startDate, deadline, taskId, parentTaskId, subtasks } = req.body;
    
//     let parsedSubtasks = [];
//     if (subtasks) { try { parsedSubtasks = JSON.parse(subtasks); } catch (e) { parsedSubtasks = []; } }

//     const attachments = req.files ? req.files.map(f => ({
//         url: f.path, public_id: f.filename, format: f.mimetype, name: f.originalname
//     })) : [];

//     const task = new Task({
//         title, description, priority, 
//         team: teamId, pod: pod, 
//         taskId: taskId || `BB-${Math.floor(1000 + Math.random() * 9000)}`,
//         startDate, deadline, assignee: assigneeId, reporter: reporterId || req.user._id, 
//         status: req.body.status || 'To Do',
//         parentTask: parentTaskId || null, 
//         attachments, subtasks: parsedSubtasks
//     });

//     await task.save();
    
//     if (parentTaskId) {
//         await Task.findByIdAndUpdate(parentTaskId, { $push: { subtasks: task._id } });
//     }

//     const populated = await task.populate(['assignee', 'reporter']);
    
//     // Email
//     const emails = new Set();
//     if (populated.assignee?.email) emails.add(populated.assignee.email);
//     if (populated.reporter?.email) emails.add(populated.reporter.email);
//     const emailContent = getEmailTemplate(populated, "created", req.user.username);
//     emails.forEach(email => sendEmail(email, `[BeeBark] (${populated.taskId}) ${title}`, emailContent));

//     res.json(populated);
//   } catch (err) { 
//       console.error(err);
//       res.status(500).json({ error: "Task creation failed." }); 
//   }
// });

// app.get('/api/tasks', authenticateToken, async (req, res) => {
//     let query = {};
    
//     if (req.query.filter === 'my-tasks') {
//         query = { assignee: req.user._id };
//     } else if (req.query.teamId) {
//         query = { team: req.query.teamId };
//     } else {
//         // --- FIXED: RETURN ALL TASKS IN DB (If no filter applied) ---
//         query = {}; 
//     }
    
//     // Filter out subtasks from main board (they show inside parents)
//     query.parentTask = null; 
    
//     try {
//         const tasks = await Task.find(query)
//             .populate('assignee', 'username email')
//             .populate('reporter', 'username email')
//             .populate('team')
//             .populate({
//                 path: 'subtasks',
//                 select: 'taskId title status priority assignee',
//                 populate: { path: 'assignee', select: 'username' }
//             })
//             .sort({ createdAt: -1 });
//         res.json(tasks);
//     } catch(e) { res.status(500).json({error: "Fetch failed"}); }
// });

// app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
//     try {
//         const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })
//             .populate('assignee', 'email username')
//             .populate('reporter', 'email username');
        
//         const emails = new Set();
//         if (task.assignee?.email) emails.add(task.assignee.email);
//         if (task.reporter?.email) emails.add(task.reporter.email);
//         const emailContent = getEmailTemplate(task, "updated", req.user.username);
//         emails.forEach(email => sendEmail(email, `[BeeBark] (${task.taskId}) Updated: ${task.title}`, emailContent));
        
//         res.json(task);
//     } catch (err) { res.status(500).json({ error: "Update failed" }); }
// });

// app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
//     await Task.findByIdAndDelete(req.params.id);
//     res.json({ message: "Deleted" });
// });

// app.get('/', (req, res) => res.send('🚀 BeeBark API Running'));

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));




require('dotenv').config();
const express = require('express'); 
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Ensure you have these folders/files created or standard imports
const connectCloudinary = require('./config/cloudinary');
const upload = require('./utils/upload'); 
const User = require('./models/User');
const Task = require('./models/Task');
const Team = require('./models/Team');
const sendEmail = require('./utils/sendEmail');

const app = express(); 

// --- 1. ROBUST CORS (Prevents blocking) ---
app.use(cors({
  origin: ["http://localhost:5173", "https://beebark-jira.vercel.app"], 
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json());

// Initialize Cloudinary
connectCloudinary();

// --- 2. DB CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ DB Connection Error:', err));

// --- MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: "Access Denied: No Token" });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid Token" });
    req.user = user;
    next();
  });
};

// --- EMAIL TEMPLATE ---
const getEmailTemplate = (task, action, actorName) => {
    const isDone = task.status === 'Done';
    const isBlocked = task.status === 'Blocked';
    const isInProgress = task.status === 'In Progress';
    
    let statusColor = '#42526e'; 
    let statusBg = '#dfe1e6';

    if (isDone) { statusColor = '#006644'; statusBg = '#e3fcef'; }
    else if (isBlocked) { statusColor = '#de350b'; statusBg = '#ffebe6'; }
    else if (isInProgress) { statusColor = '#0052cc'; statusBg = '#deebff'; }

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ebecf0; border-radius: 4px;">
        <div style="padding: 20px; border-bottom: 1px solid #ebecf0; background: #f4f5f7;">
             <span style="background: #0052cc; color: #fff; padding: 3px 6px; border-radius: 3px; font-weight: bold; font-size: 12px;">BeeBark</span>
             <span style="color: #5e6c84; font-size: 14px; margin-left: 10px;">${task.taskId || 'Task'}</span>
             <h2 style="margin: 10px 0 0 0; color: #172b4d;">${task.title}</h2>
        </div>
        <div style="padding: 20px; background-color: #ffffff;">
            <p style="color: #172b4d; font-size: 14px;">
                <b>${actorName}</b> ${action} this task.
            </p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr>
                    <td style="padding: 5px 0; color: #5e6c84; font-size: 12px; font-weight: bold; text-transform: uppercase;">Status</td>
                    <td style="padding: 5px 0;"><span style="background: ${statusBg}; color: ${statusColor}; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 12px;">${task.status}</span></td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #5e6c84; font-size: 12px; font-weight: bold; text-transform: uppercase;">Pod</td>
                    <td style="padding: 5px 0; color: #172b4d; font-weight: bold;">${task.pod || 'General'}</td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #5e6c84; font-size: 12px; font-weight: bold; text-transform: uppercase;">Assignee</td>
                    <td style="padding: 5px 0; color: #172b4d;">${task.assignee?.username || 'Unassigned'}</td>
                </tr>
            </table>
            <div style="margin-top: 25px;">
                <a href="https://beebark-jira.vercel.app/" style="background-color: #0052cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 3px; font-weight: bold; font-size: 14px;">View Task</a>
            </div>
        </div>
    </div>
    `;
};

// --- ROUTES ---

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(400).json({ error: "User already exists" });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    
    res.status(201).json({ message: "User created successfully" });
  } catch (err) { 
    console.error("Register Error:", err);
    res.status(500).json({ error: "Server Error" }); 
  }
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
  } catch (err) { 
    console.error("Login Error:", err);
    res.status(500).json({ error: "Login failed" }); 
  }
});

app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "Email not found" });

        // Generate Token
        const token = crypto.randomBytes(20).toString('hex');
        
        // Set token and expiry (1 hour)
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; 
        await user.save();

        // In a real app, send this link via email:
        // const resetLink = `http://localhost:5173/reset/${token}`;
        // await sendEmail(user.email, "Password Reset", `Click here: ${resetLink}`);

        // FOR DEMO PURPOSES: We return the token so you can test it in the UI immediately
        res.json({ message: "Reset token generated", token: token }); 
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error generating token" });
    }
});

// 2. Reset Password
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        // Find user with valid token and unexpired time
        const user = await User.findOne({ 
            resetPasswordToken: token, 
            resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) return res.status(400).json({ error: "Token is invalid or has expired" });

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: "Password updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error resetting password" });
    }
});

// --- FIXED: ADDED TRY/CATCH TO PREVENT SERVER CRASH ---
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const users = await User.find({}, 'username email');
        // Ensure we always return an array, even if empty
        res.json(users || []);
    } catch (err) {
        console.error("Fetch Users Error:", err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// TEAMS
app.post('/api/teams', authenticateToken, async (req, res) => {
    try {
        const { name, members, isPrivate } = req.body;
        // Handle members if sent as JSON array or needs parsing
        const memberIds = members ? [...new Set([...members, req.user._id])] : [req.user._id]; 
        
        const newTeam = new Team({ 
            name, 
            members: memberIds, 
            isPrivate, 
            createdBy: req.user._id 
        });
        await newTeam.save();
        res.json(newTeam);
    } catch(err) { 
        console.error("Create Team Error:", err);
        res.status(500).json({error: "Create failed"}); 
    }
});

// --- FIXED: ADDED TRY/CATCH ---
app.get('/api/teams', authenticateToken, async (req, res) => {
    try {
        const teams = await Team.find({ $or: [{ isPrivate: false }, { members: req.user._id }] });
        res.json(teams || []);
    } catch (err) {
        console.error("Fetch Teams Error:", err);
        res.status(500).json({ error: "Failed to fetch teams" });
    }
});

// TASKS
app.post('/api/tasks', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { title, description, priority, teamId, pod, assigneeId, reporterId, startDate, deadline, taskId, parentTaskId, subtasks } = req.body;
    
    // --- THE FIX IS HERE ---
    // FormData sends 'null' (string). We must convert it back to actual null.
    let finalParentId = null;
    if (parentTaskId && parentTaskId !== 'null' && parentTaskId !== 'undefined' && parentTaskId !== '') {
        finalParentId = parentTaskId;
    }

    // Safely parse subtasks
    let parsedSubtasks = [];
    if (subtasks) {
        try { 
            parsedSubtasks = typeof subtasks === 'string' ? JSON.parse(subtasks) : subtasks; 
        } catch (e) { parsedSubtasks = []; } 
    }

    const attachments = req.files ? req.files.map(f => ({
        url: f.path, public_id: f.filename, format: f.mimetype, name: f.originalname
    })) : [];

    const task = new Task({
        title, 
        description, 
        priority, 
        team: teamId, 
        pod: pod, 
        taskId: taskId || `BB-${Math.floor(1000 + Math.random() * 9000)}`,
        startDate, 
        deadline, 
        assignee: assigneeId, 
        reporter: reporterId || req.user._id, 
        status: req.body.status || 'To Do',
        parentTask: finalParentId, // <--- Use the cleaned variable
        attachments, 
        subtasks: parsedSubtasks
    });

    await task.save();
    
    // If it has a parent, link it.
    if (finalParentId) {
        await Task.findByIdAndUpdate(finalParentId, { $push: { subtasks: task._id } });
    }

    const populated = await task.populate(['assignee', 'reporter']);
    
    // Email Notification logic...
    try {
        const emails = new Set();
        if (populated.assignee?.email) emails.add(populated.assignee.email);
        if (populated.reporter?.email) emails.add(populated.reporter.email);
        const emailContent = getEmailTemplate(populated, "created", req.user.username);
        emails.forEach(email => sendEmail(email, `[BeeBark] (${populated.taskId}) ${title}`, emailContent));
    } catch (e) { console.log("Email error", e); }

    res.json(populated);
  } catch (err) { 
      console.error("Create Task Error:", err);
      res.status(500).json({ error: "Task creation failed.", details: err.message }); 
  }
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        let query = {};
        
        if (req.query.filter === 'my-tasks') {
            query = { assignee: req.user._id };
        } else if (req.query.teamId) {
            query = { team: req.query.teamId };
        } 
        
        // Filter out subtasks from main board view
        query.parentTask = null; 
        
        const tasks = await Task.find(query)
            .populate('assignee', 'username email')
            .populate('reporter', 'username email')
            .populate('team')
            .populate({
                path: 'subtasks',
                select: 'taskId title status priority assignee',
                populate: { path: 'assignee', select: 'username' }
            })
            .sort({ createdAt: -1 });
            
        res.json(tasks || []);
    } catch(err) { 
        console.error("Fetch Tasks Error:", err);
        res.status(500).json({error: "Fetch failed"}); 
    }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .populate('assignee', 'email username')
            .populate('reporter', 'email username');
        
        if (!task) return res.status(404).json({ error: "Task not found" });

        try {
            const emails = new Set();
            if (task.assignee?.email) emails.add(task.assignee.email);
            if (task.reporter?.email) emails.add(task.reporter.email);
            const emailContent = getEmailTemplate(task, "updated", req.user.username);
            emails.forEach(email => sendEmail(email, `[BeeBark] (${task.taskId}) Updated: ${task.title}`, emailContent));
        } catch (emailErr) {
            console.error("Email update failed:", emailErr);
        }
        
        res.json(task);
    } catch (err) { 
        console.error("Update Task Error:", err);
        res.status(500).json({ error: "Update failed" }); 
    }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        await Task.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

app.get('/', (req, res) => res.send('🚀 BeeBark API Running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));