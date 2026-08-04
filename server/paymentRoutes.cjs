const express = require('express');
const router = express.Router();
const db = require('./db.cjs');

const crypto = require('crypto');

// POST /api/payments/create-order (Real Razorpay Order)
router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency, userId } = req.body;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret || keyId.includes('YOUR_KEY')) {
      return res.status(500).json({ error: 'Razorpay API keys not configured in .env file.' });
    }

    const orderPayload = {
      amount: Math.round(amount * 100), // paise
      currency: currency || 'INR',
      receipt: `receipt_${userId}_${Date.now()}`
    };

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify(orderPayload)
    });

    const razorpayData = await razorpayRes.json();

    if (!razorpayRes.ok) {
      console.error('Razorpay order error:', razorpayData);
      return res.status(400).json({ error: razorpayData.error?.description || 'Failed to create Razorpay order' });
    }

    res.json({
      success: true,
      orderId: razorpayData.id,
      amount: razorpayData.amount / 100,
      currency: razorpayData.currency,
      keyId: keyId
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// POST /api/payments/verify-razorpay
router.post('/verify-razorpay', async (req, res) => {
  try {
    const { email, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    if (!email || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required payment verification fields.' });
    }

    // Verify signature using the correct env variable name
    const secret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET;
    
    if (!secret || secret.includes('YOUR_KEY')) {
      return res.status(500).json({ error: 'Razorpay secret key not configured in .env file.' });
    }

    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    // Strict signature check
    if (generated_signature !== razorpay_signature) {
      console.error('Signature mismatch:', { generated: generated_signature, received: razorpay_signature });
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

// GET /api/payments/premium-price (Public/Authenticated route to get current price)
router.get('/premium-price', async (req, res) => {
  try {
    const priceDoc = await db.getPremiumPrice();
    res.json({ success: true, price: priceDoc });
  } catch (err) {
    console.error('Fetch premium price error:', err);
    res.status(500).json({ error: 'Internal server error occurred while retrieving premium price.' });
  }
});

module.exports = router;
