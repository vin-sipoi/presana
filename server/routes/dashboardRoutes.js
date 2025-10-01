const express = require('express');
const { Event, Registration, EmailBlast, User } = require('../models/index.js');

const router = express.Router();

// Helper function to get date range for a month
function getMonthDateRange(year, month) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { startDate, endDate };
}

// Helper function to calculate stats for events in a date range
function calculateStatsForEvents(events, startDate, endDate) {
  let totalEvents = 0;
  let totalRegistrations = 0;
  let totalAttendees = 0;
  let totalRevenue = 0;
  let upcomingEvents = 0;
  let pastEvents = 0;

  const now = new Date();

  for (const event of events) {
    const eventDate = new Date(event.startTimestamp || event.date);

    // Only include events within the date range
    if (eventDate >= startDate && eventDate <= endDate) {
      totalEvents++;

      // Count registrations and attendees
      const registrations = event.rsvps?.length || 0;
      const attendees = event.attendance?.length || 0;

      totalRegistrations += registrations;
      totalAttendees += attendees;

      // Calculate revenue
      if (!event.isFree && event.ticketPrice) {
        totalRevenue += registrations * parseFloat(event.ticketPrice);
      }

      // Count upcoming vs past events (relative to now, not the range)
      if (eventDate >= now) {
        upcomingEvents++;
      } else {
        pastEvents++;
      }
    }
  }

  return {
    totalEvents,
    totalRegistrations,
    totalAttendees,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    upcomingEvents,
    pastEvents
  };
}

// Helper function to calculate percentage change
function calculatePercentageChange(current, previous) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous * 100).toFixed(1);
}

// GET /api/dashboard/stats/:userId - Get user statistics
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all events created by the user
    const userEvents = await Event.findAll({
      where: { createdBy: userId }
    });

    // Get current month and previous month date ranges
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const currentRange = getMonthDateRange(currentYear, currentMonth);
    const previousRange = getMonthDateRange(previousYear, previousMonth);

    // Calculate stats for current month
    const currentStats = calculateStatsForEvents(userEvents, currentRange.startDate, currentRange.endDate);

    // Calculate stats for previous month
    const previousStats = calculateStatsForEvents(userEvents, previousRange.startDate, previousRange.endDate);

    // Calculate percentage changes
    const comparisons = {
      totalEventsChange: calculatePercentageChange(currentStats.totalEvents, previousStats.totalEvents),
      totalRegistrationsChange: calculatePercentageChange(currentStats.totalRegistrations, previousStats.totalRegistrations),
      totalAttendeesChange: calculatePercentageChange(currentStats.totalAttendees, previousStats.totalAttendees),
      totalRevenueChange: calculatePercentageChange(currentStats.totalRevenue, previousStats.totalRevenue)
    };

    // Calculate overall stats (all time, for charts)
    let overallTotalEvents = userEvents.length;
    let overallTotalRegistrations = 0;
    let overallTotalAttendees = 0;
    let overallTotalRevenue = 0;
    let overallUpcomingEvents = 0;
    let overallPastEvents = 0;

    for (const event of userEvents) {
      const registrations = event.rsvps?.length || 0;
      const attendees = event.attendance?.length || 0;

      overallTotalRegistrations += registrations;
      overallTotalAttendees += attendees;

      if (!event.isFree && event.ticketPrice) {
        overallTotalRevenue += registrations * parseFloat(event.ticketPrice);
      }

      const eventDate = new Date(event.startTimestamp || event.date);
      if (eventDate >= now) {
        overallUpcomingEvents++;
      } else {
        overallPastEvents++;
      }
    }

    res.json({
      success: true,
      stats: {
        // Current month stats
        totalEvents: currentStats.totalEvents,
        totalRegistrations: currentStats.totalRegistrations,
        totalAttendees: currentStats.totalAttendees,
        totalRevenue: currentStats.totalRevenue.toFixed(2),
        upcomingEvents: currentStats.upcomingEvents,
        pastEvents: currentStats.pastEvents,
        // Previous month stats
        previousTotalEvents: previousStats.totalEvents,
        previousTotalRegistrations: previousStats.totalRegistrations,
        previousTotalAttendees: previousStats.totalAttendees,
        previousTotalRevenue: previousStats.totalRevenue.toFixed(2),
        // Percentage changes
        totalEventsChange: comparisons.totalEventsChange,
        totalRegistrationsChange: comparisons.totalRegistrationsChange,
        totalAttendeesChange: comparisons.totalAttendeesChange,
        totalRevenueChange: comparisons.totalRevenueChange,
        // Overall stats for charts
        overallTotalEvents,
        overallTotalRegistrations,
        overallTotalAttendees,
        overallTotalRevenue: overallTotalRevenue.toFixed(2),
        overallUpcomingEvents,
        overallPastEvents
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/dashboard/guests/:userId - Get all guests for user's events
router.get('/guests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all events created by the user
    const userEvents = await Event.findAll({
      where: { createdBy: userId },
      attributes: ['id', 'title', 'date', 'startTimestamp', 'endTimestamp']
    });

    const allGuests = [];

    for (const event of userEvents) {
      // Get registrations for this event
      const registrations = await Registration.findAll({
        where: { eventId: event.id },
        attributes: ['email', 'name', 'registeredAt']
      });

      // Process registered guests
      for (const reg of registrations) {
        allGuests.push({
          email: reg.email,
          name: reg.name,
          eventTitle: event.title,
          eventDate: event.date,
          eventId: event.id,
          status: 'registered',
          registeredAt: reg.registeredAt
        });
      }

      // Process attendees (those who checked in)
      const attendees = event.attendance || [];
      for (const attendeeAddress of attendees) {
        // Find if this attendee also registered
        const existingGuest = allGuests.find(g =>
          g.eventId === event.id &&
          (g.walletAddress === attendeeAddress || g.email === attendeeAddress)
        );

        if (existingGuest) {
          existingGuest.status = 'attended';
        } else {
          // Add as attendee only (no registration record)
          allGuests.push({
            walletAddress: attendeeAddress,
            eventTitle: event.title,
            eventDate: event.date,
            eventId: event.id,
            status: 'attended',
            registeredAt: null
          });
        }
      }
    }

    // Sort by most recent first
    allGuests.sort((a, b) => {
      const dateA = a.registeredAt ? new Date(a.registeredAt) : new Date(a.eventDate);
      const dateB = b.registeredAt ? new Date(b.registeredAt) : new Date(b.eventDate);
      return dateB.getTime() - dateA.getTime();
    });

    res.json({
      success: true,
      guests: allGuests,
      totalGuests: allGuests.length
    });
  } catch (error) {
    console.error('Error fetching user guests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/dashboard/broadcasts/:userId - Get all email blasts sent by user
router.get('/broadcasts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all email blasts sent by the user
    const emailBlasts = await EmailBlast.findAll({
      where: { userId: userId },
      include: [{
        model: Event,
        as: 'event',
        attributes: ['title', 'date']
      }],
      order: [['createdAt', 'DESC']]
    });

    // Format the response
    const formattedBlasts = emailBlasts.map(blast => ({
      id: blast.id,
      title: blast.title,
      subject: blast.subject,
      content: blast.content,
      recipientCount: blast.recipientCount,
      status: blast.status,
      sentAt: blast.sentAt,
      createdAt: blast.createdAt,
      eventTitle: blast.event?.title,
      eventDate: blast.event?.date,
      eventId: blast.eventId
    }));

    res.json({
      success: true,
      broadcasts: formattedBlasts,
      totalBroadcasts: formattedBlasts.length
    });
  } catch (error) {
    console.error('Error fetching user broadcasts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
