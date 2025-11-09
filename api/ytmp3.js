import axios from 'axios';

const yt = {
  static: Object.freeze({
    baseUrl: 'https://api.ytdl.workers.dev',
    headers: {
      'accept': '*/*',
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
  
  // Get audio buffer directly
  async getAudioBuffer(url, format = 'mp3') {
    try {
      const videoId = this.extractVideoId(url);
      if (!videoId) {
        throw new Error('Tidak dapat mengekstrak Video ID dari URL');
      }
      
      this.log(`Downloading audio for video ID: ${videoId}`);
      
      // Use ytdl worker API that returns file directly
      const downloadUrl = `https://api.ytdl.workers.dev/api/info?url=https://www.youtube.com/watch?v=${videoId}`;
      
      const response = await axios.get(downloadUrl, {
        headers: this.static.headers,
        responseType: 'arraybuffer', // Important for binary data
        timeout: 60000 // 60 seconds timeout
      });
      
      if (response.status !== 200) {
        throw new Error(`Download failed with status: ${response.status}`);
      }
      
      // Convert to buffer
      const buffer = Buffer.from(response.data);
      
      if (buffer.length === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      return {
        buffer: buffer,
        filename: `youtube_${videoId}.${format}`,
        filesize: buffer.length,
        duration: 0,
        format: format,
        videoId: videoId
      };
      
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
        }
      });
    }
    
    const audioInfo = await yt.getAudioBuffer(cleanUrl, 'mp3');
    const responseTime = Date.now() - startTime;
    
    // Set headers for file download
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${audioInfo.filename}"`);
    res.setHeader('Content-Length', audioInfo.buffer.length);
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    res.setHeader('X-File-Size', audioInfo.filesize);
    res.setHeader('X-Video-ID', audioInfo.videoId);
    
    // Send the file buffer directly
    return res.send(audioInfo.buffer);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('YouTube MP3 Download Error:', error.message);
    
    const errorResponse = {
      success: false,
      error: {
        message: 'Gagal mendownload audio',
        type: 'DOWNLOAD_ERROR',
        status: 500,
        timestamp: new Date().toISOString(),
        details: error.message
      },
      meta: {
        response_time: responseTime,
        credits: "HXS YouTube API - Home & Start",
        version: "1.0.0"
      }
    };
    
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    return res.status(500).json(errorResponse);
  }
}

// Export function untuk penggunaan langsung
export { yt };
