import { getLogs, clearLogs, addLog } from '../../lib/logger.js';

const DEVELOPER_PASSWORD = 'hxs2023'; // Ganti dengan password yang lebih aman

export default async function handler(req, res) {
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress;
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const { password, limit = 50 } = req.body;
        
        // Password validation
        if (password !== DEVELOPER_PASSWORD) {
            addLog({
                ip: clientIP,
                method: req.method,
                endpoint: '/api/developer/logs',
                status: 401,
                userAgent: req.headers['user-agent'],
                error: 'Invalid password attempt'
            });
            
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: Invalid password'
            });
        }
        
        if (req.method === 'GET' || req.method === 'POST') {
            const logs = getLogs(parseInt(limit));
            
            addLog({
                ip: clientIP,
                method: req.method,
                endpoint: '/api/developer/logs',
                status: 200,
                userAgent: req.headers['user-agent'],
                note: `Accessed ${logs.length} logs`
            });
            
            return res.json({
                success: true,
                logs,
                total: logs.length
            });
        }
        
        if (req.method === 'DELETE') {
            const clearedCount = clearLogs();
            
            addLog({
                ip: clientIP,
                method: 'DELETE',
                endpoint: '/api/developer/logs',
                status: 200,
                userAgent: req.headers['user-agent'],
                note: `Cleared ${clearedCount} logs`
            });
            
            return res.json({
                success: true,
                message: `Berhasil menghapus ${clearedCount} log entries`
            });
        }
        
        addLog({
            ip: clientIP,
            method: req.method,
            endpoint: '/api/developer/logs',
            status: 405,
            userAgent: req.headers['user-agent'],
            error: 'Method not allowed'
        });
        
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
        
    } catch (error) {
        addLog({
            ip: clientIP,
            method: req.method,
            endpoint: '/api/developer/logs',
            status: 500,
            userAgent: req.headers['user-agent'],
            error: error.message
        });
        
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}
