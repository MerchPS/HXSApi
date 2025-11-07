import { sendToTelegram, formatLogMessage } from './telegram.js';

// In-memory storage untuk logs (di Vercel ini akan reset setiap cold start)
let apiLogs = [];
let apiStatus = {
    ssweb: {
        status: 'online',
        responseTime: 240,
        uptime: 99.8,
        requestsToday: 0,
        lastChecked: new Date()
    },
    auth: {
        status: 'online',
        responseTime: 180,
        uptime: 99.9,
        activeUsers: 0,
        lastChecked: new Date()
    }
};

export function addLog(logData) {
    const log = {
        id: Date.now() + Math.random(),
        timestamp: new Date(),
        ...logData
    };
    
    apiLogs.unshift(log);
    
    // Keep only last 500 logs
    if (apiLogs.length > 500) {
        apiLogs.pop();
    }
    
    // Kirim ke Telegram
    sendToTelegram(formatLogMessage(log));
    
    // Update status
    updateAPIStatus(log);
    
    return log;
}

function updateAPIStatus(log) {
    if (log.endpoint === '/api/ssweb') {
        apiStatus.ssweb.requestsToday += 1;
        
        if (log.status >= 200 && log.status < 400) {
            apiStatus.ssweb.status = 'online';
        } else {
            apiStatus.ssweb.status = 'offline';
        }
        
        apiStatus.ssweb.lastChecked = new Date();
    }
}

export function getLogs(limit = 50) {
    return apiLogs.slice(0, limit);
}

export function clearLogs() {
    const count = apiLogs.length;
    apiLogs = [];
    return count;
}

export function getAPIStatus() {
    return apiStatus;
}
