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
        const { url } = req.query;
        
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
        try {
            new URL(url);
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

        // Increment request counter
        const requestStats = await incrementRequest('/api/ssweb');
        
        const buffer = await ssweb.capture(url);
        const responseTime = Date.now() - startTime;
        
        addLog({
            ip: clientIP,
            method: 'GET',
            endpoint: '/api/ssweb',
            status: 200,
            userAgent: req.headers['user-agent'],
            url: url,
            responseTime: responseTime,
            requestStats: requestStats
        });
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        res.setHeader('X-Total-Requests', requestStats.totalAllRequests);
        res.setHeader('X-Today-Requests', requestStats.totalTodayRequests);
        
        return res.send(buffer);
        
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
            error: error.message
        });
    }
}
