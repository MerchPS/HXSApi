import { addLog } from '../lib/logger.js';
import { incrementRequest } from '../lib/requestCounter.js';

// SSWeb implementation
const ssweb = {
    _static: Object.freeze({
        baseUrl: 'https://www.screenshotmachine.com',
        baseHeaders: { 'content-encoding': 'zstd' },
        maxOutputLength: 200
    }),
    pretyError(string) {
        if (!string) return '(empty message)'
        let message = ''
        try { message = JSON.stringify(string, null, 2) } 
        catch { message = string }
        return message.length >= this._static.maxOutputLength ? message.substring(0, this._static.maxOutputLength) + ' [trimmed]' : message
    },
    async getCookie() {
        const r = await fetch(this._static.baseUrl, { headers: this._static.baseHeaders })
        if (!r.ok) throw Error(`${r.status} ${r.statusText} ${this.pretyError(await r.text())}`)
        const cookie = r.headers.get('set-cookie')?.split(',').map(v => v.split(';')[0]).join('; ') || ''
        if (!cookie) throw Error('gagal mendapatkan kuki')
        return { cookie }
    },
    async getBuffer(reqObj, cookie) {
        if (reqObj.status !== "success") throw Error("status nya gak sukses")
        const { link } = reqObj
        const r = await fetch(this._static.baseUrl + '/' + link, { headers: { cookie } })
        if (!r.ok) throw Error(`${r.status} ${r.statusText} ${this.pretyError(await r.text())}`)
        const ab = await r.arrayBuffer()
        return { buffer: Buffer.from(ab) }
    },
    async req(url, cookie) {
        const headers = {
            cookie,
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            ...this._static.baseHeaders
        }
        const r = await fetch(this._static.baseUrl + '/capture.php', {
            headers,
            body: "url=" + encodeURIComponent(url) + "&device=desktop&cacheLimit=0",
            method: "POST"
        })
        if (!r.ok) throw Error(`${r.status} ${r.statusText} ${this.pretyError(await r.text())}`)
        const reqObj = await r.json()
        return { reqObj }
    },
    async capture(url) {
        if (!url) throw Error('param url gak boleh kosong')
        const { cookie } = await this.getCookie()
        const { reqObj } = await this.req(url, cookie)
        const { buffer } = await this.getBuffer(reqObj, cookie)
        return buffer
    }
}

// Helper function untuk extract domain dari URL
function getDomainFromUrl(url) {
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
    } catch {
        return 'website';
    }
}

// Helper function untuk generate title
function generateTitle(url) {
    const domain = getDomainFromUrl(url);
    return `Screenshot of ${domain}`;
}

// Helper function untuk generate developer info
function generateDeveloperInfo(url) {
    const domain = getDomainFromUrl(url);
    return `${domain} Development Team`;
}

export default async function handler(req, res) {
    const startTime = Date.now();
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress;
    
    // Set CORS headers
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
            endpoint: '/api/ssweb',
            status: 405,
            userAgent: req.headers['user-agent'],
            error: 'Method not allowed'
        });
        
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }
    
    try {
        const { url, format = 'json' } = req.query;
        
        if (!url) {
            addLog({
                ip: clientIP,
                method: 'GET',
                endpoint: '/api/ssweb',
                status: 400,
                userAgent: req.headers['user-agent'],
                error: 'Missing URL parameter'
            });
            
            return res.status(400).json({
                success: false,
                message: 'Parameter url diperlukan'
            });
        }
        
        // Validate URL
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch (error) {
            addLog({
                ip: clientIP,
                method: 'GET',
                endpoint: '/api/ssweb',
                status: 400,
                userAgent: req.headers['user-agent'],
                error: 'Invalid URL format',
                url: url
            });
            
            return res.status(400).json({
                success: false,
                message: 'Format URL tidak valid'
            });
        }

        // Increment request counter - TIDAK blocking
        incrementRequest('/api/ssweb').then(requestStats => {
            console.log('Request counter updated:', requestStats);
        }).catch(error => {
            console.error('Error updating request counter:', error);
        });

        const buffer = await ssweb.capture(url);
        const responseTime = Date.now() - startTime;

        // Generate base64 image
        const base64Image = buffer.toString('base64');
        const imageUrl = `data:image/jpeg;base64,${base64Image}`;
        
        // Generate response data
        const domain = getDomainFromUrl(url);
        const responseData = {
            status: true,
            data: [
                {
                    title: generateTitle(url),
                    link: imageUrl,
                    developer: generateDeveloperInfo(url),
                    image: imageUrl,
                    domain: domain,
                    url: url,
                    timestamp: new Date().toISOString(),
                    format: 'jpeg',
                    size: buffer.length,
                    dimensions: '1280x720' // Default dimensions, bisa disesuaikan
                }
            ],
            meta: {
                response_time: responseTime,
                credits: "HXS API - Home & Start",
                version: "1.0.0"
            }
        };

        addLog({
            ip: clientIP,
            method: 'GET',
            endpoint: '/api/ssweb',
            status: 200,
            userAgent: req.headers['user-agent'],
            url: url,
            responseTime: responseTime,
            format: format
        });

        // Return berdasarkan format yang diminta
        if (format === 'image') {
            // Return langsung gambar
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('X-Response-Time', `${responseTime}ms`);
            res.setHeader('Content-Disposition', `inline; filename="screenshot-${domain}-${Date.now()}.jpg"`);
            return res.send(buffer);
        } else {
            // Return JSON response (default)
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Response-Time', `${responseTime}ms`);
            return res.json(responseData);
        }
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        addLog({
            ip: clientIP,
            method: 'GET',
            endpoint: '/api/ssweb',
            status: 500,
            userAgent: req.headers['user-agent'],
            error: error.message,
            responseTime: responseTime
        });
        
        return res.status(500).json({
            success: false,
            message: 'Gagal mengambil screenshot',
            error: error.message,
            status: false
        });
    }
}
