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

export default async function handler(req, res) {
    const startTime = Date.now();
    
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
        const { url, format = 'json' } = req.query;
        
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
        const domain = getDomainFromUrl(url);

        // FORMAT 1: Langsung return image (untuk bot WA)
        if (format === 'image' || format === 'raw') {
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('X-Screenshot-Of', url);
            res.setHeader('X-Response-Time', `${responseTime}ms`);
            return res.send(buffer);
        }

        // FORMAT 2: Base64 (untuk bot WA yang butuh base64)
        if (format === 'base64') {
            const base64Image = buffer.toString('base64');
            return res.json({
                status: true,
                base64: base64Image,
                domain: domain,
                url: url,
                size: buffer.length,
                response_time: responseTime
            });
        }

        // FORMAT 3: JSON dengan semua options (default)
        const base64Image = buffer.toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64Image}`;
        const imageUrl = `${getBaseUrl(req)}/api/ssweb?url=${encodeURIComponent(url)}&format=image`;
        
        const responseData = {
            status: true,
            data: {
                // Untuk bot WA (pilih salah satu)
                buffer_size: buffer.length,
                base64: base64Image, // Langsung bisa dipakai
                image_url: imageUrl, // URL langsung ke image
                data_url: dataUrl,   // Data URL
                
                // Info tambahan
                domain: domain,
                url: url,
                timestamp: new Date().toISOString(),
                format: 'jpeg',
                dimensions: '1280x720',
                response_time: responseTime
            },
            usage: {
                for_bot: "Gunakan 'base64' field dan convert ke Buffer",
                for_web: "Gunakan 'image_url' atau 'data_url'",
                example: "Buffer.from(data.base64, 'base64')"
            }
        };

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

// Helper untuk mendapatkan base URL
function getBaseUrl(req) {
    const host = req.headers['x-forwarded-host'] || req.headers['host'];
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    return `${protocol}://${host}`;
}
