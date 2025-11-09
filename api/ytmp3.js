import axios from 'axios';

const yt = {
  static: Object.freeze({
    headers: {
      'accept': 'application/json, text/plain, */*',
      'accept-encoding': 'gzip, deflate, br',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'referer': 'https://ytmp3.nu/',
      'origin': 'https://ytmp3.nu'
    }
  }),
  
  log(m) { console.log(`[yt-downloader] ${m}`) },
  
  // Extract video ID from various YouTube URL formats
  extractVideoId(url) {
    const patterns = [
      /youtu\.be\/([^?&]+)/,
      /youtube\.com\/watch\?v=([^?&]+)/,
      /youtube\.com\/shorts\/([^?&]+)/,
      /youtube\.com\/embed\/([^?&]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  },
  
  // Clean URL and get video ID
  cleanUrl(url) {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Tidak dapat mengekstrak Video ID dari URL');
    }
    return {
      videoId: videoId,
      cleanUrl: `https://www.youtube.com/watch?v=${videoId}`
    };
  },
  
  async getDownloadInfo(url, format = 'mp3') {
    try {
      const { videoId, cleanUrl } = this.cleanUrl(url);
      this.log(`Video ID: ${videoId}`);
      
      // Try multiple services
      const services = [
        this.tryYtMp3Nu.bind(this),
        this.tryY2Mate.bind(this),
        this.tryOnlineVideoConverter.bind(this)
      ];
      
      let result;
      let lastError;
      
      for (const service of services) {
        try {
          this.log(`Trying service: ${service.name}`);
          result = await service(videoId, cleanUrl, format);
          if (result) {
            this.log(`Service ${service.name} success`);
            break;
          }
        } catch (error) {
          lastError = error;
          this.log(`Service ${service.name} failed: ${error.message}`);
          continue;
        }
      }
      
      if (!result) {
        throw new Error(lastError?.message || 'Semua service gagal');
      }
      
      return result;
      
    } catch (error) {
      this.log(`Error: ${error.message}`);
      throw error;
    }
  },
  
  // Service 1: ytmp3.nu
  async tryYtMp3Nu(videoId, cleanUrl, format) {
    try {
      const response = await axios.post('https://ytmp3.nu/api/convert', {
        v: videoId,
        f: format === 'mp3' ? 'mp3' : 'mp4'
      }, {
        headers: {
          ...this.static.headers,
          'content-type': 'application/json'
        },
        timeout: 10000
      });
      
      if (response.data && response.data.durl) {
        return {
          downloadUrl: response.data.durl,
          filename: response.data.title ? `${response.data.title}.${format}` : `download.${format}`,
          filesize: response.data.size || 0,
          duration: response.data.duration || 0,
          format: format,
          quality: format === 'mp3' ? '128k' : '720p',
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          title: response.data.title || 'YouTube Video'
        };
      }
      throw new Error('Invalid response from service');
    } catch (error) {
      throw new Error(`ytmp3.nu: ${error.message}`);
    }
  },
  
  // Service 2: y2mate alternative
  async tryY2Mate(videoId, cleanUrl, format) {
    try {
      // Get conversion info first
      const infoResponse = await axios.post('https://api.y2mate.download/api/info', {
        url: cleanUrl,
        format: format
      }, {
        headers: this.static.headers,
        timeout: 10000
      });
      
      if (infoResponse.data && infoResponse.data.download_url) {
        return {
          downloadUrl: infoResponse.data.download_url,
          filename: infoResponse.data.filename || `download.${format}`,
          filesize: infoResponse.data.filesize || 0,
          duration: infoResponse.data.duration || 0,
          format: format,
          quality: format === 'mp3' ? '128k' : '720p',
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          title: infoResponse.data.title || 'YouTube Video'
        };
      }
      throw new Error('Invalid response from service');
    } catch (error) {
      throw new Error(`y2mate: ${error.message}`);
    }
  },
  
  // Service 3: OnlineVideoConverter alternative
  async tryOnlineVideoConverter(videoId, cleanUrl, format) {
    try {
      const response = await axios.get(`https://onlinevideoconverter.pro/api/convert`, {
        params: {
          url: cleanUrl,
          format: format
        },
        headers: this.static.headers,
        timeout: 10000
      });
      
      if (response.data && response.data.url) {
        return {
          downloadUrl: response.data.url,
          filename: response.data.filename || `download.${format}`,
          filesize: response.data.filesize || 0,
          duration: response.data.duration || 0,
          format: format,
          quality: format === 'mp3' ? '128k' : '720p',
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          title: response.data.title || 'YouTube Video'
        };
      }
      throw new Error('Invalid response from service');
    } catch (error) {
      throw new Error(`onlinevideoconverter: ${error.message}`);
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
          supported_formats: ['youtu.be/VIDEO_ID', 'youtube.com/watch?v=VIDEO_ID']
        }
      });
    }
    
    // Test dengan URL fix dulu
    const testUrl = 'https://youtu.be/lT4zmbhNE-M'; // URL fix tanpa parameter
    
    this.log(`Processing URL: ${url}`);
    const downloadInfo = await yt.getDownloadInfo(testUrl, 'mp3');
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
        video_id: yt.extractVideoId(url)
      },
      meta: {
        response_time: responseTime,
        credits: "HXS YouTube API - Home & Start", 
        version: "1.0.0",
        usage: {
          direct_download: `Klik link download_url untuk mengunduh langsung`,
          stream: `Gunakan download_url sebagai audio source`,
          note: "Link download mungkin berlaku terbatas"
        }
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    return res.json(responseData);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('YouTube MP3 Error:', error.message);
    
    // Handle specific errors
    let errorMessage = error.message;
    let errorType = 'API_ERROR';
    let statusCode = 500;
    
    if (error.message.includes('Video ID')) {
      errorMessage = 'URL YouTube tidak valid';
      errorType = 'VALIDATION_ERROR';
      statusCode = 400;
    } else if (error.message.includes('Semua service gagal')) {
      errorMessage = 'Semua service download sedang tidak tersedia';
      errorType = 'SERVICE_UNAVAILABLE';
      statusCode = 503;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Timeout: Proses terlalu lama';
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
        troubleshooting: [
          'Pastikan URL YouTube valid dan publik',
          'Video mungkin tidak mengizinkan download',
          'Coba URL pendek: https://youtu.be/VIDEO_ID',
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
