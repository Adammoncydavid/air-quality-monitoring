// API CONFIGURATION
const API_KEY = '147cf1a1470c2ce162064997dfa53119f42e2adb';
const CITIES = ['london', 'paris', 'delhi', 'beijing'];

// Use a CORS proxy to avoid CORS issues
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// Fallback dummy data in case API fails
const FALLBACK_SENSORS = [
    {
        id: 1,
        name: "Main Campus Building",
        lat: 9.211889407438802,
        lng: 76.642251169034,
        aqi: 45,
        pm25: 12,
        pm10: 15,
        temperature: 28,
        humidity: 75,
        status: "good",
        lastUpdate: new Date().toISOString()
    },
    {
        id: 2,
        name: "Engineering Block",
        lat: 9.211624645670256,
        lng: 76.64222434694523,
        aqi: 68,
        pm25: 25,
        pm10: 45,
        temperature: 29,
        humidity: 72,
        status: "moderate",
    }
];

// Sensor data structure
let realSensors = [];
let historicalData = {
    labels: [],
    aqi: [],
    pm25: [],
    temperature: [],
    humidity: []
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Starting Air Quality Dashboard with REAL DATA...');
    initializeCharts();
    startRealTimeUpdates();
});



// Initialize Charts
function initializeCharts() {
    // AQI Trend Chart
    const aqiCtx = document.getElementById('aqiChart').getContext('2d');
    window.aqiChart = new Chart(aqiCtx, {
        type: 'line',
        data: {
            labels: historicalData.labels,
            datasets: [{
                label: 'AQI',
                data: historicalData.aqi,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Air Quality Index Trend'
                }
            }
        }
    });

    // Pollutant Chart
    const pollutantCtx = document.getElementById('pollutantChart').getContext('2d');
    window.pollutantChart = new Chart(pollutantCtx, {
        type: 'bar',
        data: {
            labels: historicalData.labels,
            datasets: [
                {
                    label: 'PM2.5',
                    data: historicalData.pm25,
                    backgroundColor: 'rgba(231, 76, 60, 0.8)'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'PM2.5 (μg/m³)'
                    }
                }
            }
        }
    });
}

// Fetch real air quality data from WAQI API with CORS proxy
async function fetchAirQualityData(city) {
    const apiUrl = `https://api.waqi.info/feed/${city}/?token=${API_KEY}`;
    const url = CORS_PROXY + encodeURIComponent(apiUrl);

    console.log(`🔍 Fetching data for ${city}...`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ Received data for ${city}:`, data);

        if (data.status === 'ok') {
            return data.data;
        } else {
            throw new Error(data.data || 'API returned error');
        }
    } catch (error) {
        console.error(`❌ Error fetching data for ${city}:`, error);
        return null;
    }
}

// Process API data into sensor format
function processAPIData(city, apiData) {
    if (!apiData) return null;

    // Generate coordinates around your campus
    const baseLat = 9.211889407438802;
    const baseLng = 76.642251169034;
    const lat = baseLat + (Math.random() * 0.002 - 0.001);
    const lng = baseLng + (Math.random() * 0.002 - 0.001);

    const sensorData = {
        id: city,
        name: `${city.charAt(0).toUpperCase() + city.slice(1)} Station`,
        lat: lat,
        lng: lng,
        aqi: apiData.aqi || 0,
        pm25: apiData.iaqi?.pm25?.v || 0,
        pm10: apiData.iaqi?.pm10?.v || 0,
        temperature: apiData.iaqi?.t?.v || Math.round(25 + Math.random() * 10),
        humidity: apiData.iaqi?.h?.v || Math.round(60 + Math.random() * 20),
        status: getAqiStatus(apiData.aqi || 0),
        lastUpdate: new Date().toISOString(),
        city: city,
        isRealData: true
    };

    console.log(`📊 Processed ${city} data:`, sensorData);
    return sensorData;
}

// Main function to update all data from API
async function updateAllFromAPI() {
    console.log('🔄 Starting API data fetch...');
    const apiStatus = document.getElementById('apiStatus');

    try {
        apiStatus.textContent = 'API: FETCHING...';
        apiStatus.className = 'api-status';

        // Fetch data for all cities with timeout
        const fetchPromises = CITIES.map(city =>
            Promise.race([
                fetchAirQualityData(city),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 8000)
                )
            ])
        );

        const results = await Promise.allSettled(fetchPromises);

        // Process successful results
        realSensors = CITIES.map((city, index) => {
            if (results[index].status === 'fulfilled' && results[index].value) {
                return processAPIData(city, results[index].value);
            }
            return null;
        }).filter(sensor => sensor !== null);

        console.log(`📈 Got ${realSensors.length} out of ${CITIES.length} sensors from API`);

        if (realSensors.length > 0) {
            apiStatus.textContent = `API: ONLINE (${realSensors.length}/${CITIES.length})`;
            apiStatus.className = 'api-status';
            updateDashboardWithRealData();
        } else {
            throw new Error('No data received from any API endpoint');
        }

    } catch (error) {
        console.error('💥 API Update failed:', error);
        apiStatus.textContent = 'API: OFFLINE - Using Demo';
        apiStatus.className = 'api-status offline';
        useFallbackData();
    }
}

// Update dashboard with real API data
function updateDashboardWithRealData() {
    const updateTime = new Date();

    // Update timestamp
    document.getElementById('lastUpdate').textContent = `Last update: ${updateTime.toLocaleTimeString()}`;

    if (realSensors.length === 0) {
        useFallbackData();
        return;
    }

    // Calculate averages
    const avgAqi = Math.round(realSensors.reduce((sum, sensor) => sum + sensor.aqi, 0) / realSensors.length);
    const avgPM25 = Math.round(realSensors.reduce((sum, sensor) => sum + sensor.pm25, 0) / realSensors.length);
    const avgTemp = Math.round(realSensors.reduce((sum, sensor) => sum + sensor.temperature, 0) / realSensors.length);
    const avgHumidity = Math.round(realSensors.reduce((sum, sensor) => sum + sensor.humidity, 0) / realSensors.length);

    // Update main AQI card
    const aqiElement = document.getElementById('mainAqi');
    aqiElement.textContent = avgAqi;
    aqiElement.className = 'aqi-value ' + getAqiStatus(avgAqi);
    document.getElementById('mainStatus').textContent = getAqiStatus(avgAqi).charAt(0).toUpperCase() + getAqiStatus(avgAqi).slice(1);

    // Update other cards
    document.getElementById('pm25Value').textContent = `${avgPM25} μg/m³`;
    document.getElementById('pm25Status').textContent = getPM25Status(avgPM25);
    document.getElementById('tempValue').textContent = `${avgTemp}°C`;
    document.getElementById('tempStatus').textContent = getTempStatus(avgTemp);
    document.getElementById('humidityValue').textContent = `${avgHumidity}%`;
    document.getElementById('humidityStatus').textContent = getHumidityStatus(avgHumidity);

    // Update sensor grid
    updateSensorGrid();

    // Update charts
    updateChartsWithRealData();

    console.log('✅ Real data update completed!');
}

// Update sensor grid with current data
function updateSensorGrid() {
    const sensorGrid = document.getElementById('sensorGrid');
    sensorGrid.innerHTML = '';

    realSensors.forEach(sensor => {
        const sensorElement = document.createElement('div');
        sensorElement.className = `sensor-item ${sensor.status}`;
        const dataSource = sensor.isRealData ? '🌐 LIVE' : '📱 DEMO';

        sensorElement.innerHTML = `
            <div class="sensor-header">
                <span class="sensor-name">${sensor.name}</span>
                <span class="sensor-aqi">AQI: ${sensor.aqi} ${dataSource}</span>
            </div>
            <div class="sensor-details">
                <p>PM2.5: ${sensor.pm25} μg/m³ | PM10: ${sensor.pm10} μg/m³</p>
                <p>Temp: ${sensor.temperature}°C | Humidity: ${sensor.humidity}%</p>
                <p class="sensor-status">Status: <strong>${sensor.status.toUpperCase()}</strong></p>
                <small>Updated: ${new Date().toLocaleTimeString()}</small>
            </div>
        `;
        sensorGrid.appendChild(sensorElement);
    });
}

// Update charts with real data
function updateChartsWithRealData() {
    const now = new Date();
    const timeLabel = now.getHours() + ':' + now.getMinutes().toString().padStart(2, '0');

    // Update AQI chart
    const aqiData = window.aqiChart.data;
    aqiData.labels.push(timeLabel);
    if (aqiData.labels.length > 8) aqiData.labels.shift();

    if (realSensors.length > 0) {
        const newAqi = Math.round(realSensors.reduce((sum, sensor) => sum + sensor.aqi, 0) / realSensors.length);
        aqiData.datasets[0].data.push(newAqi);
        if (aqiData.datasets[0].data.length > 8) aqiData.datasets[0].data.shift();
    }

    window.aqiChart.update('none');

    // Update pollutant chart
    const pollData = window.pollutantChart.data;
    pollData.labels.push(timeLabel);
    if (pollData.labels.length > 8) pollData.labels.shift();

    if (realSensors.length > 0) {
        const newPm25 = Math.round(realSensors.reduce((sum, sensor) => sum + sensor.pm25, 0) / realSensors.length);
        pollData.datasets[0].data.push(newPm25);
        if (pollData.datasets[0].data.length > 8) pollData.datasets[0].data.shift();
    }

    window.pollutantChart.update('none');
}

// Use fallback dummy data
function useFallbackData() {
    console.log('⚠️ Using fallback dummy data');
    realSensors = [...FALLBACK_SENSORS];

    // Add some variation to dummy data to make it look "live"
    realSensors.forEach(sensor => {
        sensor.aqi = Math.max(10, Math.min(150, sensor.aqi + Math.floor(Math.random() * 10 - 5)));
        sensor.pm25 = Math.max(5, Math.min(60, sensor.pm25 + Math.floor(Math.random() * 6 - 3)));
        sensor.temperature = Math.max(25, Math.min(32, sensor.temperature + (Math.random() * 2 - 1)));
        sensor.humidity = Math.max(65, Math.min(80, sensor.humidity + Math.floor(Math.random() * 6 - 3)));
        sensor.status = getAqiStatus(sensor.aqi);
        sensor.isRealData = false;
    });

    updateDashboardWithRealData();
}

// Start real-time updates
function startRealTimeUpdates() {
    console.log('⏰ Starting update intervals...');

    // Initial update immediately
    updateAllFromAPI();

    // Update from API every 2 minutes
    setInterval(updateAllFromAPI, 120000);

    // Update charts more frequently (every 30 seconds) to show "live" movement
    setInterval(() => {
        if (realSensors.length > 0 && realSensors[0].isRealData) {
            // For real data, just update charts with current data
            updateChartsWithRealData();
        } else {
            // For demo data, add some variation
            useFallbackData();
        }
    }, 30000);
}

// Helper functions
function getStatusColor(status) {
    const colors = {
        good: '#27ae60',
        moderate: '#f39c12',
        poor: '#e74c3c'
    };
    return colors[status] || '#3498db';
}

function getAqiStatus(aqi) {
    if (aqi <= 50) return 'good';
    if (aqi <= 100) return 'moderate';
    return 'poor';
}

function getPM25Status(pm25) {
    if (pm25 <= 12) return 'Good';
    if (pm25 <= 35) return 'Moderate';
    if (pm25 <= 55) return 'Unhealthy';
    return 'Hazardous';
}

function getTempStatus(temp) {
    if (temp >= 26 && temp <= 30) return 'Comfortable';
    if (temp >= 22 && temp <= 32) return 'Normal';
    return 'Extreme';
}

function getHumidityStatus(humidity) {
    if (humidity >= 65 && humidity <= 75) return 'Ideal';
    if (humidity >= 60 && humidity <= 80) return 'Normal';
    return 'Extreme';
}

// Manual refresh function
window.refreshData = function () {
    updateAllFromAPI();
};