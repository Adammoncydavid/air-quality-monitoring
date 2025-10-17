// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeCharts();
    loadSensors();
    startLiveUpdates();
});

// Initialize Leaflet Map
function initializeMap() {
    const map = L.map('map').setView([40.7589, -73.9851], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    window.map = map;
    updateMapMarkers();
}

// Update all map markers with current data
function updateMapMarkers() {
    // Clear existing markers
    if (window.sensorMarkers) {
        window.sensorMarkers.forEach(marker => window.map.removeLayer(marker));
    }
    
    window.sensorMarkers = [];
    
    // Add updated markers
    dummySensors.forEach(sensor => {
        const marker = L.marker([sensor.lat, sensor.lng])
            .addTo(window.map)
            .bindPopup(`
                <strong>${sensor.name}</strong><br>
                AQI: ${sensor.aqi} (${sensor.status})<br>
                PM2.5: ${sensor.pm25} μg/m³<br>
                Temp: ${sensor.temperature}°C
            `);
        
        const iconColor = getStatusColor(sensor.status);
        marker.setIcon(
            L.divIcon({
                className: `custom-marker ${sensor.status}`,
                html: `<div style="background-color: ${iconColor}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${sensor.aqi}</div>`,
                iconSize: [30, 30]
            })
        );
        
        window.sensorMarkers.push(marker);
    });
}

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
                },
                {
                    label: 'Temperature',
                    data: historicalData.temperature,
                    backgroundColor: 'rgba(52, 152, 219, 0.8)',
                    type: 'line',
                    yAxisID: 'y1'
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

// Load sensor list
function loadSensors() {
    updateSensorGrid();
}

// Update all sensor cards
function updateSensorGrid() {
    const sensorGrid = document.getElementById('sensorGrid');
    sensorGrid.innerHTML = '';

    dummySensors.forEach(sensor => {
        const sensorElement = document.createElement('div');
        sensorElement.className = `sensor-item ${sensor.status}`;
        sensorElement.innerHTML = `
            <div class="sensor-header">
                <span class="sensor-name">${sensor.name}</span>
                <span class="sensor-aqi">AQI: ${sensor.aqi}</span>
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

// Update status cards (PM2.5, Temperature, Humidity)
function updateStatusCards() {
    // Get average values from all sensors
    const avgPM25 = Math.round(dummySensors.reduce((sum, sensor) => sum + sensor.pm25, 0) / dummySensors.length);
    const avgTemp = Math.round(dummySensors.reduce((sum, sensor) => sum + sensor.temperature, 0) / dummySensors.length);
    const avgHumidity = Math.round(dummySensors.reduce((sum, sensor) => sum + sensor.humidity, 0) / dummySensors.length);
    
    // Update PM2.5 card
    const pm25Card = document.querySelectorAll('.card')[1];
    pm25Card.querySelector('.value').textContent = `${avgPM25} μg/m³`;
    pm25Card.querySelector('p').textContent = getPM25Status(avgPM25);
    
    // Update Temperature card
    const tempCard = document.querySelectorAll('.card')[2];
    tempCard.querySelector('.value').textContent = `${avgTemp}°C`;
    tempCard.querySelector('p').textContent = getTempStatus(avgTemp);
    
    // Update Humidity card
    const humidityCard = document.querySelectorAll('.card')[3];
    humidityCard.querySelector('.value').textContent = `${avgHumidity}%`;
    humidityCard.querySelector('p').textContent = getHumidityStatus(avgHumidity);
}

// Update charts with new data
function updateCharts() {
    // Shift historical data and add new values
    historicalData.labels.push(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
    historicalData.labels.shift();
    
    // Add new AQI value (average of all sensors)
    const avgAqi = Math.round(dummySensors.reduce((sum, sensor) => sum + sensor.aqi, 0) / dummySensors.length);
    historicalData.aqi.push(avgAqi);
    historicalData.aqi.shift();
    
    // Add new PM2.5 value
    const avgPM25 = Math.round(dummySensors.reduce((sum, sensor) => sum + sensor.pm25, 0) / dummySensors.length);
    historicalData.pm25.push(avgPM25);
    historicalData.pm25.shift();
    
    // Add new temperature (slight variation)
    const newTemp = historicalData.temperature[historicalData.temperature.length - 1] + (Math.random() * 2 - 1);
    historicalData.temperature.push(Math.round(newTemp * 10) / 10);
    historicalData.temperature.shift();
    
    // Update charts
    window.aqiChart.update();
    window.pollutantChart.update();
}

// Generate realistic sensor data updates
function updateSensorData() {
    dummySensors.forEach(sensor => {
        // Simulate realistic changes
        sensor.aqi = Math.max(0, sensor.aqi + Math.floor(Math.random() * 10 - 4));
        sensor.pm25 = Math.max(0, sensor.pm25 + Math.floor(Math.random() * 6 - 2));
        sensor.pm10 = Math.max(0, sensor.pm10 + Math.floor(Math.random() * 8 - 3));
        sensor.temperature = Math.max(-10, sensor.temperature + (Math.random() * 2 - 1));
        sensor.humidity = Math.max(0, Math.min(100, sensor.humidity + Math.floor(Math.random() * 6 - 3)));
        
        // Update status based on new AQI
        sensor.status = getAqiStatus(sensor.aqi);
        sensor.lastUpdate = new Date().toISOString();
    });
}

// Main update function - updates EVERYTHING
function startLiveUpdates() {
    setInterval(() => {
        console.log('🔄 Updating all data...');
        
        // 1. Update sensor data
        updateSensorData();
        
        // 2. Update main AQI card
        const avgAqi = Math.round(dummySensors.reduce((sum, sensor) => sum + sensor.aqi, 0) / dummySensors.length);
        const aqiCard = document.querySelector('.aqi-value');
        aqiCard.textContent = avgAqi;
        aqiCard.className = 'aqi-value ' + getAqiStatus(avgAqi);
        
        // Update status text
        const statusText = aqiCard.nextElementSibling;
        statusText.textContent = getAqiStatus(avgAqi).charAt(0).toUpperCase() + getAqiStatus(avgAqi).slice(1);
        
        // 3. Update all status cards
        updateStatusCards();
        
        // 4. Update sensor grid
        updateSensorGrid();
        
        // 5. Update map markers
        updateMapMarkers();
        
        // 6. Update charts
        updateCharts();
        
        console.log('✅ All data updated at', new Date().toLocaleTimeString());
        
    }, 3000); // Update every 3 seconds for more activity
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
    if (temp >= 22 && temp <= 26) return 'Comfortable';
    if (temp >= 18 && temp <= 30) return 'Normal';
    return 'Extreme';
}

function getHumidityStatus(humidity) {
    if (humidity >= 40 && humidity <= 60) return 'Ideal';
    if (humidity >= 30 && humidity <= 70) return 'Normal';
    return 'Extreme';
}
