// lib/requestCounter.js

const JSONBIN_API_URL = 'https://api.jsonbin.io/v3/b';
const MASTER_KEY = '$2a$10$t9rRybPASWD8ZC//W4fDuOOBbwmwCI0iC9P.X5GXdFOF3dpMVsnoS';
const ACCESS_KEY = '$2a$10$5h7N1GoDlqh7oGuPAF7a1e8YFIOeMaU8I2phwCAVziyKRVIKqCQOK';

// ID bin yang akan dibuat (jika belum ada)
let BIN_ID = null;

const requestStats = {
  totalAllRequests: 0,
  totalTodayRequests: 0,
  lastResetDate: new Date().toDateString(),
  endpoints: {}
};

// Inisialisasi JSONBin
async function initJSONBin() {
  try {
    // Coba buat bin baru jika belum ada
    const response = await fetch(JSONBIN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': MASTER_KEY,
        'X-Access-Key': ACCESS_KEY,
        'X-Bin-Name': 'HXS-API-Request-Stats'
      },
      body: JSON.stringify(requestStats)
    });

    if (response.ok) {
      const data = await response.json();
      BIN_ID = data.metadata.id;
      console.log('JSONBin initialized with ID:', BIN_ID);
    }
  } catch (error) {
    console.error('Error initializing JSONBin:', error);
  }
}

// Load data dari JSONBin
async function loadStats() {
  if (!BIN_ID) {
    await initJSONBin();
    return;
  }

  try {
    const response = await fetch(`${JSONBIN_API_URL}/${BIN_ID}/latest`, {
      headers: {
        'X-Master-Key': MASTER_KEY,
        'X-Access-Key': ACCESS_KEY
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
        await saveStats(stats);
      }

      Object.assign(requestStats, stats);
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Save data ke JSONBin
async function saveStats(stats = requestStats) {
  if (!BIN_ID) {
    await initJSONBin();
    return;
  }

  try {
    const response = await fetch(`${JSONBIN_API_URL}/${BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': MASTER_KEY,
        'X-Access-Key': ACCESS_KEY
      },
      body: JSON.stringify(stats)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error saving stats:', error);
  }
}

// Increment counter untuk endpoint tertentu
async function incrementRequest(endpoint) {
  // Load data terbaru dulu
  await loadStats();

  // Update counters
  requestStats.totalAllRequests++;
  requestStats.totalTodayRequests++;

  // Update endpoint-specific counters
  if (!requestStats.endpoints[endpoint]) {
    requestStats.endpoints[endpoint] = {
      totalRequests: 0,
      todayRequests: 0
    };
  }

  requestStats.endpoints[endpoint].totalRequests++;
  requestStats.endpoints[endpoint].todayRequests++;

  // Save ke JSONBin
  await saveStats();

  return {
    totalAllRequests: requestStats.totalAllRequests,
    totalTodayRequests: requestStats.totalTodayRequests,
    endpointStats: requestStats.endpoints[endpoint]
  };
}

// Get current stats
async function getStats() {
  await loadStats();
  return { ...requestStats };
}

// Reset daily counters (bisa dipanggil setiap hari)
async function resetDailyCounters() {
  await loadStats();
  
  const today = new Date().toDateString();
  requestStats.totalTodayRequests = 0;
  requestStats.lastResetDate = today;

  // Reset semua endpoint daily counters
  Object.keys(requestStats.endpoints).forEach(endpoint => {
    requestStats.endpoints[endpoint].todayRequests = 0;
  });

  await saveStats();
}

module.exports = {
  incrementRequest,
  getStats,
  resetDailyCounters,
  initJSONBin
};
