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
  
  // Extract video ID from URL
  extractVideoId(url) {
    const patterns = [
      /youtu\.be\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  },
  
  // Clean URL and get video info
  async getDownloadInfo(url, format = 'mp3') {
    try {
      const videoId = this.extractVideoId(url);
      if (!videoId) {
        throw new Error('Tidak dapat mengekstrak Video ID dari URL');
      }
      
      this.log(`Processing video ID: ${videoId} for format: ${format}`);
      
      // Use ytdlp.online API
      const payload = {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        format: format
      };
      
      const response = await axios.post(`${this.static.baseUrl}/api/download`, payload, {
        headers: this.static.headers,
        timeout: 30000
      });
      
      if (response.data && response.data.success) {
        return {
          downloadUrl: response.data.download_url,
          filename: response.data.filename || `youtube_${videoId}.${format}`,
          filesize: response.data.filesize || 0,
          duration: response.data.duration || 0,
          format: format,
          quality: format === 'mp3' ? '128k' : '720p',
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          title: response.data.title || 'YouTube Audio',
          videoId: videoId
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
    
    // Clean URL - remove everything after ?
    const cleanUrl = url.split('?')[0];
    yt.log(`Original URL: ${url}`);
    yt.log(`Cleaned URL: ${cleanUrl}`);
    
    // Validate YouTube URL
    const youtubePatterns = [
      /youtu\.be\/[a-zA-Z0-9_-]+/,
      /youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/,
      /youtube\.com\/shorts\/[a-zA-Z0-9_-]+/
    ];
    
    const isValidUrl = youtubePatterns.some(pattern => pattern.test(cleanUrl));
    
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
          ]
        }
      });
    }
    
    const downloadInfo = await yt.getDownloadInfo(cleanUrl, 'mp3');
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
        video_id: downloadInfo.videoId,
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
    let errorMessage = error.message;
    let errorType = 'API_ERROR';
    let statusCode = 500;
    
    if (error.message.includes('Video ID')) {
      errorMessage = 'URL YouTube tidak valid';
      errorType = 'VALIDATION_ERROR';
      statusCode = 400;
    } else if (error.response?.status === 404 || error.message.includes('not found')) {
      errorMessage = 'Video tidak ditemukan atau tidak dapat diakses';
      errorType = 'NOT_FOUND_ERROR';
      statusCode = 404;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Timeout: Server mengambil waktu terlalu lama';
      errorType = 'TIMEOUT_ERROR';
      statusCode = 408;
    } else if (error.response?.status === 429) {
      errorMessage = 'Terlalu banyak request, coba lagi nanti';
      errorType = 'RATE_LIMIT_ERROR';
      statusCode = 429;
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
          'Pastikan URL YouTube valid dan publik',
          'Coba URL pendek: https://youtu.be/VIDEO_ID',
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
