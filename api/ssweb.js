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
        const fetch = (await import('node-fetch')).default;
        const r = await fetch(this._static.baseUrl, { headers: this._static.baseHeaders })
        if (!r.ok) throw Error(`${r.status} ${r.statusText} ${this.pretyError(await r.text())}`)
        const cookie = r.headers.get('set-cookie')?.split(',').map(v => v.split(';')[0]).join('; ') || ''
        if (!cookie) throw Error('gagal mendapatkan kuki')
        return { cookie }
    },
    async getBuffer(reqObj, cookie) {
        const fetch = (await import('node-fetch')).default;
        if (reqObj.status !== "success") throw Error("status nya gak sukses")
        const { link } = reqObj
        const r = await fetch(this._static.baseUrl + '/' + link, { headers: { cookie } })
        if (!r.ok) throw Error(`${r.status} ${r.statusText} ${this.pretyError(await r.text())}`)
        const ab = await r.arrayBuffer()
        return { buffer: Buffer.from(ab) }
    },
    async req(url, cookie) {
        const fetch = (await import('node-fetch')).default;
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
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method tidak diizinkan. Hanya GET yang diperbolehkan.'
        });
    }

    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'Parameter url diperlukan. Contoh: /api/ssweb?url=https://example.com'
            });
        }

        // Validasi URL
        try {
            new URL(url);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Format URL tidak valid'
            });
        }

        console.log(`Mengambil screenshot untuk: ${url}`);
        
        const buffer = await ssweb.capture(url);
        
        // Set header untuk response gambar
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600'); // Cache 1 jam
        res.setHeader('CDN-Cache-Control', 'public, max-age=3600');
        res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=3600');
        
        res.send(buffer);
        
    } catch (error) {
        console.error('Error mengambil screenshot:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil screenshot',
            error: error.message
        });
    }
}
