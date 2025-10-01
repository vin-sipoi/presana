// File: /var/www/SUI-Lens/server/worker.js
// Background worker for handling heavy/async tasks

const Bull = require('bull');
const { Event, Registration, EmailBlast } = require('./models/index.js');
const EventSyncService = require('./services/eventSyncService.js');
const emailService = require('./lib/emailService.js');
const cache = require('./lib/cache.js');
require('dotenv').config();

class SuiLensWorker {
  constructor() {
    this.isShuttingDown = false;
    this.activeJobs = 0;
    
    // Initialize job queues
    this.emailQueue = new Bull('email processing', {
      redis: {
        port: 6379,
        host: 'localhost',
      },
      defaultJobOptions: {
        removeOnComplete: 10, // Keep last 10 completed jobs
        removeOnFail: 50,     // Keep last 50 failed jobs
        attempts: 3,          // Retry failed jobs 3 times
        backoff: {
          type: 'exponential',
          delay: 2000,        // Start with 2 second delay
        }
      }
    });

    this.blockchainQueue = new Bull('blockchain sync', {
      redis: {
        port: 6379,
        host: 'localhost',
      },
      defaultJobOptions: {
        removeOnComplete: 5,
        removeOnFail: 20,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        }
      }
    });

    this.dataCleanupQueue = new Bull('data cleanup', {
      redis: {
        port: 6379,
        host: 'localhost',
      },
      defaultJobOptions: {
        removeOnComplete: 3,
        removeOnFail: 10,
        attempts: 2
      }
    });

    this.initializeProcessors();
    this.scheduleRecurringJobs();
    this.setupGracefulShutdown();
    
    console.log('SuiLens Worker started successfully');
  }

  // Initialize job processors
  initializeProcessors() {
    // Email processing
    this.emailQueue.process('registration-email', 5, async (job) => {
      return await this.processRegistrationEmail(job.data);
    });

    this.emailQueue.process('email-blast', 3, async (job) => {
      return await this.processEmailBlast(job.data);
    });

    this.emailQueue.process('reminder-email', 5, async (job) => {
      return await this.processReminderEmail(job.data);
    });

    // Blockchain synchronization
    this.blockchainQueue.process('sync-events', 1, async (job) => {
      return await this.syncEventsFromBlockchain(job.data);
    });

    this.blockchainQueue.process('sync-single-event', 3, async (job) => {
      return await this.syncSingleEvent(job.data);
    });

    this.blockchainQueue.process('sync-registrations', 2, async (job) => {
      return await this.syncEventRegistrations(job.data);
    });

    // Data cleanup
    this.dataCleanupQueue.process('cleanup-logs', 1, async (job) => {
      return await this.cleanupLogs(job.data);
    });

    this.dataCleanupQueue.process('cleanup-cache', 1, async (job) => {
      return await this.cleanupExpiredCache(job.data);
    });

    this.dataCleanupQueue.process('optimize-database', 1, async (job) => {
      return await this.optimizeDatabase(job.data);
    });

    // Event handlers
    this.setupEventHandlers();
  }

  // Process registration email
  async processRegistrationEmail(data) {
    this.activeJobs++;
    try {
      const { email, name, eventData, qrCodeDataUrl } = data;
      
      console.log(`Sending registration email to ${email}`);
      
      await emailService.sendEventRegistrationEmailWithQR(
        email,
        eventData,
        { name, email },
        qrCodeDataUrl
      );

      console.log(`Registration email sent successfully to ${email}`);
      return { success: true, email, timestamp: new Date() };
    } catch (error) {
      console.error('Failed to send registration email:', error);
      throw error;
    } finally {
      this.activeJobs--;
    }
  }

  // Process email blast
  async processEmailBlast(data) {
    this.activeJobs++;
    try {
      const { recipients, subject, content, emailBlastId } = data;
      
      console.log(`Sending email blast to ${recipients.length} recipients`);
      
      const results = await emailService.sendEmailBlast(recipients, {
        subject,
        content
      });

      // Update email blast status in database
      if (emailBlastId) {
        await EmailBlast.update(
          { 
            status: 'sent',
            sentAt: new Date(),
            deliveredCount: results.successful || 0
          },
          { where: { id: emailBlastId } }
        );
      }

      console.log(`Email blast completed: ${results.successful || 0} sent, ${results.failed || 0} failed`);
      return results;
    } catch (error) {
      console.error('Email blast failed:', error);
      
      // Update failure status
      if (data.emailBlastId) {
        await EmailBlast.update(
          { status: 'failed' },
          { where: { id: data.emailBlastId } }
        );
      }
      
      throw error;
    } finally {
      this.activeJobs--;
    }
  }

  // Process reminder emails
  async processReminderEmail(data) {
    this.activeJobs++;
    try {
      const { eventId, reminderType } = data; // reminderType: '24h', '1h', etc.
      
      console.log(`Processing ${reminderType} reminder for event ${eventId}`);
      
      // Get event and registrations
      const event = await Event.findOne({ where: { suiEventId: eventId } });
      if (!event) {
        throw new Error(`Event ${eventId} not found`);
      }

      const registrations = await Registration.findAll({
        where: { eventId: event.id }
      });

      if (registrations.length === 0) {
        return { success: true, message: 'No registrations found', sent: 0 };
      }

      // Send reminder emails
      let sent = 0;
      for (const registration of registrations) {
        try {
          await emailService.sendEventReminder(
            registration.email,
            {
              name: registration.name,
              eventTitle: event.title,
              eventDate: event.date,
              eventLocation: event.location,
              reminderType
            }
          );
          sent++;
        } catch (error) {
          console.error(`Failed to send reminder to ${registration.email}:`, error);
        }
      }

      console.log(`Sent ${sent} reminder emails for event ${eventId}`);
      return { success: true, sent, total: registrations.length };
    } catch (error) {
      console.error('Reminder email processing failed:', error);
      throw error;
    } finally {
      this.activeJobs--;
    }
  }

  // Sync events from blockchain
  async syncEventsFromBlockchain(data = {}) {
    this.activeJobs++;
    try {
      console.log('Starting blockchain events sync');
      
      const syncService = new EventSyncService();
      const result = await syncService.syncEventsFromBlockchain();
      
      // Clear events cache after sync
      await cache.del('events:list:page:1:limit:20');
      
      console.log('Blockchain events sync completed:', result);
      return result;
    } catch (error) {
      console.error('Blockchain sync failed:', error);
      throw error;
    } finally {
      this.activeJobs--;
    }
  }

  // Sync single event
  async syncSingleEvent(data) {
    this.activeJobs++;
    try {
      const { eventId } = data;
      console.log(`Syncing single event: ${eventId}`);
      
      const syncService = new EventSyncService();
      const result = await syncService.syncEventById(eventId);
      
      // Clear cache for this event
      await cache.clearEventCache(eventId);
      
      console.log(`Event ${eventId} sync completed`);
      return result;
    } catch (error) {
      console.error(`Failed to sync event ${data.eventId}:`, error);
      throw error;
    } finally {
      this.activeJobs--;
    }
  }

  // Sync event registrations
  async syncEventRegistrations(data) {
    this.activeJobs++;
    try {
      const { eventId } = data;
      console.log(`Syncing registrations for event: ${eventId}`);
      
      const syncService = new EventSyncService();
      const result = await syncService.syncEventRegistrations(eventId);
      
      // Clear registrations cache
      await cache.del(`registrations:${eventId}`);
      
      console.log(`Registrations sync completed for event ${eventId}`);
      return result;
    } catch (error) {
      console.error(`Failed to sync registrations for event ${data.eventId}:`, error);
      throw error;
    } finally {
      this.activeJobs--;
    }
  }

  // Cleanup old logs
  async cleanupLogs(data = {}) {
    this.activeJobs++;
    try {
      const { daysOld = 7 } = data;
      console.log(`Cleaning up logs older than ${daysOld} days`);
      
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      // Clean up log files older than specified days
      await execPromise(`find ./logs -name "*.log" -mtime +${daysOld} -delete`);
      
      console.log('Log cleanup completed');
      return { success: true, cleaned: 'logs older than ' + daysOld + ' days' };
    } catch (error) {
      console.error('Log cleanup failed:', error);
      throw error;
    } finally {
      this.activeJobs--;
    }
  }

  // Cleanup expired cache entries
  async cleanupExpiredCache(data = {}) {
    this.activeJobs++;
    try {
      console.log('Cleaning up expired cache entries');
      
      // Redis automatically handles TTL expiration, but we can do manual cleanup
      // for specific patterns if needed
      const keys = await cache.client.keys('*:expired:*');
      if (keys.length > 0) {
        await cache.client.del(...keys);
      }
      
      console.log(`Cache cleanup completed, removed ${keys.length} expired entries`);
      return { success: true, removed: keys.length };
    } catch (error) {
      console.error('Cache cleanup failed:', error);
      throw error;
    } finally {
      this.activeJobs--;
    }
  }

  // Optimize database
  async optimizeDatabase(data = {}) {
    this.activeJobs++;
    try {
      console.log('Starting database optimization');
      
      const { Sequelize } = require('sequelize');
      const sequelize = require('./config/database');
      
      // Run ANALYZE on all tables to update statistics
      await sequelize.query('ANALYZE;', { type: Sequelize.QueryTypes.RAW });
      
      // Optional: VACUUM for PostgreSQL (be careful in production)
      if (data.vacuum && process.env.NODE_ENV !== 'production') {
        await sequelize.query('VACUUM ANALYZE;', { type: Sequelize.QueryTypes.RAW });
      }
      
      console.log('Database optimization completed');
      return { success: true, operation: 'analyze' };
    } catch (error) {
      console.error('Database optimization failed:', error);
      throw error;
    } finally {
      this.activeJobs--;
    }
  }

  // Schedule recurring jobs
  scheduleRecurringJobs() {
    // Sync events from blockchain every 10 minutes
    this.blockchainQueue.add('sync-events', {}, {
      repeat: { cron: '*/10 * * * *' },
      jobId: 'recurring-blockchain-sync'
    });

    // Clean up logs weekly (Sundays at 2 AM)
    this.dataCleanupQueue.add('cleanup-logs', { daysOld: 7 }, {
      repeat: { cron: '0 2 * * 0' },
      jobId: 'weekly-log-cleanup'
    });

    // Clean up cache daily (every day at 3 AM)
    this.dataCleanupQueue.add('cleanup-cache', {}, {
      repeat: { cron: '0 3 * * *' },
      jobId: 'daily-cache-cleanup'
    });

    // Optimize database weekly (Sundays at 4 AM)
    this.dataCleanupQueue.add('optimize-database', {}, {
      repeat: { cron: '0 4 * * 0' },
      jobId: 'weekly-db-optimization'
    });

    console.log('Recurring jobs scheduled');
  }

  // Setup event handlers for monitoring
  setupEventHandlers() {
    // Email queue events
    this.emailQueue.on('completed', (job, result) => {
      console.log(`Email job ${job.id} completed:`, result);
    });

    this.emailQueue.on('failed', (job, err) => {
      console.error(`Email job ${job.id} failed:`, err.message);
    });

    // Blockchain queue events
    this.blockchainQueue.on('completed', (job, result) => {
      console.log(`Blockchain job ${job.id} completed`);
    });

    this.blockchainQueue.on('failed', (job, err) => {
      console.error(`Blockchain job ${job.id} failed:`, err.message);
    });

    // Generic error handling
    this.emailQueue.on('error', (error) => {
      console.error('Email queue error:', error);
    });

    this.blockchainQueue.on('error', (error) => {
      console.error('Blockchain queue error:', error);
    });
  }

  // Graceful shutdown
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`Received ${signal}, starting graceful shutdown...`);
      this.isShuttingDown = true;

      // Stop accepting new jobs
      await Promise.all([
        this.emailQueue.pause(),
        this.blockchainQueue.pause(),
        this.dataCleanupQueue.pause()
      ]);

      // Wait for active jobs to complete (with timeout)
      const shutdownTimeout = 30000; // 30 seconds
      const startTime = Date.now();
      
      while (this.activeJobs > 0 && (Date.now() - startTime) < shutdownTimeout) {
        console.log(`Waiting for ${this.activeJobs} active jobs to complete...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (this.activeJobs > 0) {
        console.warn(`Force stopping with ${this.activeJobs} active jobs`);
      }

      // Close queues
      await Promise.all([
        this.emailQueue.close(),
        this.blockchainQueue.close(),
        this.dataCleanupQueue.close()
      ]);

      console.log('Worker shutdown completed');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  // Health check method
  getStatus() {
    return {
      status: 'running',
      activeJobs: this.activeJobs,
      queues: {
        email: {
          waiting: this.emailQueue.waiting(),
          active: this.emailQueue.active(),
          completed: this.emailQueue.completed(),
          failed: this.emailQueue.failed()
        },
        blockchain: {
          waiting: this.blockchainQueue.waiting(),
          active: this.blockchainQueue.active(),
          completed: this.blockchainQueue.completed(),
          failed: this.blockchainQueue.failed()
        }
      },
      uptime: process.uptime()
    };
  }
}

// Start the worker if this file is run directly
if (require.main === module) {
  // Install required packages first: npm install bull
  try {
    new SuiLensWorker();
    
    // Health check endpoint (simple HTTP server)
    const http = require('http');
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', timestamp: new Date() }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    
    server.listen(3010, () => {
      console.log('Worker health check server running on port 3010');
    });
    
  } catch (error) {
    console.error('Failed to start worker:', error);
    console.log('Make sure to install Bull queue: npm install bull');
    process.exit(1);
  }
}

module.exports = SuiLensWorker;