const express = require('express');
const { Newsletter } = require('../models/index.js');
const emailService = require('../lib/emailService.js');

const router = express.Router();

// POST /api/newsletter/subscribe
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address',
      });
    }

    // Check if email already exists
    const existingSubscription = await Newsletter.findOne({
      where: { email: email.toLowerCase() }
    });

    if (existingSubscription) {
      return res.status(409).json({
        success: false,
        message: 'This email is already subscribed to our newsletter',
      });
    }

    // Create new subscription
    const newsletter = await Newsletter.create({
      email: email.toLowerCase(),
      status: 'active',
      subscribedAt: new Date(),
    });

    // Send confirmation email
    try {
      const subject = 'Welcome to Suilens Newsletter!';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://suilens.xyz/Oo7W840W_400x400.jpg" alt="Suilens Logo" style="width: 50px; height: 50px;">
          </div>
          <h1 style="color: #101928; text-align: center;">Welcome to Suilens!</h1>
          <p style="color: #3A4A5C; font-size: 16px; line-height: 1.6;">
            Thank you for subscribing to our newsletter. You'll be the first to know about:
          </p>
          <ul style="color: #3A4A5C; font-size: 16px; line-height: 1.8;">
            <li>🗓️ New community events and meetups</li>
            <li>🏆 Exclusive POAP drops and rewards</li>
            <li>🚀 Latest updates from the Sui ecosystem</li>
            <li>💡 Tips and insights for event organizers</li>
          </ul>
          <div style="background-color: #F0F2F5; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <p style="margin: 0; color: #101928; font-weight: bold;">
              You're now part of the Suilens community!
            </p>
          </div>
          <p style="color: #3A4A5C; font-size: 14px;">
            If you have any questions or need help getting started, feel free to reach out to us.
          </p>
          <p style="color: #3A4A5C; font-size: 16px; font-weight: bold;">
            Best regards,<br>
            The Suilens Team
          </p>
        </div>
      `;

      await emailService.sendEmail(email, subject, html);
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      // Don't fail the subscription if email fails, just log it
    }

    res.json({
      success: true,
      message: 'Successfully subscribed to newsletter!',
      newsletter: {
        id: newsletter.id,
        email: newsletter.email,
        status: newsletter.status,
        subscribedAt: newsletter.subscribedAt,
      }
    });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/newsletter/subscribers
router.get('/subscribers', async (req, res) => {
  try {
    const subscribers = await Newsletter.findAll({
      where: { status: 'active' },
      attributes: ['id', 'email', 'subscribedAt', 'status'],
      order: [['subscribedAt', 'DESC']],
    });

    res.json({
      success: true,
      subscribers,
      count: subscribers.length,
    });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// DELETE /api/newsletter/unsubscribe
router.delete('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const subscription = await Newsletter.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Email not found in subscription list',
      });
    }

    await subscription.update({ status: 'unsubscribed' });

    res.json({
      success: true,
      message: 'Successfully unsubscribed from newsletter',
    });

  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

module.exports = router;
