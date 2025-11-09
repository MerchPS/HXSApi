import { imageCache } from '../ssweb.js';

export default async function handler(req, res) {
    const { id } = req.query;
    
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
        if (!id || !imageCache.has(id)) {
            return res.status(404).json({
                success: false,
                message: 'Image not found or expired'
            });
        }
        
        const cached = imageCache.get(id);
        const buffer = Buffer.from(cached.data, 'base64');
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Image-Id', id);
        res.setHeader('X-Original-URL', cached.url);
        
        return res.send(buffer);
        
    } catch (error) {
        console.error('Image serve error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to serve image'
        });
    }
}
