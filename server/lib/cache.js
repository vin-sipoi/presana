const redis = require('redis');

class CacheService {
    constructor(){
        this.client = null;
        this.isConnected = false;
        this.connect();
    }

    async connect() {
        try {
            this.client = redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379',
                retry_strategy: (options) => {
                    if(options.error && options.error.code === 'ECONNREFUSED') {
                        console.log('Redis server refused connection');
                        return 5000;
                    }
                    if(options.total_retry_time > 1000 * 60 * 60) {
                        console.log('Redis retry time exhausted');
                        return null;
                    }

                    return Math.min(options.attempt * 100, 3000);
                }
            });

            this.client.on('error', (err) => {
                console.error('redis error: ', err);
                this.isConnected = false;
            });
            this.client.on('connect', () => {
                console.log('connected to Redis successfully');
                this.isConnected = true;
            });
            await this.client.connect();
        } catch (error) {
            console.error('Failed to connect to Redis: ', error);
            this.isConnected = false;
        }
    }

    async get(key) {
        if(!this.isConnected) return null;

        try{
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis get error: ', error);
            return null;
        }
    }

    async set(key, data, ttlSeconds = 300) {
        if(!this.isConnected) return false;

        try {
            await this.client.setEx(key, ttlSeconds, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Redis set error: ', error);
            return false;
        }
    }

    async del(key) {
        if(!this.isConnected) return false;

        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('Redis del error: ', error);
            return false;
        }
    }

    async cacheEvent(eventId, eventData){
        const key = `event:${eventId}`;
        return await this.set(key, eventData, 600);
    }

    async getCachedEvent(eventId){
        const key = `event:${eventId}`;
        return await this.get(key);
    }

    async cacheRegistrations(eventId, registrations) {
        const key = `registrations:${eventId}`;
        return await this.set(key, registrations, 300);
    }

    async getCachedRegistrations(eventId) {
        const key = `registrations:${eventId}`;
        return await this.get(key);
    }

    async clearEventCache(eventId) {
        await this.del(`event:${eventId}`);
        await this.del(`registrations:${eventId}`);
        await this.del(`events:list`);
    }
}

const cacheService = new CacheService();

module.exports = cacheService;