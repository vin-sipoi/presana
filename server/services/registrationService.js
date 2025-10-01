const { Registration } = require('../models/index.js');
const cacheService = require('../lib/cache.js');

class RegistrationService {
  async getRegisteredEmailsByEvent(eventId) {
    const cached = await cacheService.getCachedRegistrations(eventId);
    if (cached) {
      return cached;
    }
    const registrations = await Registration.findAll({
      where: { eventId },
      attributes: ['email', 'name'],
    });
    const emails = registrations.map(reg => reg.email);
    await cacheService.cacheRegistrations(eventId, emails);
    return emails;
  }
}

module.exports = new RegistrationService();
