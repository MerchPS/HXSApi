import fetch from 'node-fetch';

const TELEGRAM_BOT_TOKEN = '8464443282:AAG_NljyNT5qWW3VTi_5O3Jl-_2T5lW9YQk';
const TELEGRAM_CHAT_ID = '-1003258590405'; // Ganti dengan chat ID grup Anda

export async function sendToTelegram(message) {
    try {
        // Format message untuk Telegram
        const formattedMessage = `🚨 HXS API Log\n${message}`;
        
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: formattedMessage,
                parse_mode: 'HTML'
            })
        });

        const result = await response.json();
        
        if (!result.ok) {
            console.error('Telegram API Error:', result);
        }
        
        return result;
    } catch (error) {
        console.error('Failed to send to Telegram:', error);
    }
}

export function formatLogMessage(logData) {
    const { ip, method, endpoint, status, userAgent, timestamp, error, url } = logData;
    
    const time = new Date(timestamp).toLocaleString('id-ID');
    let message = `
🕐 <b>Time:</b> ${time}
🌐 <b>IP:</b> <code>${ip}</code>
⚡ <b>Method:</b> ${method}
🔗 <b>Endpoint:</b> ${endpoint}
📊 <b>Status:</b> ${status}
    `;
    
    if (url) {
        message += `\n🔍 <b>URL:</b> ${url}`;
    }
    
    if (userAgent) {
        const shortUA = userAgent.length > 50 ? userAgent.substring(0, 50) + '...' : userAgent;
        message += `\n📱 <b>User Agent:</b> ${shortUA}`;
    }
    
    if (error) {
        message += `\n❌ <b>Error:</b> ${error}`;
    }
    
    return message;
}
