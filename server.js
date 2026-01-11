// require('dotenv').config();
// const express = require('express'); // Import Express
// const mongoose = require('mongoose');
// const cors = require('cors');
// const jwt = require('jsonwebtoken');
// const bcrypt = require('bcryptjs');
// const cron = require('node-cron'); 

// // --- IMPORTS ---
// const connectCloudinary = require('./config/cloudinary');
// const upload = require('./utils/upload'); // Use the new upload util
// const User = require('./models/User');
// const Task = require('./models/Task');
// const Team = require('./models/Team');
// const sendEmail = require('./utils/sendEmail');

// // --- 1. INITIALIZE APP (Must be before app.use) ---
// const app = express(); 

// // --- 2. CONFIGURE CORS (Fixes Connection Refused) ---
// app.use(cors({
//   origin: ["http://localhost:5173", "https://beebark-jira.vercel.app"], 
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
//   credentials: true
// }));

// app.use(express.json());

// // --- 3. CONNECT SERVICES ---
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

// // --- CRON JOB ---
// cron.schedule('0 9 * * *', async () => {
//     console.log("⏰ Checking Deadlines...");
//     try {
//         const overdueTasks = await Task.find({
//             status: { $ne: 'Done' },
//             deadline: { $lt: new Date() }
//         }).populate('assignee', 'email username');

//         for (const task of overdueTasks) {
//             if (task.assignee?.email) {
//                 await sendEmail(task.assignee.email, `Running Late: ${task.title}`, 
//                     `<h3 style="color:red">Task Overdue</h3><p>Due: ${new Date(task.deadline).toDateString()}</p>`);
//             }
//         }
//     } catch (err) { console.error(err); }
// });

// // --- ROUTES ---

// // Auth
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

// // Teams
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

// // Tasks
// app.post('/api/tasks', authenticateToken, upload.array('files'), async (req, res) => {
//   try {
//     // 1. EXTRACT taskId from body
//     const { title, description, priority, pod, assigneeId, reporterId, teamId, startDate, deadline, taskId } = req.body;
    
//     const attachments = req.files ? req.files.map(f => ({
//         url: f.path, public_id: f.filename, format: f.mimetype, name: f.originalname
//     })) : [];

//     // 2. SAVE taskId (with a fallback random generator if frontend fails)
//     const task = new Task({
//         title, description, priority, pod, 
//         taskId: taskId || `BB-${Math.floor(1000 + Math.random() * 9000)}`, // Fallback ID
//         startDate: startDate || Date.now(), deadline, 
//         team: teamId || null, assignee: assigneeId || null,
//         reporter: reporterId || req.user._id, 
//         status: req.body.status || 'To Do',
//         attachments
//     });

//     await task.save();
//     const populated = await task.populate(['assignee', 'reporter']);
    
//     // Notify Assignee
//     if (populated.assignee?.email) {
//         await sendEmail(populated.assignee.email, `[JIRA] Assigned: ${title}`, 
//             `<h3>Task Assigned</h3><p>${populated.reporter.username} assigned <b>${title}</b> to you.</p>`);
//     }
//     res.json(populated);
//   } catch (err) { 
//     console.error(err);
//     res.status(500).json({ error: "Task creation failed" }); 
//   }
// });

// app.get('/api/tasks', authenticateToken, async (req, res) => {
//     const query = req.query.filter === 'my-tasks' ? { assignee: req.user._id } : {};
//     const tasks = await Task.find(query).populate('assignee', 'username email').populate('reporter', 'username email').sort({ createdAt: -1 });
//     res.json(tasks);
// });

// app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
//     try {
//         const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })
//             .populate('assignee', 'email').populate('reporter', 'email');
        
//         // Notify
//         [task.assignee?.email, task.reporter?.email].filter(Boolean).forEach(email => {
//              sendEmail(email, `[JIRA] Update: ${task.title}`, `<p>Task updated: <b>${task.title}</b></p>`);
//         });
        
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
const cron = require('node-cron'); 

const connectCloudinary = require('./config/cloudinary');
const upload = require('./utils/upload'); 
const User = require('./models/User');
const Task = require('./models/Task');
const Team = require('./models/Team');
const sendEmail = require('./utils/sendEmail');

const app = express(); 

app.use(cors({
  origin: ["http://localhost:5173", "https://beebark-jira.vercel.app"], 
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json());
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


// ... imports ...

// --- UPDATED EMAIL TEMPLATE (With Blocked Color) ---
const getEmailTemplate = (task, action, actorName) => {
    // Status Logic
    const isDone = task.status === 'Done';
    const isBlocked = task.status === 'Blocked';
    const isInProgress = task.status === 'In Progress';
    
    // Status Colors (Done=Green, Blocked=Red, Progress=Blue, ToDo=Grey)
    let statusColor = '#42526e'; 
    let statusBg = '#dfe1e6';

    if (isDone) { statusColor = '#006644'; statusBg = '#e3fcef'; }
    else if (isBlocked) { statusColor = '#de350b'; statusBg = '#ffebe6'; } // RED FOR BLOCKED
    else if (isInProgress) { statusColor = '#0052cc'; statusBg = '#deebff'; }

    const isCreation = action === "created";

    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #dfe1e6; border-radius: 3px; background-color: #ffffff;">
        <div style="padding: 20px 20px 10px 20px;">
             <div style="font-size: 12px; color: #5e6c84; margin-bottom: 5px;">
                ${actorName} <strong>${action}</strong> a work item
             </div>
             <div style="display: flex; align-items: center; gap: 10px;">
                 <span style="background: #ebecf0; color: #42526e; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 12px; border: 1px solid #dfe1e6;">
                    ${task.taskId}
                 </span>
                 <span style="font-size: 18px; color: #172b4d; font-weight: 500; margin-left: 8px;">
                    ${task.title}
                 </span>
             </div>
        </div>
        <div style="padding: 0 20px 20px 20px;">
            ${!isCreation ? `
            <div style="margin: 15px 0; display: flex; align-items: center; font-size: 14px; color: #172b4d;">
                <span style="color: #5e6c84; margin-right: 8px;">Status:</span>
                <span style="background: ${statusBg}; color: ${statusColor}; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 12px; text-transform: uppercase;">
                    ${task.status}
                </span>
            </div>` : ''}

            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
                ${isCreation ? `
                <tr>
                    <td style="padding: 5px 0; width: 100px; color: #5e6c84;">Status:</td>
                    <td style="padding: 5px 0;">
                        <span style="background: ${statusBg}; color: ${statusColor}; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 12px; text-transform: uppercase;">
                            ${task.status}
                        </span>
                    </td>
                </tr>` : ''}
                <tr>
                    <td style="padding: 5px 0; color: #5e6c84;">Assignee:</td>
                    <td style="padding: 5px 0;">
                        <span style="color: #172b4d;">${task.assignee?.username || 'Unassigned'}</span>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #5e6c84;">Priority:</td>
                    <td style="padding: 5px 0; color: #172b4d;">${task.priority}</td>
                </tr>
            </table>
            <div style="margin-top: 25px;">
                <a href="https://beebark-jira.vercel.app/" style="background-color: #0052cc; color: #ffffff; padding: 8px 16px; text-decoration: none; border-radius: 3px; font-weight: 500; font-size: 14px; display: inline-block;">
                    View work item
                </a>
            </div>
        </div>
    </div>
    `;
};

// 1. AUTH & USERS
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

// 2. TEAMS (Replaces Pods)
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
    // Return Public teams OR Private teams where user is a member
    const teams = await Team.find({ $or: [{ isPrivate: false }, { members: req.user._id }] });
    res.json(teams);
});

// 3. TASKS
app.post('/api/tasks', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { title, description, priority, teamId, assigneeId, reporterId, startDate, deadline, taskId, subtasks } = req.body;
    
    // Parse subtasks if sent as string (Multipart form data nuance)
    let parsedSubtasks = [];
    if (subtasks) {
        try { parsedSubtasks = JSON.parse(subtasks); } catch (e) { parsedSubtasks = []; }
    }

    const attachments = req.files ? req.files.map(f => ({
        url: f.path, public_id: f.filename, format: f.mimetype, name: f.originalname
    })) : [];

    const task = new Task({
        title, description, priority, 
        team: teamId, // Mandatory Team ID
        taskId: taskId || `BB-${Math.floor(1000 + Math.random() * 9000)}`,
        startDate: startDate, 
        deadline: deadline, 
        assignee: assigneeId,
        reporter: reporterId || req.user._id, // Fallback to session user
        status: req.body.status || 'To Do',
        attachments,
        subtasks: parsedSubtasks
    });

    await task.save();
    
    // Populate for Email
    const populated = await task.populate(['assignee', 'reporter']);
    
    // Email Logic: Send to Assignee AND Reporter (Avoid duplicates)
    const emails = new Set();
    if (populated.assignee?.email) emails.add(populated.assignee.email);
    if (populated.reporter?.email) emails.add(populated.reporter.email);

    const emailContent = getEmailTemplate(populated, "created", req.user.username);
    
    emails.forEach(email => {
        sendEmail(email, `[JIRA] (${populated.taskId}) ${title}`, emailContent);
    });

    res.json(populated);
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: "Task creation failed. Ensure all fields are filled." }); 
  }
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
    let query = {};
    if (req.query.filter === 'my-tasks') {
        query = { assignee: req.user._id };
    } else if (req.query.teamId) {
        query = { team: req.query.teamId };
    }
    
    const tasks = await Task.find(query)
        .populate('assignee', 'username email')
        .populate('reporter', 'username email')
        .populate('team')
        .sort({ createdAt: -1 });
    res.json(tasks);
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .populate('assignee', 'email username')
            .populate('reporter', 'email username');
        
        // Email Logic: Send to Assignee AND Reporter
        const emails = new Set();
        if (task.assignee?.email) emails.add(task.assignee.email);
        if (task.reporter?.email) emails.add(task.reporter.email);

        const emailContent = getEmailTemplate(task, "updated", req.user.username);

        emails.forEach(email => {
             sendEmail(email, `[JIRA] (${task.taskId}) Updated: ${task.title}`, emailContent);
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