const express = require('express');
const router = express.Router();
const db = require('./db.cjs');

// Strict Admin Verification Middleware
const verifyAdmin = async (req, res, next) => {
  try {
    // We expect the admin's email in the 'x-admin-email' header for backend-to-backend or secure frontend calls
    const adminEmail = req.headers['x-admin-email'];
    
    if (!adminEmail) {
      return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }

    const adminUser = await db.User.findOne({ email: adminEmail });
    
    // Strict admin check
    if (!adminUser || (adminUser.email !== 'admin@skillswap.com' && adminUser.role !== 'ADMIN')) {
      // Log unauthorized attempt
      await db.AdminLog.create({
        adminEmail: adminEmail || 'Unknown',
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        targetUser: 'N/A',
        details: { path: req.path },
        ipAddress: req.ip
      });
      return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }

    // Attach admin to request
    req.admin = adminUser;
    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(500).json({ error: 'Internal server error during authorization.' });
  }
};

// Apply middleware to all routes in this router
router.use(verifyAdmin);

// Helper to log admin actions
const logAdminAction = async (adminEmail, action, targetUser, details, ipAddress) => {
  try {
    await db.AdminLog.create({
      adminEmail,
      action,
      targetUser,
      details,
      ipAddress
    });
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
};

// 1. Get all users with membership details
router.get('/users', async (req, res) => {
  try {
    const users = await db.User.find({}, 'name email membershipType paymentStatus assessmentLimit assessmentRemaining assessmentAttemptCount premiumExpiry isPremium').lean();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Fetch premium users error:', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// 2. Update membership (Upgrade/Downgrade, Approve/Reject, Limits)
router.post('/update-membership', async (req, res) => {
  try {
    const { 
      userEmail, 
      action, // 'UPGRADE', 'DOWNGRADE', 'APPROVE', 'REJECT', 'UPDATE_LIMIT', 'RESET_COUNT'
      newLimit 
    } = req.body;

    if (!userEmail || !action) {
      return res.status(400).json({ error: 'User email and action are required.' });
    }

    const targetUser = await db.User.findOne({ email: userEmail });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    let updates = {};
    let actionDetails = {};

    switch (action) {
      case 'UPGRADE':
      case 'APPROVE':
        updates.membershipType = 'PREMIUM';
        updates.paymentStatus = 'paid';
        updates.isPremium = true; // legacy support
        if (action === 'UPGRADE') {
          updates.assessmentLimit = Math.max(targetUser.assessmentLimit || 0, 5); 
          // Give 30 days expiry by default if none exists
          if (!targetUser.premiumExpiry) {
             const expiry = new Date();
             expiry.setDate(expiry.getDate() + 30);
             updates.premiumExpiry = expiry;
          }
        }
        break;
      case 'DOWNGRADE':
      case 'REJECT':
        updates.membershipType = 'FREE';
        updates.paymentStatus = action === 'REJECT' ? 'rejected' : 'unpaid';
        updates.isPremium = false;
        break;
      case 'UPDATE_LIMIT':
        if (typeof newLimit !== 'number' || newLimit < 0) {
          return res.status(400).json({ error: 'Valid new limit is required.' });
        }
        updates.assessmentLimit = newLimit;
        actionDetails.newLimit = newLimit;
        break;
      case 'RESET_COUNT':
        updates.assessmentCreatedCount = 0;
        updates.assessmentAttemptCount = 0;
        updates.assessmentRemaining = targetUser.assessmentLimit;
        break;
      default:
        return res.status(400).json({ error: 'Invalid action.' });
    }

    // Apply updates
    Object.assign(targetUser, updates);
    await targetUser.save();

    // Log the action
    await logAdminAction(req.admin.email, action, userEmail, actionDetails, req.ip);

    res.json({ success: true, message: `Successfully performed ${action} on ${userEmail}.`, user: targetUser });
  } catch (error) {
    console.error('Update membership error:', error);
    res.status(500).json({ error: 'Failed to update membership.' });
  }
});

// 3. Get all payment records (Admin only view)
router.get('/payment/records', async (req, res) => {
  try {
    const payments = await db.Payment.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, payments });
  } catch (error) {
    console.error('Fetch payment records error:', error);
    res.status(500).json({ error: 'Failed to fetch payment records.' });
  }
});

// 4. Get Admin Activity Logs
router.get('/logs', async (req, res) => {
  try {
    const logs = await db.AdminLog.find({}).sort({ timestamp: -1 }).limit(100).lean();
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Fetch admin logs error:', error);
    res.status(500).json({ error: 'Failed to fetch admin logs.' });
  }
});

module.exports = router;
