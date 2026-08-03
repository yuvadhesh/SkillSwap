const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('./db.cjs');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_admin_jwt_secret_skillswap_123';

// Mock endpoint to generate a token for an admin
router.post('/login-token', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  
  const user = await db.getUserByEmail(email);
  if (!user || (user.email !== 'admin@skillswap.com' && user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Only admins can generate a token' });
  }

  const token = jwt.sign(
    { email: user.email, role: 'ADMIN' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({ success: true, token });
});

// Middleware to verify JWT, Role, Admin Permission
const verifyAdminJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ error: 'Missing or invalid authorization header.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || decoded.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    console.error('JWT Verification error:', err);
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

router.get('/', verifyAdminJWT, async (req, res) => {
  try {
    const priceDoc = await db.getPremiumPrice();
    res.json({ success: true, price: priceDoc });
  } catch (error) {
    console.error('Fetch premium price error:', error);
    res.status(500).json({ error: 'Failed to fetch premium price.' });
  }
});

router.put('/', verifyAdminJWT, async (req, res) => {
  try {
    const { premiumPrice } = req.body;
    if (typeof premiumPrice !== 'number' || premiumPrice < 0) {
      return res.status(400).json({ error: 'Valid premium price is required.' });
    }

    const updatedPriceDoc = await db.updatePremiumPrice(premiumPrice, req.admin.email);
    
    res.json({ success: true, message: 'Premium price updated successfully.', price: updatedPriceDoc });
  } catch (error) {
    console.error('Update premium price error:', error);
    res.status(500).json({ error: 'Failed to update premium price.' });
  }
});

module.exports = router;
