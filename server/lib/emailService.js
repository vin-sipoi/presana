const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

class EmailService {
  constructor() {
    const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587;
    const isSecure = process.env.EMAIL_SECURE === 'true';

    // For port 587, we typically use STARTTLS which requires secure: false
    const secure = smtpPort === 465 ? isSecure : false;

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: secure, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
      },
      // Enable STARTTLS for port 587 if needed
      ...(smtpPort === 587 && { requireTLS: true })
    });
  }

  async sendEmail(to, subject, html, text = null) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        html,
        text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendBulkEmail(recipients, subject, html, text = null) {
    const results = [];

    for (const recipient of recipients) {
      try {
        const result = await this.sendEmail(recipient, subject, html, text);
        results.push({ recipient, ...result });
      } catch (error) {
        console.error(`Failed to send email to ${recipient}:`, error);
        results.push({ recipient, success: false, error: error.message });
      }
    }

    return results;
  }

  async sendEventRegistrationEmail(to, eventDetails, registrationDetails) {
    const subject = `Registration confirmed: ${eventDetails.title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #101928;">Registration Confirmed!</h2>
        <p>Hi ${registrationDetails.name},</p>
        <p>Your registration for <strong>${eventDetails.title}</strong> has been confirmed.</p>

        <div style="background-color: #F0F2F5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #101928;">Event Details</h3>
          <p><strong>Title:</strong> ${eventDetails.title}</p>
          <p><strong>Date:</strong> ${new Date(eventDetails.date).toLocaleDateString()}</p>
          <p><strong>Location:</strong> ${eventDetails.location || 'TBD'}</p>
        </div>

        <p>We'll send you more details closer to the event date.</p>
        <p>Best regards,<br>The Suilens Team</p>
      </div>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendEventRegistrationEmailWithQR(to, eventDetails, registrationDetails, qrCodeDataUrl) {
    const subject = `Registration confirmed: ${eventDetails.title}`;

    // Format date and time
    const eventDate = eventDetails.startDate ? new Date(eventDetails.startDate) : null;
    const eventEndDate = eventDetails.endDate ? new Date(eventDetails.endDate) : null;

    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const month = eventDate ? monthNames[eventDate.getMonth()] : 'TBD';
    const day = eventDate ? eventDate.getDate() : 'TBD';
    const fullDate = eventDate ? `${dayNames[eventDate.getDay()]}, ${eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : 'TBD';

    const startTime = eventDetails.startTimestamp ? new Date(eventDetails.startTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'TBD';
    const endTime = eventDetails.endTimestamp ? new Date(eventDetails.endTimestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'TBD';
    const timeRange = startTime !== 'TBD' && endTime !== 'TBD' ? `${startTime} - ${endTime}` : 'TBD';

    // Format location
    const location = eventDetails.location || 'TBD';
    const locationParts = location.split(', ');
    const primaryLocation = locationParts[0] || location;
    const secondaryLocation = locationParts.slice(1).join(', ') || '';

    // Format ticket info
    const ticketType = 'Standard';
    const ticketPrice = eventDetails.isFree ? 'Free' : `$${eventDetails.ticketPrice || '0'}`;

    // Event URL
    const eventUrl = eventDetails.eventUrl || '#';

    const html = `
      <head>
        <title>${eventDetails.title} Registration</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #fff;">

          <div style="max-width: 700px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">

              <!-- Header -->
              <div style="display: flex; align-items: center; margin-bottom: 20px;">
                  <img src="https://suilens.xyz/Oo7W840W_400x400.jpg" alt="Suilens Logo" style="width: 24px; height: 24px; margin-right: 8px;">
                  <span style="font-size: 14px; color: #666;">Suilens</span>
              </div>

              <!-- Title -->
              <h2 style="font-size: 20px; font-weight: bold; margin: 0; color: #000;">
                  You’ve got a spot at <br>
                  ${eventDetails.title}
              </h2>

              <!-- Event Details -->
              <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
                  <!-- Date -->
                  <div style="display: flex; align-items: center; margin-bottom: 10px;">
                      <div style="width: 40px; text-align: center; background-color: #f5f5f5; border-radius: 4px; padding: 5px; margin-right: 10px;">
                          <div style="font-size: 12px; color: #666;">${month}</div>
                          <div style="font-size: 16px; font-weight: bold;">${day}</div>
                      </div>
                      <div>
                          <div style="font-weight: bold;">${fullDate}</div>
                          <div style="font-size: 14px; color: #666;">${timeRange}</div>
                      </div>
                  </div>

                  <!-- Location -->
                  <div style="display: flex; align-items: center; margin-bottom: 10px;">
                      <span style="font-size: 18px; margin-right: 8px;">📍</span>
                      <div>
                          <div style="font-weight: bold;">${primaryLocation}</div>
                          ${secondaryLocation ? `<div style="font-size: 14px; color: #666;">${secondaryLocation}</div>` : ''}
                      </div>
                  </div>

                  <!-- Ticket -->
                  <div style="display: flex; align-items: center; margin-bottom: 10px;">
                      <span style="font-size: 18px; margin-right: 8px;">🎟</span>
                      <div>
                          <div style="font-weight: bold;">${ticketType}</div>
                          <div style="font-size: 14px; color: #666;">${ticketPrice}</div>
                      </div>
                  </div>
              </div>

              <!-- Buttons -->
              <div style="margin-top: 20px;">
                  <a href="${eventUrl}" style="display: inline-block; background-color: #8f00ff; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; margin-right: 10px;">Event Page</a>
                  <a href="${eventUrl ? `${eventUrl}/ticket` : '#'}" style="display: inline-block; background-color: #f5f5f5; color: #000; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold;">My Ticket</a>
              </div>

              <!-- Social Icons -->
              <div style="margin-top: 20px; color: #666; font-size: 14px;">
                  Share with friends:
                  <span style="margin-left: 10px;">🌐</span>
                  <span style="margin-left: 10px;">💬</span>
              </div>

              <!-- Footer -->
              <div style="margin-top: 30px; font-size: 12px; color: #999;">
                  Powered by Suilens
              </div>
          </div>

      </body>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendEmailBlast(recipients, emailBlast) {
    const subject = emailBlast.subject;
    const html = emailBlast.content;

    // Fixed batch size for sending emails to avoid overwhelming the SMTP server
    const batchSize = 50;
    const results = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batchRecipients = recipients.slice(i, i + batchSize);
      console.log(`Sending batch emails to recipients ${i + 1} to ${i + batchRecipients.length}`);

      // Retry logic for batch sending
      let batchResults = [];
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          batchResults = await this.sendBulkEmail(batchRecipients, subject, html);
          // Check if any failed
          const failed = batchResults.filter((r) => !r.success);
          if (failed.length === 0) {
            break; // All succeeded
          } else {
            console.warn(`Batch attempt ${attempts + 1} had ${failed.length} failures, retrying...`);
            batchRecipients = failed.map((r) => r.recipient);
          }
        } catch (error) {
          console.error(`Error sending batch attempt ${attempts + 1}:`, error);
          // If the entire batch fails, mark all as failed
          batchResults = batchRecipients.map((recipient) => ({
            recipient,
            success: false,
            error: error.message,
          }));
        }
        attempts++;
      }

      results.push(...batchResults);
    }

    return results;
  }

  async sendEventApprovalRequestEmail(to, eventDetails) {
    const subject = `Action Required: Approval Needed for ${eventDetails.title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <img src="https://suilens.xyz/Oo7W840W_400x400.jpg" alt="Suilens Logo" style="width: 24px; height: 24px; margin-right: 8px;">
          <span style="font-size: 14px; color: #666;">Suilens</span>
        </div>
        <h2 style="color: #101928;">Approval Required for Event</h2>
        <p>Hi,</p>
        <p>The event <strong>${eventDetails.title}</strong> requires your approval before it can proceed.</p>

        <div style="background-color: #F0F2F5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #101928;">Event Details</h3>
          <p><strong>Title:</strong> ${eventDetails.title}</p>
          <p><strong>Date:</strong> ${new Date(eventDetails.date).toLocaleDateString()}</p>
          <p><strong>Location:</strong> ${eventDetails.location || 'TBD'}</p>
        </div>

        <p>Please review and approve the event at your earliest convenience.</p>
        <p>Best regards,<br>The Suilens Team</p>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }

  async sendPendingApprovalNotificationEmail(to, eventDetails) {
    const subject = `Pending Approval: Your Registration for ${eventDetails.title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <img src="https://suilens.xyz/Oo7W840W_400x400.jpg" alt="Suilens Logo" style="width: 24px; height: 24px; margin-right: 8px;">
          <span style="font-size: 14px; color: #666;">Suilens</span>
        </div>
        <h2 style="color: #101928;">Registration Pending Approval</h2>
        <p>Hi,</p>
        <p>Your registration for the event <strong>${eventDetails.title}</strong> is currently pending approval.</p>

        <div style="background-color: #F0F2F5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #101928;">Event Details</h3>
          <p><strong>Title:</strong> ${eventDetails.title}</p>
          <p><strong>Date:</strong> ${new Date(eventDetails.date).toLocaleDateString()}</p>
          <p><strong>Location:</strong> ${eventDetails.location || 'TBD'}</p>
        </div>

        <p>We will notify you once your registration has been approved.</p>
        <p>Thank you for your patience.<br>The Suilens Team</p>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }

  async sendEventApprovalConfirmationEmail(to, eventDetails) {
    const subject = `Approved: Your Registration for ${eventDetails.title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <img src="https://i.ibb.co/2Yc7S0VH/Suilens-Lockup-Vertical-Navy.png" alt="Suilens Logo" style="width: 24px; height: 24px; margin-right: 8px;">
          <span style="font-size: 14px; color: #666;">Suilens</span>
        </div>
        <h2 style="color: #101928;">Registration Approved!</h2>
        <p>Hi,</p>
        <p>Your registration for the event <strong>${eventDetails.title}</strong> has been approved.</p>

        <div style="background-color: #F0F2F5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #101928;">Event Details</h3>
          <p><strong>Title:</strong> ${eventDetails.title}</p>
          <p><strong>Date:</strong> ${new Date(eventDetails.date).toLocaleDateString()}</p>
          <p><strong>Location:</strong> ${eventDetails.location || 'TBD'}</p>
        </div>

        <p>We look forward to seeing you at the event!</p>
        <p>Best regards,<br>The Suilens Team</p>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }
}

module.exports = new EmailService();
