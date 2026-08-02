const express = require('express');
const router = express.Router();
const db = require('./db.cjs');

const crypto = require('crypto');

// POST /api/payments/verify-razorpay
router.post('/verify-razorpay', async (req, res) => {
  try {
    const { email, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    if (!email || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required payment verification fields.' });
    }

    // Verify signature
    const secret = process.env.RAZORPAY_SECRET || 'dummy_secret';
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    // Strict signature check (allowing 'mock_signature' for testing UI without real Razorpay)
    if (generated_signature !== razorpay_signature && razorpay_signature !== 'mock_signature') {
      return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
    }

    // Prevent Replay Attacks (duplicate transactions)
    const existingPayment = await db.Payment.findOne({ transactionId: razorpay_payment_id });
    if (existingPayment) {
      return res.status(400).json({ error: 'Payment already processed. Duplicate transaction.' });
    }

    const user = await db.User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Save transaction record
    const payment = new db.Payment({
      email: email.toLowerCase(),
      transactionId: razorpay_payment_id,
      amount: amount || 49,
      status: 'success',
      createdAt: new Date()
    });
    await payment.save();
    
    // Update user properties securely on backend
    user.paymentStatus = 'paid';
    user.membershipType = 'PREMIUM';
    user.isPremium = true; 
    user.paymentCount += 1;
    user.transactionId = razorpay_payment_id;
    user.paymentDate = new Date();

    // Default premium expiry to +30 days if not set
    if (!user.premiumExpiry) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      user.premiumExpiry = expiry;
    }
    
    // Log payment in history
    user.paymentHistory.push({
      transactionId: razorpay_payment_id,
      amount: amount || 49,
      date: new Date()
    });

    await user.save();

    res.json({ success: true, message: 'Payment verified and Premium activated successfully.' });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ error: 'Internal server error during verification.' });
  }
});

// GET /api/payments/history
router.get('/history', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required.' });
    }
    const payments = await db.Payment.find({ email: email.toLowerCase() }).sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (err) {
    console.error('Fetch payment history error:', err);
    res.status(500).json({ error: 'Internal server error occurred while retrieving payment history.' });
  }
});

// GET /api/payments/admin/all
router.get('/admin/all', async (req, res) => {
  try {
    const payments = await db.Payment.find({}).sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (err) {
    console.error('Fetch all payments error:', err);
    res.status(500).json({ error: 'Internal server error occurred while retrieving platform payments.' });
  }
});

module.exports = router;
