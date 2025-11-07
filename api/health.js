export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    
    res.json({ 
        success: true, 
        message: 'SSWeb API berjalan!',
        timestamp: new Date().toISOString(),
        usage: 'GET /api/ssweb?url=https://example.com',
        example: '/api/ssweb?url=https://google.com'
    });
}
