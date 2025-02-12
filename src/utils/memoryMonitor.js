const Logger = require('./logger');

function logMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    const memoryUsageInMB = {
        rss: (memoryUsage.rss / 1024 / 1024).toFixed(2),
        heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
        heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
        external: (memoryUsage.external / 1024 / 1024).toFixed(2),
    };
    Logger.log('Memory Usage', memoryUsageInMB, '', 'system');
}

setInterval(logMemoryUsage, 60000); // Log memory usage every 60 seconds

module.exports = logMemoryUsage;