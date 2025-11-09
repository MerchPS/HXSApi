import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Import dan setup API routes
async function setupAPIRoutes() {
    try {
        // SSWeb API
        const sswebModule = await import('./api/ssweb.js');
        app.use('/api/ssweb', sswebModule.default);
        
        // SSImg API  
        const ssimgModule = await import('./api/ssimg.js');
        app.use('/api/ssimg', ssimgModule.default);
        
        // Status API
        try {
            const statusModule = await import('./api/status.js');
            app.use('/api/status', statusModule.default);
        } catch (e) {
            console.log('Status API not available, creating default...');
            app.get('/api/status', (req, res) => {
                res.json({
                    success: true,
                    message: 'API is running',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
            });
        }
        
        // Health API
        try {
            const healthModule = await import('./api/health.js');
            app.use('/api/health', healthModule.default);
        } catch (e) {
            console.log('Health API not available, creating default...');
            app.get('/api/health', (req, res) => {
                res.json({
                    success: true,
                    status: 'healthy',
                    timestamp: new Date().toISOString()
                });
            });
        }
        
    } catch (error) {
        console.error('Error setting up API routes:', error);
    }
}

// Setup API routes
await setupAPIRoutes();

// HTML Routes
app.get('/', (req, res) => {
    const indexPath = join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>HXS APIs</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
                    .endpoint { background: #f0f8ff; padding: 15px; margin: 15px 0; border-radius: 8px; }
                    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
                    nav { margin: 20px 0; }
                    nav a { margin-right: 15px; text-decoration: none; color: #007acc; }
                </style>
            </head>
            <body>
                <h1>🚀 HXS APIs</h1>
                <p>Welcome to HXS APIs - Screenshot & Utility Services</p>
                
                <nav>
                    <a href="/docs">Documentation</a>
                    <a href="/api">API Reference</a>
                    <a href="/api/health">Health Check</a>
                </nav>
                
                <h2>🔗 Available Endpoints</h2>
                <div class="endpoint">
                    <strong>GET /api/ssweb?url=https://example.com</strong>
                    <p>Screenshot website dengan response JSON</p>
                    <code>https://hxs-apis.vercel.app/api/ssweb?url=https://google.com</code>
                </div>
                
                <div class="endpoint">
                    <strong>GET /api/ssimg?url=https://example.com</strong>
                    <p>Direct image response (untuk bot WA)</p>
                    <code>https://hxs-apis.vercel.app/api/ssimg?url=https://google.com</code>
                </div>
                
                <div class="endpoint">
                    <strong>GET /api/status</strong>
                    <p>Check API status</p>
                </div>
                
                <div class="endpoint">
                    <strong>GET /api/health</strong>
                    <p>Health check endpoint</p>
                </div>
                
                <h2>📖 Usage Examples</h2>
                <h3>For WhatsApp Bot:</h3>
                <pre><code>const apiUrl = 'https://hxs-apis.vercel.app/api/ssweb?url=' + encodeURIComponent(url);
const response = await fetch(apiUrl);
const data = await response.json();
const buffer = Buffer.from(data.data[0].image_base64, 'base64');
await conn.sendMessage(m.chat, { image: buffer }, { quoted: m });</code></pre>
                
                <h3>For Web:</h3>
                <pre><code>&lt;img src="https://hxs-apis.vercel.app/api/ssimg?url=https://google.com" alt="Screenshot"&gt;</code></pre>
            </body>
            </html>
        `);
    }
});

app.get('/docs', (req, res) => {
    const docsPath = join(__dirname, 'docs.html');
    if (fs.existsSync(docsPath)) {
        res.sendFile(docsPath);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>HXS APIs - Documentation</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
                    .section { margin: 30px 0; }
                    .endpoint { background: #f0f0f0; padding: 15px; margin: 10px 0; border-left: 4px solid #007acc; }
                    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
                    pre { background: #2d2d2d; color: #fff; padding: 15px; border-radius: 5px; overflow-x: auto; }
                </style>
            </head>
            <body>
                <h1>📚 HXS APIs Documentation</h1>
                <a href="/">← Back to Home</a>
                
                <div class="section">
                    <h2>🔧 Installation & Setup</h2>
                    <p>HXS APIs provides screenshot functionality via API endpoints.</p>
                </div>
                
                <div class="section">
                    <h2>📸 Screenshot API</h2>
                    
                    <div class="endpoint">
                        <h3>GET /api/ssweb</h3>
                        <p><strong>Description:</strong> Take screenshot of a website and return JSON response</p>
                        <p><strong>Parameters:</strong></p>
                        <ul>
                            <li><code>url</code> (required) - The website URL to screenshot</li>
                            <li><code>format</code> (optional) - Response format: <code>json</code>, <code>base64</code>, <code>image</code></li>
                        </ul>
                        <p><strong>Example:</strong></p>
                        <code>GET https://hxs-apis.vercel.app/api/ssweb?url=https://google.com&format=base64</code>
                    </div>
                    
                    <div class="endpoint">
                        <h3>GET /api/ssimg</h3>
                        <p><strong>Description:</strong> Direct image response (no JSON)</p>
                        <p><strong>Parameters:</strong></p>
                        <ul>
                            <li><code>url</code> (required) - The website URL to screenshot</li>
                        </ul>
                        <p><strong>Example:</strong></p>
                        <code>GET https://hxs-apis.vercel.app/api/ssimg?url=https://google.com</code>
                    </div>
                </div>
                
                <div class="section">
                    <h2>🤖 WhatsApp Bot Integration</h2>
                    <p>Here's how to use the API in your WhatsApp bot:</p>
                    
                    <h3>Method 1: Using Base64 (Recommended)</h3>
                    <pre><code>let handler = async (m, { conn, args }) => {
    try {
        if (!args[0]) return m.reply('Example: .ssweb https://google.com');
        
        const apiUrl = 'https://hxs-apis.vercel.app/api/ssweb?url=' + encodeURIComponent(args[0]) + '&format=base64';
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (!data.status) throw new Error(data.message);
        
        const buffer = Buffer.from(data.base64, 'base64');
        
        await conn.sendMessage(m.chat, { 
            image: buffer,
            caption: '📸 Screenshot of ' + data.domain
        }, { quoted: m });
        
    } catch (e) {
        m.reply('Error: ' + e.message);
    }
}

handler.help = ['ssweb <url>'];
handler.command = ['ssweb', 'screenshot'];
export default handler;</code></pre>

                    <h3>Method 2: Using Direct Image URL</h3>
                    <pre><code>let handler = async (m, { conn, args }) => {
    try {
        if (!args[0]) return m.reply('Example: .ssweb https://google.com');
        
        const imageUrl = 'https://hxs-apis.vercel.app/api/ssimg?url=' + encodeURIComponent(args[0]);
        
        await conn.sendMessage(m.chat, { 
            image: { url: imageUrl },
            caption: '📸 ' + args[0]
        }, { quoted: m });
        
    } catch (e) {
        m.reply('Error: ' + e.message);
    }
}</code></pre>
                </div>
                
                <div class="section">
                    <h2>🌐 Web Integration</h2>
                    <p>For web applications, you can use the API like this:</p>
                    
                    <h3>HTML Image Tag</h3>
                    <pre><code>&lt;img src="https://hxs-apis.vercel.app/api/ssimg?url=https://google.com" 
     alt="Google Screenshot" 
     width="600"&gt;</code></pre>
                    
                    <h3>JavaScript Fetch</h3>
                    <pre><code>async function takeScreenshot(url) {
    try {
        const response = await fetch('https://hxs-apis.vercel.app/api/ssweb?url=' + encodeURIComponent(url));
        const data = await response.json();
        
        if (data.status) {
            const img = document.createElement('img');
            img.src = 'data:image/jpeg;base64,' + data.data[0].image_base64;
            document.body.appendChild(img);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}</code></pre>
                </div>
                
                <div class="section">
                    <h2>📊 Response Formats</h2>
                    
                    <h3>JSON Response (/api/ssweb)</h3>
                    <pre><code>{
  "status": true,
  "data": [
    {
      "title": "Screenshot of google.com",
      "image": "data:image/jpeg;base64,...",
      "image_base64": "...",
      "domain": "google.com",
      "url": "https://google.com",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "format": "jpeg",
      "size": 15423,
      "dimensions": "1280x720"
    }
  ],
  "meta": {
    "response_time": 2450,
    "credits": "HXS API - Home & Start",
    "version": "1.0.0"
  }
}</code></pre>
                    
                    <h3>Base64 Response (/api/ssweb?format=base64)</h3>
                    <pre><code>{
  "status": true,
  "base64": "...",
  "domain": "google.com",
  "url": "https://google.com",
  "size": 15423,
  "response_time": 2450
}</code></pre>
                </div>
            </body>
            </html>
        `);
    }
});

app.get('/api', (req, res) => {
    const apiPath = join(__dirname, 'api.html');
    if (fs.existsSync(apiPath)) {
        res.sendFile(apiPath);
    } else {
        res.redirect('/docs');
    }
});

// Handle 404 untuk API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        available_endpoints: [
            '/api/ssweb?url=URL - Screenshot with JSON response',
            '/api/ssimg?url=URL - Direct image response', 
            '/api/status - API status',
            '/api/health - Health check'
        ]
    });
});

// Handle 404 untuk HTML routes
app.use('*', (req, res) => {
    const notFoundPath = join(__dirname, '404.html');
    if (fs.existsSync(notFoundPath)) {
        res.status(404).sendFile(notFoundPath);
    } else {
        res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>404 - Page Not Found</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
                    h1 { color: #d32f2f; }
                    a { color: #007acc; text-decoration: none; }
                </style>
            </head>
            <body>
                <h1>404 - Page Not Found</h1>
                <p>The page you are looking for does not exist.</p>
                <a href="/">← Go back to Home</a>
            </body>
            </html>
        `);
    }
});

// Export app untuk Vercel (TIDAK PERLU app.listen())
export default app;
