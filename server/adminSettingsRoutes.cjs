const express = require('express');
const router = express.Router();
const db = require('./db.cjs');

// Simple admin verification middleware (matches existing admin route pattern)
const verifyAdmin = async (req, res, next) => {
  const adminEmail = (req.body?.adminEmail || req.headers['x-admin-email'] || req.query?.adminEmail || '').toLowerCase();
  if (!adminEmail) {
    return res.status(403).json({ error: 'Admin email is required.' });
  }
  if (adminEmail === 'admin@skillswap.com') {
    req.adminEmail = adminEmail;
    return next();
  }
  try {
    const user = await db.getUserByEmail(adminEmail);
    if (!user || (user.email !== 'admin@skillswap.com' && user.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    req.adminEmail = adminEmail;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify admin.' });
  }
};

// GET /api/admin/settings — fetch current admin settings (public so UI can check if premium is required)
router.get('/', async (req, res) => {
  try {
    const settingsDoc = await db.getAdminSettings();
    res.json({ success: true, settings: settingsDoc });
  } catch (error) {
    console.error('Fetch admin settings error:', error);
    res.json({ success: true, settings: { assessmentCreationAccess: 'FREE', assessmentWritingAccess: 'FREE', freeAssessmentLimit: 1, premiumAssessmentLimit: 9999 } });
  }
});

// PUT /api/admin/settings — update settings (admin only)
router.put('/', verifyAdmin, async (req, res) => {
  try {
    const { 
      assessmentCreationAccess, 
      assessmentWritingAccess, 
      freeAssessmentLimit, 
      premiumAssessmentLimit,
      maxTabSwitches,
      maxFullscreenExits,
      maxCopyAttempts,
      maxAiDetectionWarnings,
      autoSubmit,
      terminateAssessment
    } = req.body;
    
    // We only update fields that are provided
    const updates = {};
    if (assessmentCreationAccess) updates.assessmentCreationAccess = assessmentCreationAccess;
    if (assessmentWritingAccess) updates.assessmentWritingAccess = assessmentWritingAccess;
    if (typeof freeAssessmentLimit === 'number') updates.freeAssessmentLimit = freeAssessmentLimit;
    if (typeof premiumAssessmentLimit === 'number') updates.premiumAssessmentLimit = premiumAssessmentLimit;
    if (typeof maxTabSwitches === 'number') updates.maxTabSwitches = maxTabSwitches;
    if (typeof maxFullscreenExits === 'number') updates.maxFullscreenExits = maxFullscreenExits;
    if (typeof maxCopyAttempts === 'number') updates.maxCopyAttempts = maxCopyAttempts;
    if (typeof maxAiDetectionWarnings === 'number') updates.maxAiDetectionWarnings = maxAiDetectionWarnings;
    if (typeof autoSubmit === 'boolean') updates.autoSubmit = autoSubmit;
    if (typeof terminateAssessment === 'boolean') updates.terminateAssessment = terminateAssessment;

    const updatedSettingsDoc = await db.updateAdminSettings(updates, req.adminEmail);
    res.json({ success: true, message: 'Admin settings updated successfully.', settings: updatedSettingsDoc });
  } catch (error) {
    console.error('Update admin settings error:', error);
    res.status(500).json({ error: 'Failed to update admin settings.' });
  }
});

module.exports = router;
