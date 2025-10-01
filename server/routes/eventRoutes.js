const express = require('express');
const { Event, Registration} = require('../models/index.js');
const cache = require('../lib/cache.js');
const e = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20} = req.query;
    const cacheKey = `events:list:page:${page}:limit:${limit}`;

    const cachedEvents = await cache.get(cacheKey);
    if(cachedEvents) {
      console.log('Returning events from cache');
      return res.json(cachedEvents);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const events = await Event.findAndCountAll({
      limit: parseInt(limit),
      offset: offset,
      order: [['createdAt', 'DESC']],
      include: [{
        model: Registration,
        as: 'registrations',
        attributes: ['id'],
        required: false
      }]
    });

    const response = {
      success: true,
      data: events.rows.map(event => ({
        ...event.toJSON(),
        registrationCount: event.registrations ? event.registrations.length : 0
      })),
      pagination: {
        total: events.count,
        page: parseInt(page),
        totalPages: Math.ceil(events.count / parseInt(limit)),
        hasNext: offset + parseInt(page) > 1
      }
    };

    await cache.set(cacheKey, response, 300);

    res.json(response);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } =req.params;

    const cachedEvent = await cache.getCachedEvent(id);
    if(cachedEvent) {
      console.log('Returning event from cache');
      return res.json({ success: true, data: cachedEvent });
    }

    const event = await event.finOne({
      where: {
        $or: [
          {id: id},
          {suiEventId: id}
        ]
      },
      include: [{
        model: Registration,
        as: 'registrations',
        attributes: ['id', 'name', 'email', 'registeredAt']
      }]
    });

    if(!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const eventData = {
      ...event.toJSON(),
      registrationCount: event.registrations ? event.registrations.length : 0
    };

    await cache.cacheEvent(id, eventData);

    res.json({ success: true, data: eventData });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event'
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const event = await Event.create(req.body);

    await cache.del('events:list:page:1:limit:20');

    res.status(201).json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create event'
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [updatedRowsCount ] = await Event.update(req.body, {
      where: {id: id}
    });

    if(updatedRowsCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    await cache.clearEventCache(id);

    const updatedEvent = await Event.findByPk(id);

    res.json({
      success: true,
      data: updatedEvent
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event'
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleteRowsCount = await Event.destroy({
      where: {id: id}
    });

    if(deleteRowsCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    await cache.clearEventCache(id);
    await cache.del('events:list:page:1:limit:20');

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting event: ', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete event'
    });
  }
});

module.exports = router;