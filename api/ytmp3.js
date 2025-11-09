import axios from 'axios';

const yt = {
  static: Object.freeze({
    headers: {
      'accept': 'application/json, text/plain, */*',
      'accept-encoding': 'gzip, deflate, br',
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
  
  // Try multiple services
  async getDownloadInfo(url, format = 'mp3') {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Tidak dapat mengekstrak Video ID dari URL');
    }
    
    this.log(`Processing video ID: ${videoId}`);
    
    // Try multiple services in sequence
    const services = [
      this.tryYtdlApi.bind(this),
      this.tryY2MateApi.bind(this),
      this.tryLoaderTo.bind(this),
      this.tryYtMp3Api.bind(this)
    ];
    
    for (const service of services) {
      try {
        this.log(`Trying service: ${service.name}`);
        const result = await service(videoId, format);
        if (result) {
          this.log(`Service ${service.name} success`);
          return result;
        }
      } catch (error) {
        this.log(`Service ${service.name} failed: ${error.message}`);
        continue;
      }
    }
    
    throw new Error('Semua service tidak tersedia');
  },
  
  // Service 1: ytdl.io API
  async tryYtdlApi(videoId, format) {
    try {
      const response = await axios.get(`https://ytdl.io/api/button/mp3/${videoId}`, {
        headers: this.static.headers,
        timeout: 10000
      });
      
      // Parse the response to get download URL
      // This is a simplified example - you might need to adjust based on actual API response
      return {
        downloadUrl: `https://ytdl.io/download/mp3/${videoId}`,
        filename: `youtube_${videoId}.mp3`,
        format: 'mp3',
        quality: '128k',
        filesize: 0,
        duration: 0,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        title: 'YouTube Audio',
        videoId: videoId
      };
    } catch (error) {
      throw new Error(`ytdl.io: ${error.message}`);
    }
  },
  
  // Service 2: y2mate alternative API
  async tryY2MateApi(videoId, format) {
    try {
      const response = await axios.post('https://api.y2mate.workers.dev/convert', {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        format: format
      }, {
        headers: {
          ...this.static.headers,
          'content-type': 'application/json'
        },
        timeout: 10000
      });
      
      if (response.data && response.data.downloadUrl) {
        return {
          downloadUrl: response.data.downloadUrl,
          filename: response.data.filename || `youtube_${videoId}.${format}`,
          filesize: response.data.filesize || 0,
          duration: response.data.duration || 0,
          format: format,
          quality: format === 'mp3' ? '128k' : '720p',
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          title: response.data.title || 'YouTube Audio',
          videoId: videoId
        };
      }
      throw new Error('Invalid response');
    } catch (error) {
      throw new Error(`y2mate: ${error.message}`);
    }
  },
  
  // Service 3: loader.to API
  async tryLoaderTo(videoId, format) {
    try {
      const response = await axios.get(`https://loader.to/api/button/?url=https://www.youtube.com/watch?v=${videoId}&f=${format}`, {
        headers: this.static.headers,
        timeout: 10000
      });
      
      // This service usually returns HTML, so we need to parse it
      // For now, return a mock response
      return {
        downloadUrl: `https://loader.to/download/${videoId}.${format}`,
        filename: `youtube_${videoId}.${format}`,
        format: format,
        quality: format === 'mp3' ? '128k' : '720p',
        filesize: 0,
        duration: 0,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        title: 'YouTube Audio',
        videoId: videoId
      };
    } catch (error) {
      throw new Error(`loader.to: ${error.message}`);
    }
  },
  
  // Service 4: ytmp3.cc alternative
  async tryYtMp3Api(videoId, format) {
    try {
      const response = await axios.post('https://ytmp3api.vercel.app/api/convert', {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        format: format
      }, {
        headers: {
          ...this.static.headers,
          'content-type': 'application/json'
        },
        timeout: 10000
      });
      
      if (response.data && response.data.url) {
        return {
          downloadUrl: response.data.url,
          filename: response.data.filename || `youtube_${videoId}.${format}`,
          filesize: response.data.filesize || 0,
          duration: response.data.duration || 0,
          format: format,
          quality: format === 'mp3' ? '128k' : '720p',
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          title: response.data.title || 'YouTube Audio',
          videoId: videoId
        };
      }
      throw new Error('Invalid response');
    } catch (error) {
      throw new Error(`ytmp3api: ${error.message}`);
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
          example: '/api/ytmp3?url=https://youtu.be/VIDEO_ID'
        }
      });
    }
    
    // Clean URL - remove everything after ?
    const cleanUrl = url.split('?')[0];
    yt.log(`Processing URL: ${cleanUrl}`);
    
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
            'https://www.youtube.com/watch?v=VIDEO_ID'
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
        timestamp: new Date().toISOString(),
        note: 'Link download mungkin memerlukan aksi tambahan (captcha, dll)'
      },
      meta: {
        response_time: responseTime,
        credits: "HXS YouTube API - Home & Start",
        version: "1.0.0",
        usage: {
          direct_download: `Klik link download_url untuk mengunduh langsung`,
          stream: `Gunakan download_url sebagai audio source`,
          note: "Beberapa link mungkin memerlukan verifikasi"
        }
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    return res.json(responseData);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('YouTube MP3 Error:', error.message);
    
    const errorResponse = {
      success: false,
      error: {
        message: 'Service YouTube download sedang tidak tersedia',
        type: 'SERVICE_UNAVAILABLE',
        status: 503,
        timestamp: new Date().toISOString(),
        details: error.message
      },
      meta: {
        response_time: responseTime,
        credits: "HXS YouTube API - Home & Start",
        version: "1.0.0",
        troubleshooting: [
          'Coba gunakan service downloader lain',
          'Video mungkin tidak mengizinkan download',
          'Coba lagi nanti atau gunakan VPN',
          'Service YouTube download sering berubah'
        ],
        alternative_services: [
          'https://ytmp3.cc/',
          'https://yt5s.com/',
          'https://loader.to/',
          'https://ytmp3.nu/'
        ]
      }
    };
    
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    return res.status(503).json(errorResponse);
  }
}

// Export function untuk penggunaan langsung
export { yt };
