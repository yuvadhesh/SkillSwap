const express = require('express');
const router = express.Router();
const db = require('./db.cjs');

// Simple admin verification middleware (matches existing admin route pattern)
const verifyAdmin = async (req, res, next) => {
  const adminEmail = req.headers['x-admin-email'] || req.body?.adminEmail;
  if (!adminEmail) {
    return res.status(403).json({ error: 'Admin email is required.' });
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

// GET /api/admin/premium-price — fetch current price (public)
router.get('/', async (req, res) => {
  try {
    const priceDoc = await db.getPremiumPrice();
    res.json({ success: true, price: priceDoc });
  } catch (error) {
    console.error('Fetch premium price error:', error);
    res.status(500).json({ error: 'Failed to fetch premium price.' });
  }
});

// PUT /api/admin/premium-price — update price (admin only)
router.put('/', verifyAdmin, async (req, res) => {
  try {
    const { premiumPrice } = req.body;
    if (typeof premiumPrice !== 'number' || premiumPrice < 0) {
      return res.status(400).json({ error: 'Valid premium price is required.' });
    }
    const updatedPriceDoc = await db.updatePremiumPrice(premiumPrice, req.adminEmail);
    res.json({ success: true, message: 'Premium price updated successfully.', price: updatedPriceDoc });
  } catch (error) {
    console.error('Update premium price error:', error);
    res.status(500).json({ error: 'Failed to update premium price.' });
  }
});

module.exports = router;
