// In-memory storage untuk gambar (sementara)
const imageCache = new Map();
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 jam

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

// Cleanup cache yang expired
function cleanupCache() {
    const now = Date.now();
    for (const [key, value] of imageCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            imageCache.delete(key);
        }
    }
}

// Jalankan cleanup setiap jam
setInterval(cleanupCache, 60 * 60 * 1000);

export default async function handler(req, res) {
    const startTime = Date.now();
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Handle image serving dari cache
    if (req.method === 'GET' && req.url.includes('/img/')) {
        const imageId = req.url.split('/').pop();
        
        if (!imageId || !imageCache.has(imageId)) {
            return res.status(404).json({
                success: false,
                message: 'Image not found or expired'
            });
        }
        
        const cached = imageCache.get(imageId);
        const buffer = Buffer.from(cached.data);
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Image-Id', imageId);
        
        return res.send(buffer);
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }
    
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'Parameter url diperlukan'
            });
        }
        
        // Validate URL
        try {
            new URL(url);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Format URL tidak valid'
            });
        }

        const buffer = await ssweb.capture(url);
        const responseTime = Date.now() - startTime;

        // Simpan ke memory cache dengan ID unik
        const imageId = `ss_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        imageCache.set(imageId, {
            data: buffer.toString('base64'),
            timestamp: Date.now(),
            url: url
        });
        
        const imageUrl = `https://hxs-apis.vercel.app/api/ssweb/img/${imageId}`;
        
        // Generate response data dengan URL
        const domain = getDomainFromUrl(url);
        const responseData = {
            status: true,
            data: [
                {
                    title: `Screenshot of ${domain}`,
                    link: imageUrl,
                    developer: `${domain} Development Team`,
                    image: imageUrl,
                    domain: domain,
                    url: url,
                    timestamp: new Date().toISOString(),
                    format: 'jpeg',
                    size: buffer.length,
                    dimensions: '1280x720',
                    expires_in: '2 hours',
                    image_id: imageId,
                    download_info: `Image URL: ${imageUrl} (expires in 2 hours)`
                }
            ],
            meta: {
                response_time: responseTime,
                credits: "HXS API - Home & Start",
                version: "1.0.0",
                cache_info: `Cached ${imageCache.size} images`,
                usage: `Use the 'image' field directly: <img src='${imageUrl}' />`
            }
        };

        // Return JSON dengan image URL
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        return res.json(responseData);
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        console.error('SSWeb Error:', error.message);
        
        return res.status(500).json({
            success: false,
            message: 'Gagal mengambil screenshot',
            error: error.message,
            status: false
        });
    }
}
