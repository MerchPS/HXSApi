import axios from 'axios';

const yt = {
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
  
  // Get download info from yt5s
  async getDownloadInfo(url) {
    try {
      const videoId = this.extractVideoId(url);
      if (!videoId) {
        throw new Error('Tidak dapat mengekstrak Video ID dari URL');
      }
      
      this.log(`Getting download info for: ${videoId}`);
      
      // Step 1: Get download page
      const pageResponse = await axios.get(`https://yt5s.io/en`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      // Step 2: Get download links
      const apiResponse = await axios.post(`https://yt5s.io/en/api/convert`, {
        v: videoId,
        f: 'mp3'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://yt5s.io',
          'Referer': 'https://yt5s.io/en'
        }
      });
      
      if (apiResponse.data && apiResponse.data.durl) {
        return {
          downloadUrl: apiResponse.data.durl,
          filename: apiResponse.data.title ? `${apiResponse.data.title}.mp3` : `youtube_${videoId}.mp3`,
          filesize: apiResponse.data.size || 0,
          duration: apiResponse.data.duration || 0,
          videoId: videoId
        };
      }
      
      throw new Error('Tidak dapat mendapatkan link download');
      
    } catch (error) {
      this.log(`Error: ${error.message}`);
      throw error;
    }
  },
  
  // Download file buffer
  async downloadFile(downloadUrl) {
    try {
      this.log(`Downloading file from: ${downloadUrl}`);
      
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://yt5s.io/'
        },
        timeout: 60000,
        maxContentLength: 50 * 1024 * 1024, // 50MB max
      });
      
      if (response.status !== 200) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      return Buffer.from(response.data);
    } catch (error) {
      this.log(`Download error: ${error.message}`);
      throw error;
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
    const { url } = req.query;
    
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
    
    // Clean URL
    const cleanUrl = url.split('?')[0];
    yt.log(`Processing: ${cleanUrl}`);
    
    // Validate URL
    const videoId = yt.extractVideoId(cleanUrl);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'URL YouTube tidak valid',
          type: 'VALIDATION_ERROR',
          status: 400
        }
      });
    }
    
    // Get download info
    const downloadInfo = await yt.getDownloadInfo(cleanUrl);
    
    // Download the file
    const fileBuffer = await yt.downloadFile(downloadInfo.downloadUrl);
    
    const responseTime = Date.now() - startTime;
    
    // Set headers for file download
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadInfo.filename}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    res.setHeader('X-File-Size', fileBuffer.length);
    res.setHeader('X-Video-ID', videoId);
    res.setHeader('X-Duration', downloadInfo.duration);
    
    yt.log(`Download successful: ${fileBuffer.length} bytes`);
    
    // Send file buffer directly
    return res.send(fileBuffer);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('YouTube MP3 Error:', error.message);
    
    let errorMessage = 'Gagal mendownload audio';
    let statusCode = 500;
    
    if (error.message.includes('URL YouTube tidak valid')) {
      errorMessage = 'URL YouTube tidak valid';
      statusCode = 400;
    } else if (error.message.includes('Tidak dapat mendapatkan link download')) {
      errorMessage = 'Video tidak dapat didownload';
      statusCode = 404;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Timeout: Download terlalu lama';
      statusCode = 408;
    }
    
    const errorResponse = {
      success: false,
      error: {
        message: errorMessage,
        type: 'DOWNLOAD_ERROR',
        status: statusCode,
        timestamp: new Date().toISOString(),
        details: error.message
      },
      meta: {
        response_time: responseTime,
        credits: "HXS YouTube API - Home & Start",
        version: "1.0.0",
        troubleshooting: [
          'Pastikan URL YouTube valid',
          'Video mungkin tidak tersedia',
          'Coba video lain',
          'Coba lagi nanti'
        ]
      }
    };
    
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    return res.status(statusCode).json(errorResponse);
  }
}

export { yt };
