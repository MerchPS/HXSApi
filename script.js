// Configuration
const API_BASE_URL = 'https://hxs-apis.vercel.app'; // Ganti dengan URL API Anda

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Update toggle button
    updateThemeToggle(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeToggle(newTheme);
}

function updateThemeToggle(theme) {
    const toggle = document.getElementById('themeToggle');
    if (theme === 'dark') {
        toggle.querySelector('.fa-moon').style.opacity = '0';
        toggle.querySelector('.fa-sun').style.opacity = '1';
    } else {
        toggle.querySelector('.fa-moon').style.opacity = '1';
        toggle.querySelector('.fa-sun').style.opacity = '0';
    }
}

// Mobile Menu
function initMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const nav = document.getElementById('nav');
    
    mobileMenu.addEventListener('click', () => {
        nav.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('active');
        });
    });
}

// Real-time Status Monitoring
async function fetchRealTimeStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/status`);
        const data = await response.json();
        
        if (data.success) {
            updateStatusDisplay(data.data);
        }
    } catch (error) {
        console.error('Failed to fetch status:', error);
        setOfflineStatus();
    }
}

function updateStatusDisplay(statusData) {
    // Update SSWeb API status
    if (statusData.ssweb) {
        document.getElementById('ssweb-response').textContent = `${statusData.ssweb.responseTime}ms`;
        document.getElementById('ssweb-uptime').textContent = `${statusData.ssweb.uptime}%`;
        document.getElementById('ssweb-requests').textContent = statusData.ssweb.requestsToday.toLocaleString();
        
        updateStatusCard('ssweb', statusData.ssweb.status);
    }
    
    // Update Auth API status
    if (statusData.auth) {
        document.getElementById('auth-response').textContent = `${statusData.auth.responseTime}ms`;
        document.getElementById('auth-uptime').textContent = `${statusData.auth.uptime}%`;
        document.getElementById('auth-users').textContent = statusData.auth.activeUsers.toLocaleString();
        
        updateStatusCard('auth', statusData.auth.status);
    }
    
    // Update quick stats
    updateQuickStats(statusData);
}

function updateStatusCard(api, status) {
    const card = document.querySelector(`[data-api="${api}"]`) || 
                 document.querySelector(`.status-card:has([id*="${api}"])`);
    
    if (card) {
        const badge = card.querySelector('.status-badge');
        const icon = card.querySelector('.status-icon');
        
        // Remove existing status classes
        badge.className = 'status-badge';
        icon.className = 'status-icon';
        
        // Add new status
        badge.classList.add(status);
        badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        
        icon.classList.add(status);
    }
}

function updateQuickStats(statusData) {
    // Update response time
    const avgResponse = Math.round(
        (statusData.ssweb.responseTime + statusData.auth.responseTime) / 2
    );
    document.getElementById('responseTime').textContent = `${avgResponse}ms`;
    
    // Update uptime (take the lowest uptime)
    const minUptime = Math.min(statusData.ssweb.uptime, statusData.auth.uptime);
    document.getElementById('uptime').textContent = `${minUptime}%`;
    
    // Update requests
    document.getElementById('requestsToday').textContent = 
        statusData.ssweb.requestsToday.toLocaleString();
}

function setOfflineStatus() {
    // Set all status to offline
    document.querySelectorAll('.status-badge').forEach(badge => {
        badge.className = 'status-badge offline';
        badge.textContent = 'Offline';
    });
    
    document.querySelectorAll('.status-icon').forEach(icon => {
        icon.className = 'status-icon offline';
    });
}

// Real API Testing
async function testEndpoint(endpoint) {
    switch(endpoint) {
        case 'ssweb':
            await testSSWebEndpoint();
            break;
        case 'health':
            await testHealthEndpoint();
            break;
        default:
            console.warn('Unknown endpoint:', endpoint);
    }
}

async function testSSWebEndpoint() {
    const url = prompt('Enter website URL to capture:', 'https://google.com');
    if (!url) return;
    
    try {
        Swal.fire({
            title: 'Taking Screenshot...',
            text: 'Please wait while we capture the website',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const response = await fetch(`${API_BASE_URL}/api/ssweb?url=${encodeURIComponent(url)}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const imgUrl = URL.createObjectURL(blob);
            
            Swal.fire({
                title: 'Screenshot Captured!',
                html: `
                    <p>Successfully captured screenshot of:</p>
                    <p><strong>${url}</strong></p>
                    <img src="${imgUrl}" alt="Screenshot" style="max-width: 100%; margin: 15px 0; border-radius: 8px; border: 1px solid #e2e8f0;">
                `,
                imageUrl: imgUrl,
                imageAlt: `Screenshot of ${url}`,
                imageHeight: 300,
                confirmButtonText: 'Close'
            });
        } else {
            const error = await response.json();
            Swal.fire('Error!', error.message || 'Failed to capture screenshot', 'error');
        }
    } catch (error) {
        Swal.fire('Error!', 'Failed to capture screenshot: ' + error.message, 'error');
    }
}

async function testHealthEndpoint() {
    try {
        Swal.fire({
            title: 'Checking API Health...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const startTime = Date.now();
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
            const data = await response.json();
            
            Swal.fire({
                title: 'API Health Status',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Status:</strong> <span style="color: #10b981;">✓ Healthy</span></p>
                        <p><strong>Response Time:</strong> ${responseTime}ms</p>
                        <p><strong>Message:</strong> ${data.message}</p>
                        <p><strong>Version:</strong> ${data.version}</p>
                        <p><strong>Timestamp:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
                    </div>
                `,
                icon: 'success'
            });
        } else {
            Swal.fire('Error!', 'API health check failed', 'error');
        }
    } catch (error) {
        Swal.fire('Error!', 'Failed to check API health: ' + error.message, 'error');
    }
}

// Developer Console Functions
function openDeveloperConsole() {
    document.getElementById('developerConsole').style.display = 'block';
    document.getElementById('logsSection').style.display = 'none';
    document.getElementById('devPassword').value = '';
}

function closeDeveloperConsole() {
    document.getElementById('developerConsole').style.display = 'none';
}

async function accessRealLogs() {
    const password = document.getElementById('devPassword').value;
    
    if (!password) {
        Swal.fire('Error!', 'Please enter password', 'error');
        return;
    }
    
    try {
        Swal.fire({
            title: 'Accessing Logs...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const response = await fetch(`${API_BASE_URL}/api/developer/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                password: password,
                limit: 100
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            Swal.close();
            document.getElementById('logsSection').style.display = 'block';
            displayLogs(data.logs);
            
            Swal.fire('Success!', `Loaded ${data.logs.length} log entries`, 'success');
        } else {
            const error = await response.json();
            Swal.fire('Error!', error.message || 'Failed to access logs', 'error');
        }
    } catch (error) {
        Swal.fire('Error!', 'Failed to access logs: ' + error.message, 'error');
    }
}

function displayLogs(logs) {
    const container = document.getElementById('logsContainer');
    
    if (!logs || logs.length === 0) {
        container.innerHTML = '<div class="no-logs">No logs available</div>';
        return;
    }
    
    const logsHTML = logs.map(log => `
        <div class="log-entry">
            <div class="log-header">
                <span class="log-time">${new Date(log.timestamp).toLocaleString()}</span>
                <span class="log-ip">${log.ip}</span>
                <span class="log-method ${log.method.toLowerCase()}">${log.method}</span>
                <span class="log-status status-${log.status}">${log.status}</span>
            </div>
            <div class="log-details">
                <span class="log-endpoint">${log.endpoint}</span>
                ${log.url ? `<span class="log-url">${log.url}</span>` : ''}
                ${log.userAgent ? `<span class="log-ua">${log.userAgent}</span>` : ''}
                ${log.error ? `<span class="log-error">Error: ${log.error}</span>` : ''}
                ${log.responseTime ? `<span class="log-response">${log.responseTime}ms</span>` : ''}
            </div>
        </div>
    `).join('');
    
    container.innerHTML = logsHTML;
}

async function refreshLogs() {
    const password = document.getElementById('devPassword').value;
    
    if (!password) {
        Swal.fire('Error!', 'Please enter password first', 'error');
        return;
    }
    
    await accessRealLogs();
}

async function clearLogs() {
    const password = document.getElementById('devPassword').value;
    
    if (!password) {
        Swal.fire('Error!', 'Please enter password first', 'error');
        return;
    }
    
    try {
        const result = await Swal.fire({
            title: 'Clear Logs?',
            text: 'This will permanently delete all log entries',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, clear all!',
            cancelButtonText: 'Cancel'
        });
        
        if (result.isConfirmed) {
            const response = await fetch(`${API_BASE_URL}/api/developer/logs`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    password: password
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                document.getElementById('logsContainer').innerHTML = '<div class="no-logs">No logs available</div>';
                Swal.fire('Success!', data.message, 'success');
            } else {
                Swal.fire('Error!', 'Failed to clear logs', 'error');
            }
        }
    } catch (error) {
        Swal.fire('Error!', 'Failed to clear logs: ' + error.message, 'error');
    }
}

// Copy Code Function
function copyCode(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent || element.innerText;
    
    navigator.clipboard.writeText(text).then(() => {
        // Show success feedback
        const button = element.parentElement.querySelector('.copy-btn');
        const originalIcon = button.innerHTML;
        
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.style.background = 'var(--success)';
        button.style.color = 'white';
        
        setTimeout(() => {
            button.innerHTML = originalIcon;
            button.style.background = '';
            button.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

// Smooth Scrolling
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Auto-refresh status
function startAutoRefresh() {
    // Initial load
    fetchRealTimeStatus();
    
    // Refresh every 30 seconds
    setInterval(fetchRealTimeStatus, 30000);
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    initMobileMenu();
    initSmoothScroll();
    startAutoRefresh();
    
    // Add event listeners
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
});

// Export functions for global access
window.toggleTheme = toggleTheme;
window.testEndpoint = testEndpoint;
window.openDeveloperConsole = openDeveloperConsole;
window.closeDeveloperConsole = closeDeveloperConsole;
window.accessRealLogs = accessRealLogs;
window.refreshLogs = refreshLogs;
window.clearLogs = clearLogs;
window.copyCode = copyCode;
