// api/image/[filename].js
import { imageStorage } from '../ssweb.js';

export default async function handler(req, res) {
    const { filename } = req.query;
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }
    
    try {
        if (!filename) {
            return res.status(400).json({
                success: false,
                message: 'Filename is required'
            });
        }
        
        // Cek apakah image ada di storage
        if (imageStorage.has(filename)) {
            const imageData = imageStorage.get(filename);
            const buffer = Buffer.from(imageData.data, 'base64');
            
            // Set headers untuk image
            res.setHeader('Content-Type', imageData.contentType || 'image/jpeg');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Cache-Control', 'public, max-age=300'); // Cache 5 menit
            res.setHeader('Expires', new Date(Date.now() + 300000).toUTCString());
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            res.setHeader('X-Content-Type-Options', 'nosniff');
            
            return res.send(buffer);
        } else {
            return res.status(404).json({
                success: false,
                message: 'Image not found or expired',
                error: 'The requested image has expired or does not exist. Please generate a new screenshot.'
            });
        }
        
    } catch (error) {
        console.error('Error serving image:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}
