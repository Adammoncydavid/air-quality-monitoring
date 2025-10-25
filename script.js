// ===============================
// CONFIGURATION
// ===============================

// API Configuration
const API_KEY = '147cf1a1470c2ce162064997dfa53119f42e2adb';
const CITIES = ['london', 'paris', 'delhi', 'beijing'];
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// MQTT Configuration
const MQTT_CONFIG = {
    host: '43f5b67fd4334d4eaa22dcfd749351ff.s1.eu.hivemq.cloud',
    port: 8883,
    username: 'darkness1234',
    password: 'Ferrari1234',
    topic: 'esp32/sensor',
    clientId: 'web-client-' + Math.random().toString(16).substring(2, 8)
};

// ===============================
// GLOBAL VARIABLES
// ===============================

let currentDataSource = 'api'; // 'api', 'mqtt', 'demo'
let realSensors = [];
let mqttSensor = null;
let mqttClient = null;
let map;
let sensorMarkers = [];
let isMQTTConnected = false;
let mqttHistory = {
    temperature: [],
    humidity: [],
    gas: [],
    timestamps: []
};

const historicalData = {
    labels: [],
    aqi: [],
    pm25: [],
    temperature: [],
    humidity: []
};

// Fallback dummy data
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
        lastUpdate: new Date().toISOString()
    }
];

// ===============================
// INITIALIZATION
// ===============================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Starting Hybrid Air Quality Dashboard...');
    initializeMap();
    initializeCharts();
    setupMQTT();
    startRealTimeUpdates();
});

// ===============================
// MAP FUNCTIONS
// ===============================

function initializeMap() {
    const defaultLat = 9.21167230280324;
    const defaultLng = 76.64228335554053;
    const defaultZoom = 17;

    map = L.map('map').setView([defaultLat, defaultLng], defaultZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    updateMapMarkers();
}

function updateMapMarkers() {
    // Clear existing markers
    sensorMarkers.forEach(marker => map.removeLayer(marker));
    sensorMarkers = [];
    
    let sensorsToDisplay = [];
    
    switch(currentDataSource) {
        case 'mqtt':
            if (mqttSensor) sensorsToDisplay = [mqttSensor];
            break;
        case 'api':
            sensorsToDisplay = realSensors;
            break;
        case 'demo':
            sensorsToDisplay = FALLBACK_SENSORS;
            break;
    }
    
    // Add markers for each sensor
    sensorsToDisplay.forEach(sensor => {
        const marker = L.marker([sensor.lat, sensor.lng])
            .addTo(map)
            .bindPopup(`
                <strong>${sensor.name}</strong><br>
                AQI: ${sensor.aqi} (${sensor.status})<br>
                PM2.5: ${sensor.pm25} μg/m³<br>
                ${sensor.temperature ? `Temp: ${sensor.temperature}°C<br>` : ''}
                ${sensor.humidity ? `Humidity: ${sensor.humidity}%` : ''}
            `);
        
        const iconColor = getStatusColor(sensor.status);
        marker.setIcon(
            L.divIcon({
                className: `custom-marker ${sensor.status}`,
                html: `<div style="background-color: ${iconColor}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${sensor.aqi}</div>`,
                iconSize: [30, 30]
            })
        );
        
        sensorMarkers.push(marker);
    });
}

// ===============================
// MQTT FUNCTIONS
// ===============================

function setupMQTT() {
    try {
        console.log('🔌 Connecting to MQTT broker...');
        updateMQTTStatus('CONNECTING');
        
        mqttClient = new Paho.MQTT.Client(
            MQTT_CONFIG.host,
            Number(MQTT_CONFIG.port),
            MQTT_CONFIG.clientId
        );

        mqttClient.onConnectionLost = onConnectionLost;
        mqttClient.onMessageArrived = onMessageArrived;

        const connectOptions = {
            useSSL: true,
            userName: MQTT_CONFIG.username,
            password: MQTT_CONFIG.password,
            onSuccess: onMQTTConnect,
            onFailure: onMQTTConnectionFailure,
            timeout: 3,
            keepAliveInterval: 60,
            cleanSession: true
        };

        mqttClient.connect(connectOptions);
        
    } catch (error) {
        console.error('MQTT setup error:', error);
        updateMQTTStatus('ERROR');
    }
}

function onMQTTConnect() {
    console.log('✅ Connected to MQTT broker');
    isMQTTConnected = true;
    updateMQTTStatus('CONNECTED');
    updateMQTTToggleButton();
    mqttClient.subscribe(MQTT_CONFIG.topic);
    console.log('📡 Subscribed to topic: ' + MQTT_CONFIG.topic);
}

function onMQTTConnectionFailure(error) {
    console.error('❌ MQTT connection failed:', error);
    isMQTTConnected = false;
    updateMQTTStatus('OFFLINE');
    updateMQTTToggleButton();
}

function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.error('🔌 Connection lost:', responseObject.errorMessage);
        isMQTTConnected = false;
        updateMQTTStatus('OFFLINE');
        updateMQTTToggleButton();
    }
}

function onMessageArrived(message) {
    try {
        console.log('📨 MQTT Message received:', message.payloadString);
        displayRawData(message.payloadString);
        
        const data = JSON.parse(message.payloadString);
        processMQTTData(data);
        
    } catch (error) {
        console.error('❌ Error processing MQTT message:', error);
        displayRawData('Error parsing: ' + message.payloadString);
    }
}

function processMQTTData(data) {
    // Extract values with fallbacks for different field names
    const temperature = data.temperature || data.temp || 0;
    const humidity = data.humidity || data.hum || 0;
    const gas = data.gas || data.gasLevel || 0;
    
    // Create sensor object from MQTT data
    mqttSensor = {
        id: 'esp32-live',
        name: 'ESP32 Live Sensor 🔥',
        lat: data.latitude || 9.211889407438802,
        lng: data.longitude || 76.642251169034,
        aqi: calculateAQIFromGas(gas),
        pm25: data.pm25 || 0,
        pm10: data.pm10 || 0,
        temperature: temperature,
        humidity: humidity,
        gas: gas,
        status: getAqiStatus(calculateAQIFromGas(gas)),
        lastUpdate: new Date().toISOString(),
        isRealTime: true
    };
    
    // Update MQTT history
    updateMqttHistory(mqttSensor);
    
    console.log('📊 Processed MQTT data:', mqttSensor);
    
    // Update gauges
    updateMQTTGauges(mqttSensor);
    
    // If currently viewing MQTT data, update dashboard
    if (currentDataSource === 'mqtt') {
        updateDashboard();
    }
    
    updateMQTTStatus('LIVE DATA');
}

function updateMqttHistory(sensor) {
    const timestamp = new Date().toLocaleTimeString();
    
    mqttHistory.temperature.push(sensor.temperature);
    mqttHistory.humidity.push(sensor.humidity);
    mqttHistory.gas.push(sensor.gas);
    mqttHistory.timestamps.push(timestamp);
    
    // Keep only last 20 readings
    if (mqttHistory.temperature.length > 20) {
        mqttHistory.temperature.shift();
        mqttHistory.humidity.shift();
        mqttHistory.gas.shift();
        mqttHistory.timestamps.shift();
    }
}

function updateMQTTGauges(sensor) {
    // Update temperature gauge (0-50°C range)
    updateGauge('tempGauge', sensor.temperature, 0, 50, '°C');
    updateGaugeDetail('tempGaugeDetail', sensor.temperature, '°C', getTempStatus(sensor.temperature));
    
    // Update humidity gauge (0-100% range)
    updateGauge('humidityGauge', sensor.humidity, 0, 100, '%');
    updateGaugeDetail('humidityGaugeDetail', sensor.humidity, '%', getHumidityStatus(sensor.humidity));
    
    // Update gas gauge (0-1000 ppm range)
    updateGauge('gasGauge', sensor.gas, 0, 1000, 'ppm');
    updateGaugeDetail('gasDetail', sensor.gas, 'ppm', getGasStatus(sensor.gas));
}

function updateGauge(gaugeId, value, min, max, unit) {
    const gauge = document.getElementById(gaugeId);
    if (gauge && value !== null) {
        const fill = gauge.querySelector('.gauge-fill');
        const valueSpan = gauge.querySelector('.gauge-value');
        
        const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
        fill.style.width = `${percentage}%`;
        valueSpan.textContent = `${value.toFixed(1)} ${unit}`;
    }
}

function updateGaugeDetail(elementId, value, unit, status) {
    const element = document.getElementById(elementId);
    if (element && value !== null) {
        element.textContent = `${value.toFixed(1)}${unit} (${status})`;
    }
}

function toggleMQTT() {
    const toggleBtn = document.getElementById('mqttToggle');
    
    if (isMQTTConnected) {
        // Disconnect
        if (mqttClient) {
            mqttClient.disconnect();
        }
        isMQTTConnected = false;
        toggleBtn.textContent = '🟢 Start MQTT';
        toggleBtn.className = 'mqtt-toggle disconnected';
        updateMQTTStatus('STOPPED');
    } else {
        // Reconnect
        setupMQTT();
        toggleBtn.textContent = '🔴 Stop MQTT';
        toggleBtn.className = 'mqtt-toggle connected';
    }
}

function updateMQTTToggleButton() {
    const toggleBtn = document.getElementById('mqttToggle');
    if (toggleBtn) {
        if (isMQTTConnected) {
            toggleBtn.textContent = '🔴 Stop MQTT';
            toggleBtn.className = 'mqtt-toggle connected';
        } else {
            toggleBtn.textContent = '🟢 Start MQTT';
            toggleBtn.className = 'mqtt-toggle disconnected';
        }
    }
}

// ===============================
// CHART FUNCTIONS
// ===============================

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
            animation: false
        }
    });

    // Pollutant Chart
    const pollutantCtx = document.getElementById('pollutantChart').getContext('2d');
    window.pollutantChart = new Chart(pollutantCtx, {
        type: 'line',
        data: {
            labels: historicalData.labels,
            datasets: [
                {
                    label: 'PM2.5',
                    data: historicalData.pm25,
                    borderColor: 'rgba(231, 76, 60, 0.8)',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Temperature',
                    data: historicalData.temperature,
                    borderColor: 'rgba(52, 152, 219, 0.8)',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            animation: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'PM2.5 (μg/m³)'
                    }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

function updateChartsWithData() {
    const now = new Date();
    const timeLabel = now.getHours() + ':' + now.getMinutes().toString().padStart(2, '0');
    
    // Update labels
    historicalData.labels.push(timeLabel);
    if (historicalData.labels.length > 12) historicalData.labels.shift();
    
    // Get current data based on source
    let currentData = null;
    switch(currentDataSource) {
        case 'mqtt':
            if (mqttSensor) {
                currentData = {
                    aqi: mqttSensor.aqi,
                    pm25: mqttSensor.pm25,
                    temperature: mqttSensor.temperature,
                    humidity: mqttSensor.humidity
                };
            }
            break;
        case 'api':
            if (realSensors.length > 0) {
                currentData = {
                    aqi: Math.round(realSensors.reduce((sum, sensor) => sum + sensor.aqi, 0) / realSensors.length),
                    pm25: Math.round(realSensors.reduce((sum, sensor) => sum + sensor.pm25, 0) / realSensors.length),
                    temperature: Math.round(realSensors.reduce((sum, sensor) => sum + sensor.temperature, 0) / realSensors.length),
                    humidity: Math.round(realSensors.reduce((sum, sensor) => sum + sensor.humidity, 0) / realSensors.length)
                };
            }
            break;
        case 'demo':
            if (FALLBACK_SENSORS.length > 0) {
                currentData = {
                    aqi: Math.round(FALLBACK_SENSORS.reduce((sum, sensor) => sum + sensor.aqi, 0) / FALLBACK_SENSORS.length),
                    pm25: Math.round(FALLBACK_SENSORS.reduce((sum, sensor) => sum + sensor.pm25, 0) / FALLBACK_SENSORS.length),
                    temperature: Math.round(FALLBACK_SENSORS.reduce((sum, sensor) => sum + sensor.temperature, 0) / FALLBACK_SENSORS.length),
                    humidity: Math.round(FALLBACK_SENSORS.reduce((sum, sensor) => sum + sensor.humidity, 0) / FALLBACK_SENSORS.length)
                };
            }
            break;
    }
    
    if (currentData) {
        // Update AQI data
        historicalData.aqi.push(currentData.aqi);
        if (historicalData.aqi.length > 12) historicalData.aqi.shift();
        
        // Update PM2.5 data
        historicalData.pm25.push(currentData.pm25);
        if (historicalData.pm25.length > 12) historicalData.pm25.shift();
        
        // Update temperature data
        historicalData.temperature.push(currentData.temperature);
        if (historicalData.temperature.length > 12) historicalData.temperature.shift();
        
        // Update humidity data
        historicalData.humidity.push(currentData.humidity);
        if (historicalData.humidity.length > 12) historicalData.humidity.shift();
    }
    
    // Update charts
    if (window.aqiChart) {
        window.aqiChart.data.labels = historicalData.labels;
        window.aqiChart.data.datasets[0].data = historicalData.aqi;
        window.aqiChart.update('none');
    }
    
    if (window.pollutantChart) {
        window.pollutantChart.data.labels = historicalData.labels;
        window.pollutantChart.data.datasets[0].data = historicalData.pm25;
        window.pollutantChart.data.datasets[1].data = historicalData.temperature;
        window.pollutantChart.update('none');
    }
}

// ===============================
// API FUNCTIONS
// ===============================

async function fetchAirQualityData(city) {
    const apiUrl = `https://api.waqi.info/feed/${city}/?token=${API_KEY}`;
    const url = CORS_PROXY + encodeURIComponent(apiUrl);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
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

function processAPIData(city, apiData) {
    if (!apiData) return null;
    
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
        isRealData: true
    };
    
    return sensorData;
}

async function updateAllFromAPI() {
    const apiStatus = document.getElementById('apiStatus');
    
    try {
        apiStatus.textContent = 'API: FETCHING...';
        apiStatus.className = 'api-status connecting';
        
        const fetchPromises = CITIES.map(city => 
            Promise.race([
                fetchAirQualityData(city),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 8000)
                )
            ])
        );
        
        const results = await Promise.allSettled(fetchPromises);
        
        realSensors = CITIES.map((city, index) => {
            if (results[index].status === 'fulfilled' && results[index].value) {
                return processAPIData(city, results[index].value);
            }
            return null;
        }).filter(sensor => sensor !== null);
        
        if (realSensors.length > 0) {
            apiStatus.textContent = `API: ONLINE (${realSensors.length}/${CITIES.length})`;
            apiStatus.className = 'api-status';
            
            if (currentDataSource === 'api') {
                updateDashboard();
            }
        } else {
            throw new Error('No data received from any API endpoint');
        }
        
    } catch (error) {
        console.error('💥 API Update failed:', error);
        apiStatus.textContent = 'API: OFFLINE';
        apiStatus.className = 'api-status offline';
        
        if (currentDataSource === 'api') {
            switchDataSource('demo');
        }
    }
}

// ===============================
// DASHBOARD FUNCTIONS
// ===============================

function updateDashboard() {
    const updateTime = new Date();
    document.getElementById('lastUpdate').textContent = `Last update: ${updateTime.toLocaleTimeString()}`;
    
    let displaySensors = [];
    let dataSource = '';
    
    switch(currentDataSource) {
        case 'mqtt':
            displaySensors = mqttSensor ? [mqttSensor] : [];
            dataSource = 'LIVE SENSOR';
            // Show/hide real-time section
            document.getElementById('realtimeSection').style.display = mqttSensor ? 'block' : 'none';
            break;
        case 'api':
            displaySensors = realSensors;
            dataSource = 'API DATA';
            document.getElementById('realtimeSection').style.display = 'none';
            break;
        case 'demo':
            displaySensors = FALLBACK_SENSORS;
            dataSource = 'DEMO DATA';
            document.getElementById('realtimeSection').style.display = 'none';
            break;
    }
    
    if (displaySensors.length === 0) {
        // No data available
        document.getElementById('mainAqi').textContent = '--';
        document.getElementById('mainStatus').textContent = 'No Data';
        document.getElementById('pm25Value').textContent = '-- μg/m³';
        document.getElementById('tempValue').textContent = '--°C';
        document.getElementById('humidityValue').textContent = '--%';
        return;
    }
    
    // Calculate averages
    const avgAqi = Math.round(displaySensors.reduce((sum, sensor) => sum + sensor.aqi, 0) / displaySensors.length);
    const avgPM25 = Math.round(displaySensors.reduce((sum, sensor) => sum + sensor.pm25, 0) / displaySensors.length);
    const avgTemp = Math.round(displaySensors.reduce((sum, sensor) => sum + sensor.temperature, 0) / displaySensors.length);
    const avgHumidity = Math.round(displaySensors.reduce((sum, sensor) => sum + sensor.humidity, 0) / displaySensors.length);
    
    // Update main cards
    const aqiElement = document.getElementById('mainAqi');
    aqiElement.textContent = avgAqi;
    aqiElement.className = 'aqi-value ' + getAqiStatus(avgAqi);
    document.getElementById('mainStatus').textContent = getAqiStatus(avgAqi).toUpperCase() + ' | ' + dataSource;
    
    document.getElementById('pm25Value').textContent = `${avgPM25} μg/m³`;
    document.getElementById('pm25Status').textContent = getPM25Status(avgPM25);
    document.getElementById('tempValue').textContent = `${avgTemp}°C`;
    document.getElementById('tempStatus').textContent = getTempStatus(avgTemp);
    document.getElementById('humidityValue').textContent = `${avgHumidity}%`;
    document.getElementById('humidityStatus').textContent = getHumidityStatus(avgHumidity);
    
    // Update sensor grid and map
    updateSensorGrid(displaySensors);
    updateMapMarkers();
    updateChartsWithData();
}

function updateSensorGrid(sensors) {
    const sensorGrid = document.getElementById('sensorGrid');
    sensorGrid.innerHTML = '';

    sensors.forEach(sensor => {
        const sensorElement = document.createElement('div');
        sensorElement.className = `sensor-item ${sensor.status}`;
        const dataSource = sensor.isRealTime ? '🔥 LIVE' : (sensor.isRealData ? '🌐 API' : '📱 DEMO');
        
        sensorElement.innerHTML = `
            <div class="sensor-header">
                <span class="sensor-name">${sensor.name}</span>
                <span class="sensor-aqi">AQI: ${sensor.aqi}</span>
            </div>
            <div class="sensor-details">
                <p>PM2.5: ${sensor.pm25} μg/m³ | PM10: ${sensor.pm10} μg/m³</p>
                <p>Temp: ${sensor.temperature}°C | Humidity: ${sensor.humidity}%</p>
                ${sensor.gas ? `<p>Gas: ${sensor.gas} ppm</p>` : ''}
                <p class="sensor-status">Status: <strong>${sensor.status.toUpperCase()}</strong> | ${dataSource}</p>
                <small>Updated: ${new Date(sensor.lastUpdate).toLocaleTimeString()}</small>
            </div>
        `;
        sensorGrid.appendChild(sensorElement);
    });
}

// ===============================
// DATA SOURCE MANAGEMENT
// ===============================

function switchDataSource(source) {
    currentDataSource = source;
    
    // Update toggle buttons
    document.querySelectorAll('.source-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update dashboard with new data source
    updateDashboard();
    
    console.log(`🔄 Switched to data source: ${source}`);
}

function startRealTimeUpdates() {
    console.log('⏰ Starting update intervals...');
    
    // Initial API update
    updateAllFromAPI();
    
    // Update API data every 2 minutes
    setInterval(updateAllFromAPI, 120000);
    
    // Update charts every 30 seconds
    setInterval(updateChartsWithData, 30000);
}

// ===============================
// HELPER FUNCTIONS
// ===============================

function updateMQTTStatus(status) {
    const mqttStatus = document.getElementById('mqttStatus');
    mqttStatus.textContent = `MQTT: ${status}`;
    
    if (status === 'CONNECTED' || status === 'LIVE DATA') {
        mqttStatus.className = 'api-status';
    } else if (status === 'CONNECTING') {
        mqttStatus.className = 'api-status connecting';
    } else {
        mqttStatus.className = 'api-status offline';
    }
}

function displayRawData(data) {
    const rawDataElement = document.getElementById('rawData');
    if (rawDataElement) {
        rawDataElement.textContent = data;
        // Auto-scroll to bottom
        rawDataElement.scrollTop = rawDataElement.scrollHeight;
    }
}

function calculateAQI(pm25) {
    if (pm25 <= 12) return Math.floor((pm25 / 12) * 50);
    if (pm25 <= 35.4) return Math.floor(50 + ((pm25 - 12.1) / (35.4 - 12.1)) * 50);
    if (pm25 <= 55.4) return Math.floor(100 + ((pm25 - 35.5) / (55.4 - 35.5)) * 50);
    if (pm25 <= 150.4) return Math.floor(150 + ((pm25 - 55.5) / (150.4 - 55.5)) * 50);
    return 200 + Math.floor((pm25 - 150.5) / 2);
}

function calculateAQIFromGas(gas) {
    // Simple conversion from gas ppm to AQI
    if (gas <= 50) return Math.floor((gas / 50) * 50);
    if (gas <= 100) return Math.floor(50 + ((gas - 50) / 50) * 50);
    if (gas <= 200) return Math.floor(100 + ((gas - 100) / 100) * 50);
    return 150 + Math.floor((gas - 200) / 10);
}

function getAqiStatus(aqi) {
    if (aqi <= 50) return 'good';
    if (aqi <= 100) return 'moderate';
    return 'poor';
}

function getStatusColor(status) {
    const colors = {
        good: '#27ae60',
        moderate: '#f39c12',
        poor: '#e74c3c'
    };
    return colors[status] || '#3498db';
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

function getGasStatus(gas) {
    if (gas <= 100) return 'Good';
    if (gas <= 300) return 'Moderate';
    if (gas <= 500) return 'Poor';
    return 'Hazardous';
}

// Manual refresh function
window.refreshData = function() {
    updateAllFromAPI();
    if (currentDataSource === 'demo') {
        updateDashboard();
    }
};