import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

async function aichat(question, { model = 'gpt-5-nano' } = {}) {
    try {
        const _model = {
            'gpt-4o-mini': '25865',
            'gpt-5-nano': '25871',
            'gemini': '25874',
            'deepseek': '25873',
            'claude': '25875',
            'grok': '25872',
            'meta-ai': '25870',
            'qwen': '25869'
        };
        
        const modelNames = {
            'gpt-4o-mini': 'GPT-4o Mini',
            'gpt-5-nano': 'GPT-5 Nano',
            'gemini': 'Google Gemini',
            'deepseek': 'DeepSeek',
            'claude': 'Claude AI',
            'grok': 'Grok AI',
            'meta-ai': 'Meta AI',
            'qwen': 'Qwen AI'
        };
        
        if (!question) throw new Error('Question is required.');
        if (!_model[model]) throw new Error(`Available models: ${Object.keys(_model).join(', ')}.`);
        
        const { data: html } = await axios.post(`https://api.nekolabs.web.id/px?url=${encodeURIComponent('https://chatgptfree.ai/')}&version=v2`);
        const nonce = html.result.content.match(/&quot;nonce&quot;\s*:\s*&quot;([^&]+)&quot;/);
        if (!nonce) throw new Error('Nonce not found.');
        
        const { data } = await axios.post(`https://api.nekolabs.web.id/px?url=${encodeURIComponent('https://chatgptfree.ai/wp-admin/admin-ajax.php')}&version=v2`, new URLSearchParams({
            action: 'aipkit_frontend_chat_message',
            _ajax_nonce: nonce[1],
            bot_id: _model[model],
            session_id: uuidv4(),
            conversation_uuid: uuidv4(),
            post_id: '6',
            message: question
        }).toString(), {
            headers: {
                origin: 'https://chatgptfree.ai',
                referer: 'https://chatfreen.ai/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            }
        });
        
        const reply = data.result.content.data.reply;
        
        // Format response yang bagus untuk bot WA
        const responseData = {
            success: true,
            data: {
                reply: reply,
                question: question,
                model: model,
                model_name: modelNames[model],
                timestamp: new Date().toISOString(),
                response_length: reply.length,
                usage: {
                    characters: reply.length,
                    words: reply.split(/\s+/).length
                }
            },
            meta: {
                credits: "HXS AI API - Home & Start",
                version: "1.0.0",
                note: "Gunakan field 'reply' untuk mendapatkan jawaban AI"
            }
        };
        
        return responseData;
        
    } catch (error) {
        // Error response yang konsisten
        const errorResponse = {
            success: false,
            error: {
                message: error.message,
                type: error.response?.status ? 'API_ERROR' : 'NETWORK_ERROR',
                status: error.response?.status || 500,
                timestamp: new Date().toISOString()
            },
            meta: {
                credits: "HXS AI API - Home & Start",
                version: "1.0.0",
                available_models: ['gpt-4o-mini', 'gpt-5-nano', 'gemini', 'deepseek', 'claude', 'grok', 'meta-ai', 'qwen']
            }
        };
        
        throw errorResponse;
    }
};

// Handler untuk Vercel API route
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
        let { question, model = 'gpt-5-nano' } = req.method === 'GET' ? req.query : req.body;
        
        if (!question) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Parameter question diperlukan',
                    type: 'VALIDATION_ERROR',
                    status: 400,
                    details: 'Gunakan parameter: question=Your question here&model=model_name'
                },
                meta: {
                    available_models: ['gpt-4o-mini', 'gpt-5-nano', 'gemini', 'deepseek', 'claude', 'grok', 'meta-ai', 'qwen'],
                    example: '/api/ai?question=Hai apa kabar?&model=claude'
                }
            });
        }
        
        // Truncate very long questions
        if (question.length > 1000) {
            question = question.substring(0, 1000) + '...';
        }
        
        const result = await aichat(question, { model });
        const responseTime = Date.now() - startTime;
        
        // Add response time to result
        result.meta.response_time = responseTime;
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        return res.json(result);
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        console.error('AI Chat Error:', error);
        
        // Jika error sudah dalam format response yang konsisten
        if (error.success === false) {
            error.meta.response_time = responseTime;
            res.setHeader('X-Response-Time', `${responseTime}ms`);
            return res.status(error.error.status || 500).json(error);
        }
        
        // Fallback error response
        const errorResponse = {
            success: false,
            error: {
                message: error.message || 'Internal server error',
                type: 'UNKNOWN_ERROR',
                status: 500,
                timestamp: new Date().toISOString()
            },
            meta: {
                response_time: responseTime,
                credits: "HXS AI API - Home & Start",
                version: "1.0.0"
            }
        };
        
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        return res.status(500).json(errorResponse);
    }
}

// Export function untuk penggunaan langsung
export { aichat };
