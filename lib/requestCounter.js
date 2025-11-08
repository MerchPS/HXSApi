// lib/requestCounter.js

const JSONBIN_API_URL = 'https://api.jsonbin.io/v3/b';
const MASTER_KEY = '$2a$10$t9rRybPASWD8ZC//W4fDuOOBbwmwCI0iC9P.X5GXdFOF3dpMVsnoS';
const BIN_ID = '690ef42c43b1c97be9a02ee3'; // ID bins yang sudah ada

// Data structure yang sesuai dengan bins yang sudah ada
const defaultStats = {
  totalAllRequests: 2,
  totalTodayRequests: 2,
  lastResetDate: "Sat Nov 08 2025",
  endpoints: {
    "/api/ssweb": {
      totalRequests: 2,
      todayRequests: 2
    }
  }
};

// Load data dari JSONBin
async function loadStats() {
  try {
    const response = await fetch(`${JSONBIN_API_URL}/${BIN_ID}/latest`, {
      headers: {
        'X-Master-Key': MASTER_KEY
      }
    });

    if (response.ok) {
      const data = await response.json();
      const stats = data.record;

      // Reset daily counter jika sudah hari baru
      const today = new Date().toDateString();
      if (stats.lastResetDate !== today) {
        stats.totalTodayRequests = 0;
        stats.lastResetDate = today;
        
        // Reset semua endpoint daily counters
        Object.keys(stats.endpoints).forEach(endpoint => {
          if (stats.endpoints[endpoint].todayRequests) {
            stats.endpoints[endpoint].todayRequests = 0;
          }
        });
        
        await saveStats(stats);
      }

      return stats;
    } else {
      console.warn('Gagal load stats, menggunakan default');
      return defaultStats;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    return defaultStats;
  }
}

// Save data ke JSONBin
async function saveStats(stats) {
  try {
    const response = await fetch(`${JSONBIN_API_URL}/${BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': MASTER_KEY
      },
      body: JSON.stringify(stats)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log('Stats berhasil disimpan ke JSONBin');
    return true;
  } catch (error) {
    console.error('Error saving stats:', error);
    return false;
  }
}

// Increment counter untuk endpoint tertentu
async function incrementRequest(endpoint) {
  try {
    // Load data terbaru dulu
    const stats = await loadStats();

    // Update counters
    stats.totalAllRequests = (stats.totalAllRequests || 0) + 1;
    stats.totalTodayRequests = (stats.totalTodayRequests || 0) + 1;

    // Update endpoint-specific counters
    if (!stats.endpoints) {
      stats.endpoints = {};
    }
    
    if (!stats.endpoints[endpoint]) {
      stats.endpoints[endpoint] = {
        totalRequests: 0,
        todayRequests: 0
      };
    }

    stats.endpoints[endpoint].totalRequests = (stats.endpoints[endpoint].totalRequests || 0) + 1;
    stats.endpoints[endpoint].todayRequests = (stats.endpoints[endpoint].todayRequests || 0) + 1;

    // Save ke JSONBin
    await saveStats(stats);

    return {
      totalAllRequests: stats.totalAllRequests,
      totalTodayRequests: stats.totalTodayRequests,
      endpointStats: stats.endpoints[endpoint]
    };
  } catch (error) {
    console.error('Error incrementing request:', error);
    return {
      totalAllRequests: 0,
      totalTodayRequests: 0,
      endpointStats: { totalRequests: 0, todayRequests: 0 }
    };
  }
}

// Get current stats
async function getStats() {
  return await loadStats();
}

// Reset daily counters (bisa dipanggil setiap hari)
async function resetDailyCounters() {
  const stats = await loadStats();
  
  const today = new Date().toDateString();
  stats.totalTodayRequests = 0;
  stats.lastResetDate = today;

  // Reset semua endpoint daily counters
  if (stats.endpoints) {
    Object.keys(stats.endpoints).forEach(endpoint => {
      if (stats.endpoints[endpoint].todayRequests) {
        stats.endpoints[endpoint].todayRequests = 0;
      }
    });
  }

  await saveStats(stats);
  return stats;
}

module.exports = {
  incrementRequest,
  getStats,
  resetDailyCounters
};
