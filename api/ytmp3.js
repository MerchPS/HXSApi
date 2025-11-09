import axios from 'axios';

const yt = {
  static: Object.freeze({
    baseUrl: 'https://ytdlp.online',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'accept-encoding': 'gzip, deflate, br',
      'content-type': 'application/json',
      'origin': 'https://ytdlp.online',
      'referer': 'https://ytdlp.online/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  }),
  
  log(m) { console.log(`[yt-downloader] ${m}`) },
  
  async getDownloadInfo(url, format = 'mp3') {
    try {
      this.log(`Fetching download info for: ${url}`);
      
      const payload = {
        url: url,
        format: format,
        quality: format === 'mp3' ? '320' : '720'
      };
      
      const response = await axios.post(`${this.static.baseUrl}/api/download`, payload, {
        headers: this.static.headers,
        timeout: 30000
      });
      
      if (response.data && response.data.success) {
        return {
          downloadUrl: response.data.download_url,
          filename: response.data.filename || `download.${format}`,
          filesize: response.data.filesize || 0,
          duration: response.data.duration || 0,
          format: format,
          quality: format === 'mp3' ? '320k' : '720p',
          thumbnail: response.data.thumbnail,
          title: response.data.title
        };
      } else {
        throw new Error(response.data?.message || 'Failed to get download info');
      }
      
    } catch (error) {
      this.log(`Error: ${error.message}`);
      throw error;
    }
  },
  
  sanitizeFileName(filename) {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_+/g, '_');
  }
}

export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET' && req.method !== 'POST') {
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
    let { url, quality = '320k' } = req.method === 'GET' ? req.query : req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Parameter url diperlukan',
          type: 'VALIDATION_ERROR',
          status: 400,
          details: 'Gunakan parameter: url=youtube_url'
        },
        meta: {
          example: '/api/ytmp3?url=https://youtu.be/VIDEO_ID',
          supported_platforms: ['YouTube', 'YouTube Music']
        }
      });
    }
    
    // Validate YouTube URL
    if (!url.match(/(youtu\.be|youtube\.com|youtube\.com\/watch\?v=)/)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'URL YouTube tidak valid',
          type: 'VALIDATION_ERROR',
          status: 400
        },
        meta: {
          example_formats: [
            'https://youtu.be/VIDEO_ID',
            'https://www.youtube.com/watch?v=VIDEO_ID',
            'https://youtube.com/shorts/VIDEO_ID'
          ]
        }
      });
    }
    
    const downloadInfo = await yt.getDownloadInfo(url, 'mp3');
    const responseTime = Date.now() - startTime;
    
    // Generate response data
    const responseData = {
      success: true,
      data: {
        download_url: downloadInfo.downloadUrl,
        filename: downloadInfo.filename,
        format: downloadInfo.format,
        quality: downloadInfo.quality,
        filesize: downloadInfo.filesize,
        duration: downloadInfo.duration,
        title: downloadInfo.title,
        thumbnail: downloadInfo.thumbnail,
        type: 'audio',
        timestamp: new Date().toISOString()
      },
      meta: {
        response_time: responseTime,
        credits: "HXS YouTube API - Home & Start",
        version: "1.0.0",
        usage: {
          direct_download: `Klik link download_url untuk mengunduh langsung`,
          stream: `Gunakan download_url sebagai audio source`,
          html_audio: `<audio controls><source src="${downloadInfo.downloadUrl}" type="audio/mpeg"></audio>`,
          note: "Link download berlaku untuk waktu terbatas (biasanya 6-24 jam)"
        }
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    return res.json(responseData);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('YouTube MP3 Error:', error.response?.data || error.message);
    
    // Handle specific errors
    let errorMessage = error.message;
    let errorType = 'API_ERROR';
    let statusCode = 500;
    
    if (error.response?.status === 404 || error.message.includes('not found')) {
      errorMessage = 'Video tidak ditemukan atau tidak dapat diakses';
      errorType = 'NOT_FOUND_ERROR';
      statusCode = 404;
    } else if (error.response?.status === 400 || error.message.includes('invalid')) {
      errorMessage = 'URL YouTube tidak valid atau format tidak didukung';
      errorType = 'VALIDATION_ERROR';
      statusCode = 400;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Timeout: Server mengambil waktu terlalu lama';
      errorType = 'TIMEOUT_ERROR';
      statusCode = 408;
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
        supported_platforms: ['YouTube', 'YouTube Music']
      }
    };
    
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    return res.status(statusCode).json(errorResponse);
  }
}

// Export function untuk penggunaan langsung
export { yt };
