const express = require('express');
const { Event, EmailBlast } = require('../models/index.js');
const emailService = require('../lib/emailService.js');
const registrationService = require('../services/registrationService.js');

const router = express.Router();

// POST /api/send-blast-email
router.post('/', async (req, res) => {
  try {
    const { eventId, subject, content, title, userId } = req.body;

    // Validate input
    if (!eventId || !subject || !content || !title) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: eventId, subject, content, title',
      });
    }

    // Check if event exists
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const recipients = await registrationService.getRegisteredEmailsByEvent(eventId);

    if (recipients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No registrations found for this event',
      });
    }

    const emailBlast = await EmailBlast.create({
      title,
      subject,
      content,
      eventId,
      recipientCount: recipients.length,
      status: 'draft',
    }, {
      returning: ['id', 'title', 'subject', 'content', 'event_id', 'status', 'recipient_count', 'created_at', 'updated_at']
    });

    const batchSize = 50;
    let emailResults = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batchRecipients = recipients.slice(i, i + batchSize);
      try {
        const batchResults = await emailService.sendEmailBlast(batchRecipients, {
          subject,
          content,
        });
        emailResults = emailResults.concat(batchResults);
      } catch (batchError) {
        console.error(`Error sending batch emails for recipients ${i} to ${i + batchSize}:`, batchError);
        const failedBatchResults = batchRecipients.map((recipient) => ({
          recipient,
          success: false,
          error: batchError.message,
        }));
        emailResults = emailResults.concat(failedBatchResults);
      }
    }

    const failedCount = emailResults.filter((result) => !result.success).length;
    const successfulCount = emailResults.filter((result) => result.success).length;
    const newStatus = failedCount === 0 ? 'sent' : 'failed';

    await emailBlast.update({
      status: newStatus,
      sentAt: new Date(),
    });

    res.json({
      success: true,
      emailBlast,
      results: {
        total: recipients.length,
        successful: successfulCount,
        failed: failedCount,
      },
      message: `Email blast sent to ${successfulCount} recipients`,
    });
  } catch (error) {
    console.error('Send blast email error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/send-blast-email
router.get('/', async (req, res) => {
  try {
    const { eventId } = req.query;
    
    const whereClause = eventId ? { eventId } : {};
    
    const emailBlasts = await EmailBlast.findAll({
      where: whereClause,
      include: [
        { model: Event, as: 'event', attributes: ['id', 'title'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      emailBlasts,
      count: emailBlasts.length,
    });
  } catch (error) {
    console.error('Error fetching email blasts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

module.exports = router;
