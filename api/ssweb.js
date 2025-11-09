import { addLog } from '../lib/logger.js';
import { incrementRequest } from '../lib/requestCounter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Buat folder temporary untuk menyimpan gambar
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Cleanup function untuk hapus file lama
function cleanupOldFiles() {
    const now = Date.now();
    const maxAge = 2 * 60 * 60 * 1000; // 2 jam
    
    try {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            const stats = fs.statSync(filePath);
            
            if (now - stats.mtime.getTime() > maxAge) {
                fs.unlinkSync(filePath);
                console.log(`Deleted old file: ${file}`);
            }
        });
    } catch (error) {
        console.error('Cleanup error:', error.message);
    }
}

// Jalankan cleanup setiap 30 menit
setInterval(cleanupOldFiles, 30 * 60 * 1000);

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

// Function untuk save buffer ke file
function saveImageToTemp(buffer) {
    const filename = `ss_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpeg`;
    const filepath = path.join(tempDir, filename);
    
    fs.writeFileSync(filepath, buffer);
    return filename;
}

// Function untuk serve static image
export async function serveImage(req, res) {
    const { filename } = req.query;
    
    if (!filename) {
        return res.status(400).json({ error: 'Filename required' });
    }
    
    // Security: hanya allow alphanumeric, underscore, dan dot
    if (!/^[a-zA-Z0-9_.-]+\.jpeg$/.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filepath = path.join(tempDir, filename);
    
    try {
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Image not found or expired' });
        }
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache 1 jam
        res.sendFile(filepath);
        
    } catch (error) {
        res.status(500).json({ error: 'Failed to serve image' });
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
    
    // Handle image serving
    if (req.method === 'GET' && req.url.includes('/api/img/')) {
        const filename = req.url.split('/').pop();
        req.query = { filename };
        return serveImage(req, res);
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

        // Increment request counter - TIDAK blocking
        incrementRequest('/api/ssweb').then(requestStats => {
            console.log('Request counter updated:', requestStats);
        }).catch(error => {
            console.error('Error updating request counter:', error);
        });

        const buffer = await ssweb.capture(url);
        const responseTime = Date.now() - startTime;

        // Simpan ke temporary file dan dapatkan URL
        const filename = saveImageToTemp(buffer);
        const imageUrl = `https://hxs-apis.vercel.app/api/img/${filename}`;
        
        // Generate response data dengan URL
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
                    dimensions: '1280x720',
                    expires_in: '2 hours',
                    download_info: `Image URL: ${imageUrl} (expires in 2 hours)`
                }
            ],
            meta: {
                response_time: responseTime,
                credits: "HXS API - Home & Start",
                version: "1.0.0",
                usage: `Use the 'image' field directly in your HTML: <img src='${imageUrl}' />`
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
            filename: filename
        });

        // Return JSON dengan image URL
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        return res.json(responseData);
        
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
