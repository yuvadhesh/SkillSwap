const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  initials: { type: String, required: true },
  skillOffer: { type: String },
  skillWant: { type: String },
  password: { type: String, required: true },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  bio: { type: String },
  rating: { type: Number, default: 5.0 },
  exchanges: { type: Number, default: 0 },
  memberSince: { type: Number, default: () => new Date().getFullYear() },
  fcmTokens: { type: [String], default: [] },
  profilePhoto: { type: String, default: '' },
  settings: {
    type: Object,
    default: {
      visibility: true,
      matchRequests: true,
      messages: true,
      weeklyDigest: false
    }
  }
});

// ChatSession Schema
const chatSessionSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  sessions: { type: Array, default: [] }
});

// SwapRequest Schema
const swapRequestSchema = new mongoose.Schema({
  sender: { type: String, required: true, lowercase: true, trim: true },
  receiver: { type: String, required: true, lowercase: true, trim: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

// ChatMessage Schema (One-to-One Chat Persistence)
const chatMessageSchema = new mongoose.Schema({
  sender: { type: String, required: true, lowercase: true, trim: true },
  receiver: { type: String, required: true, lowercase: true, trim: true },
  message: { type: String, default: '' },
  fileUrl: { type: String },
  fileName: { type: String },
  fileType: { type: String },
  fileSize: { type: Number },
  timestamp: { type: Date, default: Date.now }
});

// BookingSession Schema
const bookingSessionSchema = new mongoose.Schema({
  requester: { type: String, required: true, lowercase: true, trim: true },
  provider: { type: String, required: true, lowercase: true, trim: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  topic: { type: String, default: 'Skill Swap Session' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'completed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const ChatSession = mongoose.model('ChatSession', chatSessionSchema);
const SwapRequest = mongoose.model('SwapRequest', swapRequestSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
const BookingSession = mongoose.model('BookingSession', bookingSessionSchema);

// User CRUD Helpers
async function getUserByEmail(email) {
  if (!email) return null;
  return await User.findOne({ email: email.toLowerCase() });
}

async function createUser(userData) {
  const initials = (userData.firstName && userData.lastName) 
    ? (userData.firstName[0] + userData.lastName[0]).toUpperCase()
    : userData.name.split(' ').map(n => n[0]).join('').toUpperCase();
  
  const newUser = new User({
    name: userData.name,
    email: userData.email,
    initials,
    skillOffer: userData.skillOffer,
    skillWant: userData.skillWant,
    password: userData.password,
    bio: userData.bio || `Passionate about sharing my knowledge in ${userData.skillOffer} and learning ${userData.skillWant}.`,
    rating: 5.0,
    exchanges: 0,
    memberSince: new Date().getFullYear(),
    profilePhoto: '',
    settings: {
      visibility: true,
      matchRequests: true,
      messages: true,
      weeklyDigest: false
    }
  });

  await newUser.save();
  return newUser;
}

async function updateUserProfile(email, updatedData) {
  if (!email) return null;
  return await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: updatedData },
    { new: true }
  );
}

async function updateUserSettings(email, settingsData) {
  if (!email) return null;
  return await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { settings: settingsData } },
    { new: true }
  );
}

async function updateUserProfilePhoto(email, photoUrl) {
  if (!email) return null;
  return await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { profilePhoto: photoUrl } },
    { new: true }
  );
}

async function updateUserPassword(email, newPassword) {
  if (!email || !newPassword) return null;
  return await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { password: newPassword } },
    { new: true }
  );
}

async function updateUserEmail(oldEmail, newEmail) {
  if (!oldEmail || !newEmail) return null;
  const oldEmailLower = oldEmail.toLowerCase();
  const newEmailLower = newEmail.toLowerCase();

  // Check if new email is already taken
  const exists = await User.findOne({ email: newEmailLower });
  if (exists) throw new Error('Email is already taken');

  // Update User
  const updatedUser = await User.findOneAndUpdate(
    { email: oldEmailLower },
    { $set: { email: newEmailLower } },
    { new: true }
  );
  if (!updatedUser) throw new Error('User not found');

  // Update all related collections
  await ChatSession.findOneAndUpdate(
    { email: oldEmailLower },
    { $set: { email: newEmailLower } }
  );
  
  await SwapRequest.updateMany(
    { sender: oldEmailLower },
    { $set: { sender: newEmailLower } }
  );
  await SwapRequest.updateMany(
    { receiver: oldEmailLower },
    { $set: { receiver: newEmailLower } }
  );

  await ChatMessage.updateMany(
    { sender: oldEmailLower },
    { $set: { sender: newEmailLower } }
  );
  await ChatMessage.updateMany(
    { receiver: oldEmailLower },
    { $set: { receiver: newEmailLower } }
  );

  await BookingSession.updateMany(
    { requester: oldEmailLower },
    { $set: { requester: newEmailLower } }
  );
  await BookingSession.updateMany(
    { provider: oldEmailLower },
    { $set: { provider: newEmailLower } }
  );

  return updatedUser;
}

// Match Score Calculator Helper
async function getMatchesForUser(email) {
  const currentUser = await getUserByEmail(email);
  if (!currentUser) return [];

  const allUsers = await User.find({});
  const matches = [];

  allUsers.forEach(otherUser => {
    // Skip self or users who have visibility turned off
    if (otherUser.email.toLowerCase() === currentUser.email.toLowerCase()) return;
    if (otherUser.settings && otherUser.settings.visibility === false) return;

    let score = 45; // Base score for some alignment or remote potential
    
    const currentOffer = currentUser.skillOffer?.toLowerCase() || '';
    const currentWant = currentUser.skillWant?.toLowerCase() || '';
    const otherOffer = otherUser.skillOffer?.toLowerCase() || '';
    const otherWant = otherUser.skillWant?.toLowerCase() || '';

    const directMutualMatch = (currentOffer === otherWant && currentWant === otherOffer);
    const halfMatchWant = (currentWant === otherOffer);
    const halfMatchOffer = (currentOffer === otherWant);

    if (directMutualMatch) {
      score = 98;
    } else if (halfMatchWant) {
      score = 88;
    } else if (halfMatchOffer) {
      score = 78;
    } else if (currentWant.includes(otherOffer) || otherOffer.includes(currentWant)) {
      score = 70;
    } else if (currentOffer.includes(otherWant) || otherWant.includes(currentOffer)) {
      score = 65;
    }

    // Only return matches with score > 50 to make recommendation relevant
    if (score >= 50) {
      // Setup bg styling class mock representation
      let bg = 'bg-[#1a6b4a]'; // green
      if (score < 90 && score >= 75) bg = 'bg-[#185fa5]'; // blue
      if (score < 75) bg = 'bg-[#c87400]'; // orange

      matches.push({
        name: otherUser.name,
        email: otherUser.email,
        initials: otherUser.initials,
        profilePhoto: otherUser.profilePhoto,
        title: `${otherUser.skillOffer} Tutor • ${otherUser.email.includes('chennai') ? 'Chennai' : 'Remote'}`,
        offers: otherUser.skillOffer,
        wants: otherUser.skillWant,
        match: score,
        bg: bg
      });
    }
  });

  // Sort match scores descending
  return matches.sort((a, b) => b.match - a.match);
}

// Chat Session Helpers
async function getChatSessions(email) {
  if (!email) return [];
  const sessionDoc = await ChatSession.findOne({ email: email.toLowerCase() });
  return sessionDoc ? sessionDoc.sessions : [];
}

async function saveChatSessions(email, sessions) {
  if (!email) return;
  await ChatSession.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { sessions } },
    { upsert: true, new: true }
  );
}

async function getAllUsers() {
  return await User.find({});
}

// Swap Request Helpers
async function createSwapRequest(sender, receiver) {
  if (!sender || !receiver) throw new Error('Sender and receiver required');
  
  // Check if a request already exists between these two users (in either direction)
  const existing = await SwapRequest.findOne({
    $or: [
      { sender: sender.toLowerCase(), receiver: receiver.toLowerCase() },
      { sender: receiver.toLowerCase(), receiver: sender.toLowerCase() }
    ]
  });

  if (existing) {
    throw new Error('A swap request already exists between these users.');
  }

  const request = new SwapRequest({
    sender: sender.toLowerCase(),
    receiver: receiver.toLowerCase(),
    status: 'pending'
  });
  await request.save();
  return request;
}

async function getSwapRequestsForUser(email) {
  if (!email) return { incoming: [], outgoing: [] };
  const lowerEmail = email.toLowerCase();
  
  const allIncoming = await SwapRequest.find({ receiver: lowerEmail }).sort({ createdAt: -1 });
  const allOutgoing = await SwapRequest.find({ sender: lowerEmail }).sort({ createdAt: -1 });
  
  return { incoming: allIncoming, outgoing: allOutgoing };
}

async function getAllSwapRequests() {
  return await SwapRequest.find({});
}

async function updateSwapRequestStatus(id, newStatus) {
  if (!['accepted', 'rejected'].includes(newStatus)) {
    throw new Error('Invalid status');
  }
  return await SwapRequest.findByIdAndUpdate(id, { $set: { status: newStatus } }, { new: true });
}

async function deleteUser(id) {
  return await User.findByIdAndDelete(id);
}

async function deleteAccount(email) {
  if (!email) return false;
  const lowerEmail = email.toLowerCase();
  
  const user = await User.findOneAndDelete({ email: lowerEmail });
  if (!user) return false;

  await ChatSession.findOneAndDelete({ email: lowerEmail });
  await SwapRequest.deleteMany({ $or: [{ sender: lowerEmail }, { receiver: lowerEmail }] });
  await ChatMessage.deleteMany({ $or: [{ sender: lowerEmail }, { receiver: lowerEmail }] });
  await BookingSession.deleteMany({ $or: [{ requester: lowerEmail }, { provider: lowerEmail }] });

  return true;
}

async function updateUserById(id, data) {
  if (data.name && !data.initials) {
    data.initials = data.name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase();
  }
  return await User.findByIdAndUpdate(id, { $set: data }, { new: true });
}

async function seedDatabase(usersData) {
  let seededCount = 0;
  for (const u of usersData) {
    const exists = await getUserByEmail(u.email);
    if (!exists) {
      const initials = u.initials || u.name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase();
      const newUser = new User({
        name: u.name,
        email: u.email.toLowerCase(),
        initials,
        skillOffer: u.skillOffer,
        skillWant: u.skillWant,
        password: u.password || 'password123',
        bio: u.bio || `Passionate about sharing my knowledge in ${u.skillOffer} and learning ${u.skillWant}.`,
        rating: u.rating || 5.0,
        exchanges: u.exchanges || 0,
        memberSince: u.memberSince || new Date().getFullYear()
      });
      await newUser.save();
      seededCount++;
    }
  }
  return seededCount;
}

async function wipeDatabase() {
  const userRes = await User.deleteMany({ email: { $ne: 'admin@skillswap.com' } });
  const chatRes = await ChatSession.deleteMany({});
  return {
    deletedUsers: userRes.deletedCount,
    deletedChats: chatRes.deletedCount
  };
}

async function seedAdmin() {
  const exists = await getUserByEmail('admin@skillswap.com');
  if (!exists) {
    await createUser({
      name: 'System Admin',
      email: 'admin@skillswap.com',
      skillOffer: '',
      skillWant: '',
      password: 'admin123',
      bio: 'System Administrator account. Manage and monitor platform activities.'
    });
    console.log('Admin user successfully seeded (admin@skillswap.com / admin123)');
  }
}

async function searchSkills(queryStr, type = 'all', currentUserEmail = '') {
  const queryObj = {};

  const excludedEmails = ['admin@skillswap.com'];
  if (currentUserEmail) {
    excludedEmails.push(currentUserEmail.toLowerCase());
  }
  queryObj.email = { $nin: excludedEmails };

  // Exclude users who have turned off profile visibility
  queryObj['settings.visibility'] = { $ne: false };

  if (queryStr) {
    const escapedQuery = queryStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'i');
    if (type === 'offer') {
      queryObj.skillOffer = regex;
    } else if (type === 'want') {
      queryObj.skillWant = regex;
    } else {
      queryObj.$or = [
        { skillOffer: regex },
        { skillWant: regex }
      ];
    }
  }

  const users = await User.find(queryObj);
  
  return users.map(otherUser => {
    let bg = 'bg-[#185fa5]'; // default blue
    if (otherUser.rating && otherUser.rating >= 4.8) {
      bg = 'bg-[#1a6b4a]'; // green
    } else if (otherUser.rating && otherUser.rating < 4.5) {
      bg = 'bg-[#c87400]'; // orange
    }

    return {
      name: otherUser.name,
      email: otherUser.email,
      initials: otherUser.initials,
      profilePhoto: otherUser.profilePhoto,
      title: `${otherUser.skillOffer} Tutor • ${otherUser.email.includes('chennai') ? 'Chennai' : 'Remote'}`,
      offers: otherUser.skillOffer,
      wants: otherUser.skillWant,
      bio: otherUser.bio || `Passionate about sharing my knowledge in ${otherUser.skillOffer} and learning ${otherUser.skillWant}.`,
      rating: otherUser.rating || 5.0,
      exchanges: otherUser.exchanges || 0,
      bg: bg
    };
  });
}

async function saveChatMessage(sender, receiver, message, fileData = null) {
  if (!sender || !receiver) throw new Error('Sender and receiver are required.');
  const msgData = {
    sender: sender.toLowerCase(),
    receiver: receiver.toLowerCase(),
    message: message || ''
  };
  if (fileData) {
    msgData.fileUrl = fileData.fileUrl;
    msgData.fileName = fileData.fileName;
    msgData.fileType = fileData.fileType;
    msgData.fileSize = fileData.fileSize;
  }
  const msg = new ChatMessage(msgData);
  await msg.save();
  return msg;
}

async function getChatMessages(user1, user2) {
  if (!user1 || !user2) return [];
  const u1 = user1.toLowerCase();
  const u2 = user2.toLowerCase();
  return await ChatMessage.find({
    $or: [
      { sender: u1, receiver: u2 },
      { sender: u2, receiver: u1 }
    ]
  }).sort({ timestamp: 1 });
}

// Booking Session Helpers
async function createBookingSession(requester, provider, date, time, topic) {
  if (!requester || !provider || !date || !time) throw new Error('Missing required booking fields');
  const booking = new BookingSession({
    requester: requester.toLowerCase(),
    provider: provider.toLowerCase(),
    date,
    time,
    topic: topic || 'Skill Swap Session',
    status: 'pending'
  });
  await booking.save();
  return booking;
}

async function getBookingSessionsForUser(email) {
  if (!email) return { incoming: [], outgoing: [] };
  const lowerEmail = email.toLowerCase();
  
  const allIncoming = await BookingSession.find({ provider: lowerEmail }).sort({ date: 1, time: 1 });
  const allOutgoing = await BookingSession.find({ requester: lowerEmail }).sort({ date: 1, time: 1 });
  
  return { incoming: allIncoming, outgoing: allOutgoing };
}

async function getAllBookingSessions() {
  return await BookingSession.find({});
}

async function updateBookingSessionStatus(id, newStatus) {
  if (!['accepted', 'rejected', 'completed'].includes(newStatus)) {
    throw new Error('Invalid booking status');
  }
  const updated = await BookingSession.findByIdAndUpdate(id, { $set: { status: newStatus } }, { new: true });
  
  if (newStatus === 'completed' && updated) {
    await User.findOneAndUpdate({ email: updated.requester }, { $inc: { exchanges: 1 } });
    await User.findOneAndUpdate({ email: updated.provider }, { $inc: { exchanges: 1 } });
  }
  
  return updated;
}

// FCM Token Helpers
async function saveFcmToken(email, token) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    if (!user.fcmTokens.includes(token)) {
      user.fcmTokens.push(token);
      await user.save();
    }
  }
}

async function getUserFcmTokens(email) {
  const user = await User.findOne({ email: email.toLowerCase() });
  return user ? user.fcmTokens : [];
}

module.exports = {
  getUserByEmail,
  createUser,
  updateUserProfile,
  getMatchesForUser,
  getChatSessions,
  saveChatSessions,
  getAllUsers,
  deleteUser,
  updateUserById,
  seedDatabase,
  wipeDatabase,
  seedAdmin,
  createSwapRequest,
  getSwapRequestsForUser,
  getAllSwapRequests,
  updateSwapRequestStatus,
  searchSkills,
  saveChatMessage,
  getChatMessages,
  createBookingSession,
  getBookingSessionsForUser,
  getAllBookingSessions,
  updateBookingSessionStatus,
  saveFcmToken,
  getUserFcmTokens,
  updateUserSettings,
  updateUserPassword,
  updateUserEmail,
  updateUserProfilePhoto,
  deleteAccount
};
