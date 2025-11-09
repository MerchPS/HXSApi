import axios from 'axios';

const yt = {
  static: Object.freeze({
    baseUrl: 'https://cnv.cx',
    headers: {
      'accept-encoding': 'gzip, deflate, br, zstd',
      'origin': 'https://frame.y2meta-uk.com',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0'
    }
  }),
  log(m) { console.log(`[yt-skrep] ${m}`) },
  resolveConverterPayload(link, f = '128k') {
    const a = ['128k', '320k', '144p', '240p', '360p', '720p', '1080p']
    if (!a.includes(f)) throw Error(`invalid format. available: ${a.join(', ')}`)
    const t = f.endsWith('k') ? 'mp3' : 'mp4'
    const b = t === 'mp3' ? parseInt(f) + '' : '128'
    const v = t === 'mp4' ? parseInt(f) + '' : '720'
    return { link, format: t, audioBitrate: b, videoQuality: v, filenameStyle: 'pretty', vCodec: 'h264' }
  },
  sanitizeFileName(n) {
    const e = n.match(/\.[^.]+$/)[0]
    const f = n.replace(new RegExp(`\\${e}$`), '').replaceAll(/[^A-Za-z0-9]/g, '_').replace(/_+/g, '_').toLowerCase()
    return f + e
  },
  async getKey() {
    const r = await fetch(this.static.baseUrl + '/v2/sanity/key', { headers: this.static.headers })
    if (!r.ok) throw Error(`${r.status} ${r.statusText}`)
    return await r.json()
  },
  async convert(u, f) {
    const { key } = await this.getKey()
    const p = this.resolveConverterPayload(u, f)
    const h = { key, ...this.static.headers }
    const r = await fetch(this.static.baseUrl + '/v2/converter', { headers: h, method: 'post', body: new URLSearchParams(p) })
    if (!r.ok) throw Error(`${r.status} ${r.statusText}`)
    return await r.json()
  },
  async getDownloadInfo(u, f) {
    const { url, filename, filesize, duration } = await this.convert(u, f)
    return { 
      downloadUrl: url, 
      filename: this.sanitizeFileName(filename),
      filesize,
      duration,
      format: f.endsWith('k') ? 'mp3' : 'mp4'
    }
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
      error: {
        message: 'Method not allowed',
        type: 'METHOD_ERROR',
        status: 405
      }
    });
  }
  
  try {
    const { url, quality = '128k' } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Parameter url diperlukan',
          type: 'VALIDATION_ERROR',
          status: 400,
          details: 'Gunakan parameter: url=youtube_url&quality=128k'
        },
        meta: {
          available_qualities: ['128k', '320k'],
          example: '/api/ytmp3?url=https://youtu.be/VIDEO_ID&quality=320k'
        }
      });
    }
    
    // Validate YouTube URL
    if (!url.match(/youtu\.be|youtube\.com|youtu\./)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'URL YouTube tidak valid',
          type: 'VALIDATION_ERROR',
          status: 400
        }
      });
    }
    
    // Validate quality
    const validQualities = ['128k', '320k'];
    if (!validQualities.includes(quality)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Quality tidak valid. Gunakan: ${validQualities.join(', ')}`,
          type: 'VALIDATION_ERROR',
          status: 400
        }
      });
    }
    
    const downloadInfo = await yt.getDownloadInfo(url, quality);
    const responseTime = Date.now() - startTime;
    
    // Generate response data
    const responseData = {
      success: true,
      data: {
        download_url: downloadInfo.downloadUrl,
        filename: downloadInfo.filename,
        format: downloadInfo.format,
        quality: quality,
        filesize: downloadInfo.filesize,
        duration: downloadInfo.duration,
        type: 'audio',
        timestamp: new Date().toISOString()
      },
      meta: {
        response_time: responseTime,
        credits: "HXS YouTube API - Home & Start",
        version: "1.0.0",
        usage: {
          direct_download: `Klik link download_url untuk mengunduh langsung`,
          stream: `Gunakan download_url sebagai audio source di web/mobile`,
          note: "Link download berlaku untuk waktu terbatas"
        }
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    return res.json(responseData);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('YouTube MP3 Error:', error);
    
    // Handle specific errors
    let errorMessage = error.message;
    let errorType = 'API_ERROR';
    let statusCode = 500;
    
    if (error.message.includes('invalid format') || error.message.includes('invalid URL')) {
      errorMessage = 'URL YouTube tidak valid atau format tidak didukung';
      errorType = 'VALIDATION_ERROR';
      statusCode = 400;
    } else if (error.message.includes('404') || error.message.includes('Not Found')) {
      errorMessage = 'Video tidak ditemukan atau tidak dapat diakses';
      errorType = 'NOT_FOUND_ERROR';
      statusCode = 404;
    }
    
    const errorResponse = {
      success: false,
      error: {
        message: errorMessage,
        type: errorType,
        status: statusCode,
        timestamp: new Date().toISOString()
      },
      meta: {
        response_time: responseTime,
        credits: "HXS YouTube API - Home & Start",
        version: "1.0.0",
        available_qualities: ['128k', '320k']
      }
    };
    
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    return res.status(statusCode).json(errorResponse);
  }
}

// Export function untuk penggunaan langsung
export { yt };
