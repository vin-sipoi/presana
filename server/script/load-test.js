// Simple load testing script to test your API performance at high concurrency
const https = require('https');
const http = require('http');

// Create agents with unlimited sockets
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: Infinity });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: Infinity });

class LoadTester {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.results = [];
    this.concurrent = 0;
    this.maxConcurrent = 0;
  }

  // Make HTTP request and measure response time
  async makeRequest(endpoint, method = 'GET', data = null) {
    const startTime = Date.now();
    this.concurrent++;
    this.maxConcurrent = Math.max(this.maxConcurrent, this.concurrent);

    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      const client = url.protocol === 'https:' ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LoadTester/1.0'
        },
        agent: url.protocol === 'https:' ? httpsAgent : httpAgent
      };

      const req = client.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          const endTime = Date.now();
          const responseTime = endTime - startTime;

          this.concurrent--;

          resolve({
            statusCode: res.statusCode,
            responseTime: responseTime,
            contentLength: responseData.length,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        });
      });

      req.on('error', (error) => {
        this.concurrent--;
        reject(error);
      });

      // Set timeout
      req.setTimeout(30000, () => {
        this.concurrent--;
        req.abort();
        reject(new Error('Request timeout'));
      });

      if (data && method !== 'GET') {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  // Run concurrent requests (support 10k+ concurrency)
  async runConcurrentTest(endpoint, concurrent = 10, requests = 100) {
    console.log(`Running ${requests} requests with ${concurrent} concurrent connections to ${endpoint}`);
    console.log('Starting test...');

    const results = [];
    const batches = Math.ceil(requests / concurrent);

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrent, requests - (batch * concurrent));

      // Launch all requests in a batch
      const promises = new Array(batchSize).fill(0).map(() =>
        this.makeRequest(endpoint)
          .then(result => {
            process.stdout.write('.');
            return result;
          })
          .catch(error => {
            process.stdout.write('x');
            return {
              statusCode: 0,
              responseTime: 30000,
              success: false,
              error: error.message
            };
          })
      );

      // Await batch completion
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    console.log('\nTest completed!');
    return results;
  }

  // Analyze results (same as before)
  analyzeResults(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const responseTimes = successful.map(r => r.responseTime);

    if (responseTimes.length === 0) {
      console.log('No successful requests to analyze');
      return;
    }

    responseTimes.sort((a, b) => a - b);

    const stats = {
      totalRequests: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: (successful.length / results.length * 100).toFixed(2),
      avgResponseTime: (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2),
      minResponseTime: responseTimes[0],
      maxResponseTime: responseTimes[responseTimes.length - 1],
      p50: responseTimes[Math.floor(responseTimes.length * 0.5)],
      p95: responseTimes[Math.floor(responseTimes.length * 0.95)],
      p99: responseTimes[Math.floor(responseTimes.length * 0.99)],
      maxConcurrent: this.maxConcurrent
    };

    console.log('\n📊 Test Results:');
    console.log('================');
    console.log(`Total Requests: ${stats.totalRequests}`);
    console.log(`Successful: ${stats.successful} (${stats.successRate}%)`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Max Concurrent: ${stats.maxConcurrent}`);
    console.log('\n⏱️  Response Times (ms):');
    console.log(`Average: ${stats.avgResponseTime}ms`);
    console.log(`Minimum: ${stats.minResponseTime}ms`);
    console.log(`Maximum: ${stats.maxResponseTime}ms`);
    console.log(`50th percentile: ${stats.p50}ms`);
    console.log(`95th percentile: ${stats.p95}ms`);
    console.log(`99th percentile: ${stats.p99}ms`);

    console.log('\n💡 Performance Analysis:');
    if (stats.avgResponseTime > 1000) {
      console.log('⚠️  Average response time is high (>1000ms)');
    } else if (stats.avgResponseTime > 500) {
      console.log('⚠️  Average response time is moderate (>500ms)');
    } else {
      console.log('✅ Average response time is good (<500ms)');
    }

    if (stats.p95 > 2000) {
      console.log('⚠️  95th percentile is high (>2000ms) - some users experiencing slow responses');
    }

    if (stats.successRate < 99) {
      console.log(`⚠️  Success rate is ${stats.successRate}% - investigate failed requests`);
    } else {
      console.log('✅ High success rate');
    }

    return stats;
  }

  async runFullTest() {
    console.log(`🚀 Starting comprehensive load test for ${this.baseUrl}`);

    const tests = [
      { name: 'Health Check', endpoint: '/api/health', concurrent: 10000, requests: 10000 },
      { name: 'Events List', endpoint: '/api/events', concurrent: 5000, requests: 10000 },
      { name: 'Single Event', endpoint: '/api/events/1', concurrent: 5000, requests: 10000 }
    ];

    for (const test of tests) {
      console.log(`\n--- Testing ${test.name} ---`);
      const results = await this.runConcurrentTest(test.endpoint, test.concurrent, test.requests);
      this.analyzeResults(results);
    }
  }
}

// CLI usage
if (require.main === module) {
  const baseUrl = process.argv[2] || 'https://suilens.xyz';
  const testType = process.argv[3] || 'full';

  const tester = new LoadTester(baseUrl);

  console.log(`Load testing ${baseUrl}`);

  if (testType === 'quick') {
    tester.runConcurrentTest('/api/health', 10, 50)
      .then(results => {
        tester.analyzeResults(results);
        process.exit(0);
      })
      .catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
      });
  } else {
    tester.runFullTest()
      .then(() => {
        console.log('\n✅ All tests completed');
        process.exit(0);
      })
      .catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
      });
  }
}

module.exports = LoadTester;
