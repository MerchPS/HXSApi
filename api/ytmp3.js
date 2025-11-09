import axios from 'axios';

const yt = {
  static: Object.freeze({
    baseUrl: 'https://api.yt-dlp.download',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'accept-encoding': 'gzip, deflate, br',
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  }),
  
  log(m) { console.log(`[yt-downloader] ${m}`) },
  
  // Clean URL from extra parameters
  cleanUrl(url) {
    try {
      // Remove everything after ?si= parameters
      let cleanUrl = url.split('?')[0];
      
      // If it's youtu.be short URL, ensure it's proper
      if (cleanUrl.includes('youtu.be/')) {
        const videoId = cleanUrl.split('youtu.be/')[1];
        if (videoId) {
          cleanUrl = `https://youtu.be/${videoId}`;
        }
      }
      
      // If it's youtube.com URL, ensure it's proper
      if (cleanUrl.includes('youtube.com/watch?v=')) {
        const urlParams = new URL(cleanUrl);
        const videoId = urlParams.searchParams.get('v');
        if (videoId) {
          cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
        }
      }
      
      this.log(`Cleaned URL: ${cleanUrl}`);
      return cleanUrl;
    } catch (error) {
      this.log(`Error cleaning URL: ${error.message}`);
      return url.split('?')[0]; // Fallback: just remove parameters
    }
  },
  
  async getDownloadInfo(url, format = 'mp3') {
    try {
      const cleanUrl = this.cleanUrl(url);
      this.log(`Fetching download info for: ${cleanUrl}`);
      
      // Try multiple API endpoints
      const endpoints = [
        {
          url: 'https://api.yt-dlp.download/api/info',
          method: 'POST',
          payload: { url: cleanUrl, format: format }
        },
        {
          url: 'https://ytapi.download/api/info',
          method: 'POST', 
          payload: { url: cleanUrl, format: format }
        }
      ];
      
      let response;
      let lastError;
      
      for (const endpoint of endpoints) {
        try {
          this.log(`Trying endpoint: ${endpoint.url}`);
          response = await axios({
            method: endpoint.method,
            url: endpoint.url,
            data: endpoint.payload,
            headers: this.static.headers,
            timeout: 15000
          });
          
          if (response.data && response.data.success) {
            break;
          }
        } catch (error) {
          lastError = error;
          this.log(`Endpoint failed: ${error.message}`);
          continue;
        }
      }
      
      if (!response || !response.data.success) {
        throw new Error(lastError?.message || 'All API endpoints failed');
      }
      
      const data = response.data;
      
      return {
        downloadUrl: data.download_url || data.url,
        filename: data.filename || `download.${format}`,
        filesize: data.filesize || data.size || 0,
        duration: data.duration || 0,
        format: format,
        quality: format === 'mp3' ? '320k' : '720p',
        thumbnail: data.thumbnail,
        title: data.title,
        description: data.description
      };
      
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
    let { url } = req.method === 'GET' ? req.query : req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Parameter url diperlukan',
          type: 'VALIDATION_ERROR',
          status: 400
        },
        meta: {
          example: '/api/ytmp3?url=https://youtu.be/VIDEO_ID',
          note: 'URL akan otomatis dibersihkan dari parameter tambahan'
        }
      });
    }
    
    // Validate YouTube URL pattern
    const youtubePatterns = [
      /youtu\.be\/[a-zA-Z0-9_-]+/,
      /youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/,
      /youtube\.com\/shorts\/[a-zA-Z0-9_-]+/
    ];
    
    const isValidUrl = youtubePatterns.some(pattern => pattern.test(url));
    
    if (!isValidUrl) {
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
          ],
          note: 'Parameter seperti ?si= akan otomatis dihapus'
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
        timestamp: new Date().toISOString(),
        original_url: url,
        cleaned_url: yt.cleanUrl(url)
      },
      meta: {
        response_time: responseTime,
        credits: "HXS YouTube API - Home & Start",
        version: "1.0.0",
        usage: {
          direct_download: `Klik link download_url untuk mengunduh langsung`,
          stream: `Gunakan download_url sebagai audio source`,
          note: "Link download berlaku untuk waktu terbatas"
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
    let errorMessage = 'Gagal mengambil informasi download';
    let errorType = 'API_ERROR';
    let statusCode = 500;
    
    if (error.message.includes('not found') || error.response?.status === 404) {
      errorMessage = 'Video tidak ditemukan atau tidak dapat diakses';
      errorType = 'NOT_FOUND_ERROR';
      statusCode = 404;
    } else if (error.message.includes('invalid') || error.response?.status === 400) {
      errorMessage = 'URL YouTube tidak valid';
      errorType = 'VALIDATION_ERROR';
      statusCode = 400;
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorMessage = 'Timeout: Server mengambil waktu terlalu lama';
      errorType = 'TIMEOUT_ERROR';
      statusCode = 408;
    } else if (error.message.includes('All API endpoints failed')) {
      errorMessage = 'Semua service download sedang sibuk, coba lagi nanti';
      errorType = 'SERVICE_UNAVAILABLE';
      statusCode = 503;
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
        troubleshooting: [
          'Pastikan URL YouTube valid',
          'Coba tanpa parameter ?si=',
          'Video mungkin tidak tersedia untuk download',
          'Coba lagi dalam beberapa menit'
        ]
      }
    };
    
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    return res.status(statusCode).json(errorResponse);
  }
}

// Export function untuk penggunaan langsung
export { yt };
