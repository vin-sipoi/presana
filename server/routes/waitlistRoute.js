const express = require('express');
const router = express.Router();
const Waitlist = require('../models/Waitlist');
const emailService = require('../lib/emailService');

// @route   POST /api/waitlist
// @desc    Add a user to the waitlist
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const newEntry = await Waitlist.create({ email: email.toLowerCase() });

    // Send welcome email
    try {
      const subject = 'Welcome to the Suilens Waitlist!';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://suilens.xyz/Oo7W840W_400x400.jpg" alt="Suilens Logo" style="width: 50px; height: 50px;">
          </div>
          <h1 style="color: #101928; text-align: center;">Welcome to the Suilens Waitlist!</h1>
          <p style="color: #3A4A5C; font-size: 16px; line-height: 1.6;">
            Thank you for joining our waitlist. You're now among the first to get early access to Suilens!
          </p>
          <ul style="color: #3A4A5C; font-size: 16px; line-height: 1.8;">
            <li>🚀 Be the first to explore new features and updates</li>
            <li>🎯 Get priority access to exclusive events and POAPs</li>
            <li>💡 Help shape the future of Sui community tools</li>
            <li>📧 Stay updated with the latest developments</li>
          </ul>
          <div style="background-color: #F0F2F5; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <p style="margin: 0; color: #101928; font-weight: bold;">
              Your spot is reserved!
            </p>
            <p style="margin: 10px 0 0 0; color: #3A4A5C; font-size: 14px;">
              We'll notify you as soon as early access becomes available.
            </p>
          </div>
          <p style="color: #3A4A5C; font-size: 14px;">
            If you have any questions or want to learn more about Suilens, feel free to reach out to us.
          </p>
          <p style="color: #3A4A5C; font-size: 16px; font-weight: bold;">
            Best regards,<br>
            The Suilens Team
          </p>
        </div>
      `;
 
      await emailService.sendEmail(email, subject, html);
    } catch (emailError) {
      console.error('Error sending waitlist welcome email:', emailError);
      // Don't fail the waitlist signup if email fails
    }

    res.status(201).json({
      message: 'Successfully added to waitlist',
      data: newEntry,
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Email already exists in waitlist' });
    }
    console.error('Error adding to waitlist:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/waitlist
// @desc    Get all waitlist entries
router.get('/', async (req, res) => {
  try {
    const entries = await Waitlist.findAll({
      order: [['joined_at', 'DESC']],
    });
    res.json(entries);
  } catch (error) {
    console.error('Error fetching waitlist:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/waitlist/:id
// @desc    Get a single waitlist entry by ID
router.get('/:id', async (req, res) => {
  try {
    const entry = await Waitlist.findByPk(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }
    res.json(entry);
  } catch (error) {
    console.error('Error fetching waitlist entry:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
