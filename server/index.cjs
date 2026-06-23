require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./db.cjs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { initCronJobs } = require('./cron.cjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

const chatStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'chat-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const uploadChat = multer({ 
  storage: chatStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

function getFileType(mimetype, filename) {
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  
  const ext = path.extname(filename).toLowerCase();
  if (['.mp4', '.mov', '.avi', '.webm', '.mkv'].includes(ext)) return 'video';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) return 'image';
  
  return 'document';
}

let admin = null;

// Initialize Firebase Admin for FCM
try {
  admin = require('firebase-admin');
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT not set in .env! Push notifications will be disabled.");
  }
} catch (e) {
  console.error("Firebase Admin Init Error:", e);
}

const app = express();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// app.use(cors());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://skill-swap-seven-eta.vercel.app/'
  ],
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB Connected Successfully');
    db.seedAdmin();
  })
  .catch((err) => {
    console.error('MongoDB Connection Error:', err);
  });

// Root route to prevent blank page
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding: 50px;">
      <h1 style="color: #2d9e6e;">SkillSwap Backend API is running!</h1>
      <p>This is the backend API server. To view the user interface, please open the frontend link:</p>
      <p style="font-size: 18px; font-weight: bold;">
        <a href="http://localhost:5173" style="color: #1a6b4a; text-decoration: none;">👉 Open Frontend App (http://localhost:5173)</a>
      </p>
    </div>
  `);
});

// Auth Routes
app.post('/api/register', async (req, res) => {
  const { firstName, lastName, email, skillOffer, skillWant, password } = req.body;

  if (!firstName || !lastName || !email || !skillOffer || !skillWant || !password) {
    return res.status(400).json({ error: 'Please fill in all fields.' });
  }

  // try {
  //   const existingUser = await db.getUserByEmail(email);
  //   if (existingUser) {
  //     return res.status(400).json({ error: 'An account with this email already exists.' });
  //   }

  //   const fullName = `${firstName} ${lastName}`;
  //   const salt = await bcrypt.genSalt(10);
  //   const hashedPassword = await bcrypt.hash(password, salt);
    
  //   const newUser = await db.createUser({
  //     name: fullName,
  //     email,
  //     skillOffer,
  //     skillWant,
  //     password: hashedPassword
  //   });

  //   res.status(201).json({ success: true, user: newUser });
  // }// catch (error) {
  // //   console.error('Registration error:', error);
  // //   res.status(500).json({ error: 'An error occurred during registration.' });
  // // }
  // catch (error) {
  // console.error('Registration error:', error);
  try {
  console.log("1");
  const existingUser = await db.getUserByEmail(email);

  console.log("2");
  const fullName = `${firstName} ${lastName}`;

  console.log("3");
  const salt = await bcrypt.genSalt(10);

  console.log("4");
  const hashedPassword = await bcrypt.hash(password, salt);

  console.log("5");
  const newUser = await db.createUser({
    name: fullName,
    email,
    skillOffer,
    skillWant,
    password: hashedPassword
  });

  console.log("6");
  res.status(201).json({ success: true, user: newUser });

} catch (error) {
  console.error(error);
}

  res.status(500).json({
    error: 'An error occurred during registration.',
    message: error.message,
    stack: error.stack
  });
}
);

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    let isMatch = false;
    if (user.password && (user.password.startsWith('$2b$') || user.password.startsWith('$2a$'))) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = (password === user.password);
    }

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'An error occurred during login.' });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'No account found with that email address.' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `http://localhost:5173/?resetToken=${token}`;
    
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER || 'noreply@skillswap.com',
      subject: 'Skill Swap Password Reset',
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
        `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
        `${resetUrl}\n\n` +
        `If you did not request this, please ignore this email and your password will remain unchanged.\n`
    };

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await transporter.sendMail(mailOptions);
    } else {
      console.warn('Email credentials not configured. Token generated but email not sent. Reset URL:', resetUrl);
    }

    res.json({ success: true, message: 'Password reset link sent to your email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'An error occurred during forgot password process.' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required.' });

  try {
    const user = await mongoose.model('User').findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Your password has been successfully reset. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'An error occurred during password reset.' });
  }
});

// Profile Routes
app.get('/api/profile/me', async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ error: 'An error occurred while fetching profile.' });
  }
});

app.post('/api/profile/update', async (req, res) => {
  const { email, name, skillOffer, skillWant, bio } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const updatedUser = await db.updateUserProfile(email, { name, skillOffer, skillWant, bio });
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'An error occurred while updating profile.' });
  }
});

app.post('/api/profile/settings', async (req, res) => {
  const { email, settings } = req.body;
  if (!email || !settings) return res.status(400).json({ error: 'Email and settings required.' });
  try {
    const updated = await db.updateUserSettings(email, settings);
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

app.post('/api/profile/password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  if (!email || !currentPassword || !newPassword) return res.status(400).json({ error: 'Missing required fields.' });
  try {
    const user = await db.getUserByEmail(email);
    if (!user) return res.status(400).json({ error: 'Incorrect current password.' });
    
    let isMatch = false;
    if (user.password && (user.password.startsWith('$2b$') || user.password.startsWith('$2a$'))) {
      isMatch = await bcrypt.compare(currentPassword, user.password);
    } else {
      isMatch = (currentPassword === user.password);
    }
    
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    const updated = await db.updateUserPassword(email, hashedPassword);
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

app.post('/api/profile/email', async (req, res) => {
  const { email, newEmail } = req.body;
  if (!email || !newEmail) return res.status(400).json({ error: 'Missing required fields.' });
  try {
    const updated = await db.updateUserEmail(email, newEmail);
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Email update error:', error);
    res.status(400).json({ error: error.message || 'Failed to update email.' });
  }
});

app.post('/api/profile/photo', upload.single('photo'), async (req, res) => {
  const { email } = req.body;
  if (!email || !req.file) return res.status(400).json({ error: 'Email and photo are required.' });
  
  try {
    const photoUrl = `/uploads/${req.file.filename}`;
    const updated = await db.updateUserProfilePhoto(email, photoUrl);
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Photo update error:', error);
    res.status(500).json({ error: 'Failed to update photo.' });
  }
});

app.post('/api/profile/photo/remove', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  
  try {
    const updated = await db.updateUserProfilePhoto(email, '');
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Photo remove error:', error);
    res.status(500).json({ error: 'Failed to remove photo.' });
  }
});

app.post('/api/chat/upload', uploadChat.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = getFileType(req.file.mimetype, req.file.originalname);
    res.json({
      success: true,
      file: {
        fileUrl,
        fileName: req.file.originalname,
        fileType,
        fileSize: req.file.size
      }
    });
  } catch (error) {
    console.error('Chat file upload error:', error);
    res.status(500).json({ error: 'Failed to upload chat file.' });
  }
});

app.post('/api/profile/delete', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  
  try {
    const success = await db.deleteAccount(email);
    if (!success) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

// Matches Route
app.get('/api/matches', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email query parameter is required.' });
  }

  try {
    const matches = await db.getMatchesForUser(email);
    res.json({ success: true, matches });
  } catch (error) {
    console.error('Fetch matches error:', error);
    res.status(500).json({ error: 'An error occurred while fetching matches.' });
  }
});

// Search Skills Route
app.get('/api/search', async (req, res) => {
  const { query, type = 'all', email } = req.query;

  try {
    const results = await db.searchSkills(query, type, email);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Search skills error:', error);
    res.status(500).json({ error: 'An error occurred while searching skills.' });
  }
});

// Swap Request Routes
app.get('/api/requests', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const requests = await db.getSwapRequestsForUser(email);
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Fetch requests error:', error);
    res.status(500).json({ error: 'An error occurred while fetching swap requests.' });
  }
});

app.post('/api/requests/send', async (req, res) => {
  const { sender, receiver } = req.body;
  if (!sender || !receiver) return res.status(400).json({ error: 'Sender and receiver are required.' });

  try {
    const request = await db.createSwapRequest(sender, receiver);
    
    // Broadcast real-time socket event to receiver
    io.to(`global_${receiver.toLowerCase()}`).emit('new_notification', {
      type: 'request',
      text: `New swap request from ${sender}`
    });

    res.json({ success: true, request });
  } catch (error) {
    console.error('Send request error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/requests/update', async (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) return res.status(400).json({ error: 'Request ID and status are required.' });

  try {
    const updated = await db.updateSwapRequestStatus(id, status);
    
    if (updated) {
      // Broadcast real-time socket event to sender
      io.to(`global_${updated.sender.toLowerCase()}`).emit('new_notification', {
        type: 'request',
        text: `Swap request to ${updated.receiver} was ${status}!`
      });
      // Also notify receiver to trigger UI update
      io.to(`global_${updated.receiver.toLowerCase()}`).emit('new_notification', {
        type: 'request',
        text: `Swap request updated to ${status}!`
      });
    }

    res.json({ success: true, request: updated });
  } catch (error) {
    console.error('Update request error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Booking Session Routes
app.post('/api/bookings/create', async (req, res) => {
  const { requester, provider, date, time, topic } = req.body;
  if (!requester || !provider || !date || !time) return res.status(400).json({ error: 'All fields are required.' });

  try {
    const booking = await db.createBookingSession(requester, provider, date, time, topic);
    
    // Broadcast real-time socket event to provider
    io.to(`global_${provider.toLowerCase()}`).emit('new_notification', {
      type: 'booking',
      text: `${requester} requested a session with you!`
    });

    res.json({ success: true, booking });
  } catch (error) {
    console.error('Create booking error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/bookings', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const bookings = await db.getBookingSessionsForUser(email);
    res.json({ success: true, bookings });
  } catch (error) {
    console.error('Fetch bookings error:', error);
    res.status(500).json({ error: 'An error occurred while fetching bookings.' });
  }
});

app.post('/api/bookings/update', async (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) return res.status(400).json({ error: 'Booking ID and status are required.' });

  try {
    const updated = await db.updateBookingSessionStatus(id, status);
    
    if (updated) {
      if (status === 'accepted' || status === 'rejected') {
        io.to(`global_${updated.requester.toLowerCase()}`).emit('new_notification', {
          type: 'booking',
          text: `Your session booking request with ${updated.provider} was ${status}!`
        });
        io.to(`global_${updated.provider.toLowerCase()}`).emit('new_notification', {
          type: 'booking',
          text: `Session request updated to ${status}!`
        });
      } else if (status === 'completed') {
        io.to(`global_${updated.requester.toLowerCase()}`).emit('new_notification', {
          type: 'booking',
          text: `Session with ${updated.provider} was marked completed!`
        });
        io.to(`global_${updated.provider.toLowerCase()}`).emit('new_notification', {
          type: 'booking',
          text: `Session with ${updated.requester} was marked completed!`
        });
      }
    }

    res.json({ success: true, booking: updated });
  } catch (error) {
    console.error('Update booking error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Chatbot routes
app.get('/api/chatbot/sessions', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const sessions = await db.getChatSessions(email);
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Fetch chatbot sessions error:', error);
    res.status(500).json({ error: 'An error occurred while fetching chat sessions.' });
  }
});

app.post('/api/chatbot/sessions', async (req, res) => {
  const { email, sessions } = req.body;

  if (!email || !sessions) {
    return res.status(400).json({ error: 'Email and sessions are required.' });
  }

  try {
    await db.saveChatSessions(email, sessions);
    res.json({ success: true });
  } catch (error) {
    console.error('Save chatbot sessions error:', error);
    res.status(500).json({ error: 'An error occurred while saving chat sessions.' });
  }
});

// Chatbot Response Generation (Backend AI endpoint)
app.post('/api/chatbot/message', async (req, res) => {
  const { prompt, email, apiKey } = req.body;

  if (!prompt || !email) {
    return res.status(400).json({ error: 'Prompt and email are required.' });
  }

  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let botResponseText = '';
    const finalApiKey = process.env.GEMINI_API_KEY || apiKey;
    
    if (finalApiKey) {
      try {
        const genAI = new GoogleGenerativeAI(finalApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const promptText = `You are SkillSwap AI Coach, an expert assistant for a skill-sharing platform called SkillSwap. 
  The current user is:
  - Name: ${user.name}
  - Initial: ${user.initials}
  - Offers to teach: ${user.skillOffer || 'Web Development'}
  - Wants to learn: ${user.skillWant || 'Graphic Design'}
  
  Assist this user. Provide highly professional, helpful, and friendly advice about their learning, project ideas, message templates for other users (like Priya M. who teaches React), or profile optimization. Feel free to reply in any requested language. Keep code examples short and wrap them in markdown code blocks like \`\`\`javascript.
  
  User message: ${prompt}`;

        const result = await model.generateContent(promptText);
        botResponseText = result.response.text() || '';
        if (!botResponseText) {
          throw new Error('Empty response received from Gemini');
        }
      } catch (error) {
        console.error('Gemini API Error:', error.message);
        botResponseText = `**API Error Detected:** ${error.message}\n\n` + getOfflineResponse(prompt, user) + '\n\n*(Note: This response was simulated because Gemini API call failed.)*';
      }
    } else {
      botResponseText = getOfflineResponse(prompt, user);
    }

    res.json({ success: true, response: botResponseText });
  } catch (error) {
    console.error('Chatbot message error:', error);
    res.status(500).json({ error: 'An error occurred during chatbot processing.' });
  }
});

// Offline Response Generator
function getOfflineResponse(prompt, user) {
  const lowercasePrompt = prompt.toLowerCase();
  const offer = user.skillOffer || 'Web Development';
  const want = user.skillWant || 'Graphic Design';

  if (lowercasePrompt.includes('priya') || lowercasePrompt.includes('draft') || lowercasePrompt.includes('message') || lowercasePrompt.includes('request')) {
    return `Here is a custom, high-converting swap request message you can send to **Priya M.**:

\`\`\`markdown
Hi Priya,

I noticed you offer React Development and are looking to learn Graphic Design. 
I actually specialize in Graphic Design and am looking to improve my React Dev skills! 

I think we'd be a great match for a skill trade. How about we connect for a quick 10-minute chat to discuss how we might help each other?

Best regards,
${user.name}
\`\`\`

You can copy-paste this message directly in the **Matches** tab when you accept her request! Let me know if you want to modify any part of it.`;
  }

  if (lowercasePrompt.includes('road') || lowercasePrompt.includes('roadmap') || lowercasePrompt.includes('learn') || lowercasePrompt.includes('plan')) {
    return `Here is a personalized **4-Week learning roadmap** to master **${want}** by trading your **${offer}** skills:

**Week 1: Fundamental Principles & Setup**
- *Goal*: Grasp foundational concepts of **${want}**.
- *SkillSwap Session (1 hour)*: Have your swap partner introduce you to key workflows and recommended tools (software, libraries).
- *Action Item*: Complete 3 basic tutorials and share your work for review.

**Week 2: Hands-on Projects**
- *Goal*: Build practical components.
- *SkillSwap Session (1 hour)*: Do a live pair-work session. If you know **${offer}**, you can show them how to structure code, while they guide your design layout.
- *Action Item*: Build a simple portfolio project combining both your skills.

**Week 3: Feedback & Iteration**
- *Goal*: Refine your technique based on feedback.
- *SkillSwap Session (1 hour)*: Conduct a detailed review of each other's work from Week 2.
- *Action Item*: Implement corrections and optimize performance.

**Week 4: Capstone Exchange Project**
- *Goal*: Deploy a collaborative mini-app or project.
- *SkillSwap Session (1 hour)*: Present and test your joint project.
- *Action Item*: Publish the project and leave a 5-star swap review for each other!

Does this schedule work for you, or would you like to tweak the timeline?`;
  }

  if (lowercasePrompt.includes('profile') || lowercasePrompt.includes('bio') || lowercasePrompt.includes('optimize') || lowercasePrompt.includes('improve')) {
    return `Here are three steps to optimize your SkillSwap profile to attract more matches:

1. **Be Specific in your Offers**: Instead of just listing **"${offer}"**, write details in your Bio. For example: *"I can help you build responsive web layouts, explain flexbox/grid, and deploy React projects on Vercel."*
2. **Clear Learning Goals**: State exactly what parts of **"${want}"** you are excited about. For instance: *"Looking to learn vector illustration, typography hierarchies, and layout rules for mobile design."*
3. **Add Portfolio Links**: Mention 1 or 2 projects you have completed. This builds massive trust.

Would you like me to generate a personalized bio/about section text for you based on this advice?`;
  }

  if (lowercasePrompt.includes('project') || lowercasePrompt.includes('practice') || lowercasePrompt.includes('portfolio') || lowercasePrompt.includes('idea')) {
    return `Here are some excellent collaborative project ideas that combine **${offer}** and **${want}**:

1. **The Interactive Portfolio**:
   - *Concept*: Design a gorgeous portfolio using **${want}** principles and code it using **${offer}**.
   - *Swap Benefit*: You both get a high-quality portfolio item showing off your respective skills.

2. **A Landing Page Template**:
   - *Concept*: Build a conversion-focused landing page where your partner designs the branding, and you develop the site.
   - *Swap Benefit*: Real-world experience collaborating on a design-to-development handoff.

3. **Interactive Skill Cards Game**:
   - *Concept*: A fun web card game teaching basic elements of design and development.
   - *Swap Benefit*: A great micro-project that can be completed in a single weekend.

Which of these would you like to start first? I can help you draft a project scope!`;
  }

  if (lowercasePrompt.includes('hello') || lowercasePrompt.includes('hi') || lowercasePrompt.includes('hey') || lowercasePrompt.includes('greet')) {
    return `Hello ${user.name}! 👋 I am your **SkillSwap AI Assistant**. 

I can help you:
- 🚀 Create customized learning roadmaps for **${want}**
- 📝 Draft personalized swap request messages to matches (like Priya M.)
- 💡 Brainstorm collaborative project ideas
- ⚙️ Optimize your profile bio for more matches

What would you like to work on today? Select one of the quick suggestions below or type your question!`;
  }

  return `That is a great question! Since you specialize in **${offer}** and are currently looking to learn **${want}**, we can approach this in a couple of ways:

1. **Leverage Your Strengths**: How can you apply your knowledge of **${offer}** to make learning **${want}** easier?
2. **Collaborative Trade**: Find a match in your **Matches** tab who has opposite needs, and design a custom lesson plan.

Could you elaborate a bit more on what specific topic or question you have about **${want}**? I want to make sure I give you the most accurate advice!`;
}

// Admin Routes

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Fetch users admin error:', error);
    res.status(500).json({ error: 'An error occurred while fetching users.' });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, skillOffer, skillWant, rating, exchanges, bio } = req.body;
  try {
    const updated = await db.updateUserById(id, { name, email, skillOffer, skillWant, rating, exchanges, bio });
    if (!updated) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Update user admin error:', error);
    res.status(500).json({ error: 'An error occurred while updating user.' });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await db.deleteUser(id);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Delete user admin error:', error);
    res.status(500).json({ error: 'An error occurred while deleting user.' });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    const totalUsers = users.length;
    
    let totalExchanges = 0;
    let totalRating = 0;
    const skillsOfferCounts = {};
    const skillsWantCounts = {};

    users.forEach(u => {
      totalExchanges += (u.exchanges || 0);
      totalRating += (u.rating || 5.0);
      if (u.skillOffer) {
        skillsOfferCounts[u.skillOffer] = (skillsOfferCounts[u.skillOffer] || 0) + 1;
      }
      if (u.skillWant) {
        skillsWantCounts[u.skillWant] = (skillsWantCounts[u.skillWant] || 0) + 1;
      }
    });

    const averageRating = totalUsers > 0 ? (totalRating / totalUsers).toFixed(2) : '5.0';

    // Sort offered skills
    const offeredSkills = Object.entries(skillsOfferCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    
    // Sort wanted skills
    const wantedSkills = Object.entries(skillsWantCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalExchanges,
        averageRating,
        offeredSkills,
        wantedSkills
      }
    });
  } catch (error) {
    console.error('Fetch stats admin error:', error);
    res.status(500).json({ error: 'An error occurred while fetching stats.' });
  }
});

app.post('/api/admin/seed', async (req, res) => {
  try {
    const seedPath = path.join(__dirname, 'db.json');
    let seededCount = 0;
    if (fs.existsSync(seedPath)) {
      const fileContent = fs.readFileSync(seedPath, 'utf8');
      const data = JSON.parse(fileContent);
      if (data.users && Array.isArray(data.users)) {
        seededCount = await db.seedDatabase(data.users);
      }
    }
    res.json({ success: true, seededCount });
  } catch (error) {
    console.error('Seed database error:', error);
    res.status(500).json({ error: 'An error occurred while seeding database.' });
  }
});

app.post('/api/admin/wipe', async (req, res) => {
  try {
    const result = await db.wipeDatabase();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Wipe database error:', error);
    res.status(500).json({ error: 'An error occurred while wiping database.' });
  }
});

// Fetch chat history between two users
app.get('/api/chat/history', async (req, res) => {
  const { user1, user2 } = req.query;
  if (!user1 || !user2) {
    return res.status(400).json({ error: 'Both user1 and user2 emails are required.' });
  }

  try {
    const history = await db.getChatMessages(user1, user2);
    res.json({ success: true, history });
  } catch (error) {
    console.error('Fetch chat history error:', error);
    res.status(500).json({ error: 'An error occurred while fetching chat history.' });
  }
});

// FCM Token Storage
app.post('/api/fcm-token', async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) return res.status(400).json({ error: 'Email and token required.' });
  try {
    await db.saveFcmToken(email, token);
    res.json({ success: true });
  } catch (error) {
    console.error('Save FCM token error:', error);
    res.status(500).json({ error: 'Failed to save token.' });
  }
});

// Socket.io Events Setup
io.on('connection', (socket) => {
  console.log('User connected to socket:', socket.id);

  socket.on('join_global', (email) => {
    if (!email) return;
    socket.join(`global_${email.toLowerCase()}`);
    console.log(`Socket ${socket.id} joined global room: global_${email.toLowerCase()}`);
  });

  socket.on('join_room', ({ sender, receiver }) => {
    if (!sender || !receiver) return;
    const room = [sender.toLowerCase(), receiver.toLowerCase()].sort().join('_');
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('send_message', async ({ sender, receiver, message, file }) => {
    if (!sender || !receiver) return;
    if (!message && !file) return;
    try {
      const room = [sender.toLowerCase(), receiver.toLowerCase()].sort().join('_');
      const chatMsg = await db.saveChatMessage(sender, receiver, message, file);
      io.to(room).emit('receive_message', chatMsg);
      
      // Send a notification to the receiver globally
      io.to(`global_${receiver.toLowerCase()}`).emit('new_notification', {
        type: 'message',
        text: `New message from ${sender}`
      });
    } catch (e) {
      console.error('Error in send_message socket event:', e);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected from socket:', socket.id);
  });
});

// Start Server
server.listen(PORT, async () => {
  console.log(`Express server with Socket.io is running on http://localhost:${PORT}`);
  
  // Initialize Background Cron Jobs
  initCronJobs(admin && admin.apps && admin.apps.length > 0 ? admin : null);
});
