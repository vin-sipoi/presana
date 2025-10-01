const express = require('express');
const { Event, Registration, EmailBlast } = require('../models/index.js');
const EventSyncService = require('../services/eventSyncService.js');
const emailService = require('../lib/emailService.js');
const registrationService = require('../services/registrationService.js');
const { generateEventQRCode } = require('../utils/qrCodeUtils.js');

const router = express.Router();

// Create registration with blockchain sync
router.post('/', async (req, res) => {
  try {
    const { eventId, email, name, userId } = req.body;

    if (!eventId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Event ID is required' 
      });
    }

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'User email is required' 
      });
    }

    if (!name) {
      return res.status(400).json({ 
        success: false, 
        message: 'User name is required' 
      });
    }

    // Normalize eventId to ensure "0x" prefix is present
    const normalizedEventId = eventId.startsWith('0x') ? eventId : '0x' + eventId;

    // Run sync-event first to ensure event data is up-to-date
    const syncService = new EventSyncService();
    const syncOk = await syncService.syncEventById(normalizedEventId);
    if (!syncOk) {
      return res.status(404).json({
        success: false,
        message: 'Event not found on blockchain',
        eventId
      });
    }

    // Try to find event in database by UUID (direct ID)
    let event = await Event.findByPk(normalizedEventId);

    // If not found by UUID, try to find by blockchain event ID
    if (!event) {
      console.log(`Event ${normalizedEventId} not found by UUID, trying blockchain ID...`);
      event = await Event.findOne({ where: { suiEventId: normalizedEventId } });
    }

    // If event still not found after sync, return error
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found in database after sync',
        eventId
      });
    }

    // Check if the user is the event creator
    if (event.createdBy === userId) {
      return res.status(403).json({
        success: false,
        message: 'Event creator cannot register for their own event'
      });
    }

    // Check if already registered
    const existingRegistration = await Registration.findOne({
      where: { eventId: event.id, email: email }
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'Already registered for this event'
      });
    }

    // Create registration
    const registration = await Registration.create({
      eventId: event.id,
      email: email,
      name: name,
      registeredAt: new Date()
    });

    // Send pending approval notification email if event requires approval
    if (event.requiresApproval) {
      try {
        await emailService.sendPendingApprovalNotificationEmail(email, {
          title: event.title,
          date: event.date,
          location: event.location
        });
      } catch (emailError) {
        console.error('Failed to send pending approval email:', emailError);
      }
    }

    // Send email with event information and QR code
    try {
      // Generate QR code for the event
      const qrCodeDataUrl = await generateEventQRCode(event.id);
      
      // Send email with event details and QR code
      await emailService.sendEventRegistrationEmailWithQR(
        email,
        {
          title: event.title,
          description: event.description,
          date: event.date,
          location: event.location,
          isVirtual: event.isVirtual,
          capacity: event.capacity,
          ticketPrice: event.ticketPrice,
          isFree: event.isFree,
          startTimestamp: event.startTimestamp,
          endTimestamp: event.endTimestamp
        },
        {
          name: name,
          email: email
        },
        qrCodeDataUrl
      );
    } catch (emailError) {
      console.error('Failed to send registration email:', emailError);
      // Don't fail the registration if email sending fails
    }

    res.json({ 
      success: true, 
      data: registration 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      eventId: req.body.eventId,
      message: 'Registration failed' 
    });
  }
});

// Get registrations for an event
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    // Normalize eventId to ensure "0x" prefix is present
    const normalizedEventId = eventId.startsWith('0x') ? eventId : '0x' + eventId;
    
    const event = await Event.findOne({ where: { suiEventId: normalizedEventId } });
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    const registrations = await Registration.findAll({
      where: { eventId: event.id },
      order: [['registeredAt', 'DESC']]
    });

    res.json({ 
      success: true, 
      data: registrations 
    });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch registrations' 
    });
  }
});

// Sync events from blockchain
router.post('/sync-events', async (req, res) => {
  try {
    const syncService = new EventSyncService();
    await syncService.syncEventsFromBlockchain();
    
    res.json({ 
      success: true, 
      message: 'Events synced successfully' 
    });
  } catch (error) {
    console.error('Error syncing events:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to sync events' 
    });
  }
});

// Sync a single event by id (background-friendly)
router.post('/sync-event', async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ success: false, message: 'eventId is required' });
    }

    // Normalize eventId to ensure "0x" prefix is present
    const normalizedEventId = eventId.startsWith('0x') ? eventId : '0x' + eventId;

    const syncService = new EventSyncService();
    const ok = await syncService.syncEventById(normalizedEventId);

    if (!ok) return res.status(404).json({ success: false, message: 'Event not found on chain' });

    res.json({ success: true, message: 'Event synced', eventId });
  } catch (error) {
    console.error('Error syncing single event:', error);
    res.status(500).json({ success: false, message: 'Failed to sync single event' });
  }
});

// Send email blast to all registered users for an event
router.post('/email-blast', async (req, res) => {
  try {
    const { eventId, subject, content, userId } = req.body;

    console.log('Email blast request:', { eventId, subject, content, userId });

    if (!eventId || !subject || !content) {
      return res.status(400).json({
        success: false,
        message: 'eventId, subject, and content are required'
      });
    }

    // Normalize eventId to ensure "0x" prefix is present
    const normalizedEventId = eventId.startsWith('0x') ? eventId : '0x' + eventId;

    // Find the event
    const event = await Event.findOne({ where: { suiEventId: normalizedEventId } });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Get all registrations for the event
    const registrations = await Registration.findAll({
      where: { eventId: event.id }
    });

    console.log(`Found ${registrations.length} registrations for event ${event.id}`);

    if (registrations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No registered users found for this event'
      });
    }

    // Extract email addresses
    const recipients = registrations.map(reg => reg.email);

    // Create email blast record
    const emailBlast = await EmailBlast.create({
      title: `Blast: ${subject}`,
      subject,
      content,
      eventId: event.id,
      recipientCount: recipients.length,
      status: 'draft'
    });

    // Send the email blast
    try {
      console.log(`Sending email blast to ${recipients.length} recipients`);
      const results = await emailService.sendEmailBlast(recipients, {
        subject,
        content
      });

      console.log('Email blast results:', results);

      // Update email blast status based on results
      const failedCount = results.filter(r => !r.success).length;
      const newStatus = failedCount === 0 ? 'sent' : 'failed';

      await emailBlast.update({
        status: newStatus,
        sentAt: new Date()
      });

      res.json({
        success: true,
        message: `Email blast sent to ${recipients.length} recipients`,
        emailBlastId: emailBlast.id,
        recipientCount: recipients.length,
        failedCount
      });
    } catch (emailError) {
      console.error('Error sending email blast:', emailError);
      console.error('Email error details:', emailError.stack);

      // Update email blast status to failed
      await emailBlast.update({
        status: 'failed'
      });

      res.status(500).json({
        success: false,
        message: 'Failed to send email blast',
        error: emailError.message
      });
    }
  } catch (error) {
    console.error('Error creating email blast:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create email blast'
    });
  }
});

// Send push notification to all registered users for an event
router.post('/push-notification', async (req, res) => {
  try {
    const { eventId, message, userId } = req.body;

    if (!eventId || !message) {
      return res.status(400).json({
        success: false,
        message: 'eventId and message are required'
      });
    }

    // Find the event
    const event = await Event.findOne({ where: { suiEventId: eventId } });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Get all registrations for the event
    const registrations = await Registration.findAll({
      where: { eventId: event.id }
    });

    if (registrations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No registered users found for this event'
      });
    }

    // For now, we'll simulate push notification sending
    // In a real implementation, you would integrate with a push notification service
    // like Firebase Cloud Messaging, OneSignal, or similar
    console.log(`Sending push notification to ${registrations.length} recipients:`, message);

    // Extract user identifiers (you might need to store device tokens in the future)
    const recipients = registrations.map(reg => ({
      email: reg.email,
      name: reg.name
    }));

    // Create push notification record (you might want to create a PushNotification model)
    // For now, we'll just log it
    const pushNotificationData = {
      title: `Notification from ${event.title}`,
      message,
      eventId: event.id,
      userId: userId || null,
      recipientCount: recipients.length,
      status: 'sent',
      sentAt: new Date()
    };

    console.log('Push notification data:', pushNotificationData);

    // Simulate sending push notifications
    // In a real implementation, you would call your push notification service here
    const simulatedResults = recipients.map(recipient => ({
      recipient: recipient.email,
      success: true,
      messageId: `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));

    res.json({
      success: true,
      message: `Push notification sent to ${recipients.length} recipients`,
      recipientCount: recipients.length,
      results: simulatedResults
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send push notification'
    });
  }
});

// Add endpoints for approving and declining registrations with email notifications

// Approve a registration
router.post('/:registrationId/approve', async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await Registration.findByPk(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    // Update registration status to approved
    registration.status = 'approved';
    await registration.save();

    // Fetch event details
    const event = await Event.findByPk(registration.eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Send approval confirmation email
    await emailService.sendEventApprovalConfirmationEmail(registration.email, {
      title: event.title,
      date: event.date,
      location: event.location
    });

    res.json({ success: true, message: 'Registration approved and email sent' });
  } catch (error) {
    console.error('Error approving registration:', error);
    res.status(500).json({ success: false, message: 'Failed to approve registration' });
  }
});

// Decline a registration
router.post('/:registrationId/decline', async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await Registration.findByPk(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    // Update registration status to declined
    registration.status = 'declined';
    await registration.save();

    // Fetch event details
    const event = await Event.findByPk(registration.eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Send decline notification email
    await emailService.sendEventDeclineNotificationEmail(registration.email, {
      title: event.title,
      date: event.date,
      location: event.location
    });

    res.json({ success: true, message: 'Registration declined and email sent' });
  } catch (error) {
    console.error('Error declining registration:', error);
    res.status(500).json({ success: false, message: 'Failed to decline registration' });
  }
});

// Send pending approval notification email when user registers for event requiring approval
// This can be added in the existing registration creation route after registration is created
// For example, after creating registration:
// if (event.requiresApproval) {
//   await emailService.sendPendingApprovalNotificationEmail(email, { title: event.title, date: event.date, location: event.location });
// }

module.exports = router;
