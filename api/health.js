import { addLog } from '../lib/logger.js';

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
            endpoint: '/api/health',
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
        endpoint: '/api/health',
        status: 200,
        userAgent: req.headers['user-agent']
    });
    
    return res.json({
        success: true,
        message: 'API berjalan dengan baik',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
}
