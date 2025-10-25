// ===============================
// GLOBAL VARIABLES
// ===============================

let currentDataSource = 'demo'; // 'mqtt', 'demo'
let mqttSensor = null;
let map;
let sensorMarkers = [];

// Demo data for both locations
const DEMO_DATA = {
    library: {
        aqi: 45,
        pm25: 12,
        temperature: 28,
        humidity: 75,
        gas: 45,
        status: "good"
    },
    canteen: {
        aqi: 68,
        pm25: 25,
        temperature: 29,
        humidity: 72,
        gas: 120,
        status: "moderate"
    }
};

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

// ===============================
// INITIALIZATION
// ===============================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Starting Campus Air Quality Dashboard...');
    initializeMap();
    initializeCharts();
    setupMQTTListeners();
    startRealTimeUpdates();
    updateLocationComparison();
});

// ===============================
// MQTT EVENT HANDLERS
// ===============================

function setupMQTTListeners() {
    // Listen for MQTT messages
    mqttClient.onMessage(function(sensorData) {
        if (sensorData.error) {
            console.error('MQTT Error:', sensorData.error);
            displayRawData('Error: ' + sensorData.error + '\nRaw: ' + sensorData.rawData);
            return;
        }
        
        mqttSensor = sensorData;
        displayRawData(JSON.stringify(sensorData.rawData, null, 2));
        
        // Update MQTT history
        updateMqttHistory(mqttSensor);
        
        // Update gauges
        updateMQTTGauges(mqttSensor);
        
        // Update location comparison
        updateLocationComparison();
        
        // If currently viewing MQTT data, update dashboard
        if (currentDataSource === 'mqtt') {
            updateDashboard();
        }
    });
    
    // Listen for MQTT status changes
    mqttClient.onStatusChange(function(status) {
        updateMQTTStatus(status);
        updateMQTTToggleButton();
    });
}

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

    // Add markers for both locations
    const locations = mqttClient.getLocations();
    Object.keys(locations).forEach(locationKey => {
        const location = locations[locationKey];
        const marker = L.marker([location.lat, location.lng])
            .addTo(map)
            .bindPopup(`
                <strong>${location.icon} ${location.name}</strong><br>
                <em>Air Quality Monitoring Station</em>
            `);
        
        marker.setIcon(
            L.divIcon({
                className: 'location-marker',
                html: `<div style="background-color: #3498db; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 16px;">${location.icon}</div>`,
                iconSize: [40, 40]
            })
        );
        
        sensorMarkers.push(marker);
    });
}

// ===============================
// MQTT-RELATED FUNCTIONS
// ===============================

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
    updateGaugeDetail('tempGaugeDetail', sensor.temperature, '°C', mqttClient.getTempStatus(sensor.temperature));
    
    // Update humidity gauge (0-100% range)
    updateGauge('humidityGauge', sensor.humidity, 0, 100, '%');
    updateGaugeDetail('humidityGaugeDetail', sensor.humidity, '%', mqttClient.getHumidityStatus(sensor.humidity));
    
    // Update gas gauge (0-1000 ppm range)
    updateGauge('gasGauge', sensor.gas, 0, 1000, 'ppm');
    updateGaugeDetail('gasDetail', sensor.gas, 'ppm', mqttClient.getGasStatus(sensor.gas));
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
    const status = mqttClient.getStatus();
    
    if (status.isConnected) {
        // Disconnect
        mqttClient.disconnect();
    } else {
        // Reconnect
        mqttClient.connect();
    }
}

function updateMQTTToggleButton() {
    const toggleBtn = document.getElementById('mqttToggle');
    const status = mqttClient.getStatus();
    
    if (toggleBtn) {
        if (status.isConnected) {
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
            datasets: [
                {
                    label: 'Library AQI',
                    data: [],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Canteen AQI',
                    data: [],
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            animation: false
        }
    });

    // Environment Chart
    const envCtx = document.getElementById('environmentChart').getContext('2d');
    window.environmentChart = new Chart(envCtx, {
        type: 'line',
        data: {
            labels: historicalData.labels,
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: historicalData.temperature,
                    borderColor: 'rgba(231, 76, 60, 0.8)',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Humidity (%)',
                    data: historicalData.humidity,
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
                        text: 'Temperature (°C)'
                    }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Humidity (%)'
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
                    temperature: mqttSensor.temperature,
                    humidity: mqttSensor.humidity
                };
            }
            break;
        case 'demo':
            // Use average of both locations for demo data
            currentData = {
                aqi: Math.round((DEMO_DATA.library.aqi + DEMO_DATA.canteen.aqi) / 2),
                temperature: Math.round((DEMO_DATA.library.temperature + DEMO_DATA.canteen.temperature) / 2),
                humidity: Math.round((DEMO_DATA.library.humidity + DEMO_DATA.canteen.humidity) / 2)
            };
            break;
    }
    
    if (currentData) {
        // Update AQI data
        historicalData.aqi.push(currentData.aqi);
        if (historicalData.aqi.length > 12) historicalData.aqi.shift();
        
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
        // For demo, show both locations
        if (currentDataSource === 'demo') {
            window.aqiChart.data.datasets[0].data = Array(historicalData.labels.length).fill(DEMO_DATA.library.aqi);
            window.aqiChart.data.datasets[1].data = Array(historicalData.labels.length).fill(DEMO_DATA.canteen.aqi);
        } else {
            window.aqiChart.data.datasets[0].data = historicalData.aqi;
            window.aqiChart.data.datasets[1].data = historicalData.aqi;
        }
        window.aqiChart.update('none');
    }
    
    if (window.environmentChart) {
        window.environmentChart.data.labels = historicalData.labels;
        window.environmentChart.data.datasets[0].data = historicalData.temperature;
        window.environmentChart.data.datasets[1].data = historicalData.humidity;
        window.environmentChart.update('none');
    }
}

// ===============================
// LOCATION COMPARISON FUNCTIONS
// ===============================

function updateLocationComparison() {
    let libraryData, canteenData;
    
    if (currentDataSource === 'mqtt' && mqttSensor) {
        // For MQTT data, show current sensor reading in one location and demo in the other
        if (mqttSensor.location === 'library') {
            libraryData = mqttSensor;
            canteenData = DEMO_DATA.canteen;
        } else {
            libraryData = DEMO_DATA.library;
            canteenData = mqttSensor;
        }
    } else {
        // For demo data, use predefined values
        libraryData = DEMO_DATA.library;
        canteenData = DEMO_DATA.canteen;
    }
    
    // Update Library card
    document.getElementById('libraryAqi').textContent = libraryData.aqi;
    document.getElementById('libraryAqi').className = getAqiStatus(libraryData.aqi);
    document.getElementById('libraryTemp').textContent = libraryData.temperature + '°C';
    document.getElementById('libraryHumidity').textContent = libraryData.humidity + '%';
    document.getElementById('libraryGas').textContent = libraryData.gas + ' ppm';
    
    // Update Canteen card
    document.getElementById('canteenAqi').textContent = canteenData.aqi;
    document.getElementById('canteenAqi').className = getAqiStatus(canteenData.aqi);
    document.getElementById('canteenTemp').textContent = canteenData.temperature + '°C';
    document.getElementById('canteenHumidity').textContent = canteenData.humidity + '%';
    document.getElementById('canteenGas').textContent = canteenData.gas + ' ppm';
    
    // Update card borders based on AQI status
    document.getElementById('libraryCard').className = `location-card ${libraryData.status}`;
    document.getElementById('canteenCard').className = `location-card ${canteenData.status}`;
}

// ===============================
// DASHBOARD FUNCTIONS
// ===============================

function updateDashboard() {
    const updateTime = new Date();
    document.getElementById('lastUpdate').textContent = `Last update: ${updateTime.toLocaleTimeString()}`;
    
    let displayData = null;
    let dataSource = '';
    
    switch(currentDataSource) {
        case 'mqtt':
            displayData = mqttSensor;
            dataSource = 'LIVE SENSOR';
            // Show real-time section
            document.getElementById('realtimeSection').style.display = mqttSensor ? 'block' : 'none';
            break;
        case 'demo':
            // Use average of both locations for main display
            displayData = {
                aqi: Math.round((DEMO_DATA.library.aqi + DEMO_DATA.canteen.aqi) / 2),
                pm25: Math.round((DEMO_DATA.library.pm25 + DEMO_DATA.canteen.pm25) / 2),
                temperature: Math.round((DEMO_DATA.library.temperature + DEMO_DATA.canteen.temperature) / 2),
                humidity: Math.round((DEMO_DATA.library.humidity + DEMO_DATA.canteen.humidity) / 2)
            };
            dataSource = 'DEMO DATA';
            document.getElementById('realtimeSection').style.display = 'none';
            break;
    }
    
    if (!displayData) {
        // No data available
        document.getElementById('mainAqi').textContent = '--';
        document.getElementById('mainStatus').textContent = 'No Data';
        document.getElementById('pm25Value').textContent = '-- μg/m³';
        document.getElementById('tempValue').textContent = '--°C';
        document.getElementById('humidityValue').textContent = '--%';
        return;
    }
    
    // Update main cards
    const aqiElement = document.getElementById('mainAqi');
    aqiElement.textContent = displayData.aqi;
    aqiElement.className = 'aqi-value ' + getAqiStatus(displayData.aqi);
    document.getElementById('mainStatus').textContent = getAqiStatus(displayData.aqi).toUpperCase() + ' | ' + dataSource;
    
    document.getElementById('pm25Value').textContent = `${displayData.pm25} μg/m³`;
    document.getElementById('pm25Status').textContent = getPM25Status(displayData.pm25);
    document.getElementById('tempValue').textContent = `${displayData.temperature}°C`;
    document.getElementById('tempStatus').textContent = getTempStatus(displayData.temperature);
    document.getElementById('humidityValue').textContent = `${displayData.humidity}%`;
    document.getElementById('humidityStatus').textContent = getHumidityStatus(displayData.humidity);
    
    // Update location comparison
    updateLocationComparison();
    updateChartsWithData();
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
    
    // Initial update
    updateDashboard();
    
    // Update data every 30 seconds
    setInterval(updateDashboard, 30000);
    
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
window.refreshData = function() {
    updateDashboard();
};