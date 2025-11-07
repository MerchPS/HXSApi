import { getAPIStatus, addLog } from '../../lib/logger.js';

export default async function handler(req, res) {
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress;
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        addLog({
            ip: clientIP,
            method: req.method,
            endpoint: '/api/status',
            status: 405,
            userAgent: req.headers['user-agent'],
            error: 'Method not allowed'
        });
        
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }
    
    addLog({
        ip: clientIP,
        method: 'GET',
        endpoint: '/api/status',
        status: 200,
        userAgent: req.headers['user-agent']
    });
    
    const status = getAPIStatus();
    
    return res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
    });
}
