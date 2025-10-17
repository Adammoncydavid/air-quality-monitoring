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
    if (window.currentMarkers) {
        window.currentMarkers.forEach(marker => window.map.removeLayer(marker));
    }
    
    window.currentMarkers = [];
    
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
        
        window.currentMarkers.push(marker);
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

// Update sensor grid with current data
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

// **MASTER UPDATE FUNCTION - Updates everything**
function updateAllData() {
    // Generate realistic random changes
    dummySensors.forEach(sensor => {
        // Random but realistic fluctuations
        const pm25Change = Math.floor(Math.random() * 6) - 2; // -2 to +3
        const tempChange = (Math.random() * 2) - 1; // -1 to +1
        const humidityChange = Math.floor(Math.random() * 10) - 5; // -5 to +4
        
        // Update values with bounds
        sensor.pm25 = Math.max(0, sensor.pm25 + pm25Change);
        sensor.temperature = Math.max(-10, Math.min(45, sensor.temperature + tempChange));
        sensor.humidity = Math.max(10, Math.min(95, sensor.humidity + humidityChange));
        
        // Recalculate AQI based on PM2.5 (simplified)
        sensor.aqi = Math.min(300, Math.max(0, Math.floor(sensor.pm25 * 2 + Math.random() * 20)));
        
        // Update status based on new AQI
        sensor.status = getAqiStatus(sensor.aqi);
        
        // Update last update time
        sensor.lastUpdate = new Date().toISOString();
    });

    // Update status cards
    updateStatusCards();
    
    // Update map markers
    updateMapMarkers();
    
    // Update sensor grid
    updateSensorGrid();
    
    // Update charts with new data point
    updateCharts();
}

// Update the top status cards
function updateStatusCards() {
    // Calculate average AQI across all sensors
    const avgAqi = Math.floor(dummySensors.reduce((sum, sensor) => sum + sensor.aqi, 0) / dummySensors.length);
    
    // Update main AQI card
    const aqiCard = document.querySelector('.aqi-value');
    aqiCard.textContent = avgAqi;
    aqiCard.className = 'aqi-value ' + getAqiStatus(avgAqi);
    
    // Update status text
    const statusText = aqiCard.nextElementSibling;
    statusText.textContent = getAqiStatus(avgAqi).charAt(0).toUpperCase() + getAqiStatus(avgAqi).slice(1);

    // Update PM2.5 card (average)
    const avgPm25 = Math.floor(dummySensors.reduce((sum, sensor) => sum + sensor.pm25, 0) / dummySensors.length);
    document.querySelector('.card:nth-child(2) .value').textContent = `${avgPm25} μg/m³`;
    document.querySelector('.card:nth-child(2) p').textContent = getPm25Status(avgPm25);

    // Update temperature card (average)
    const avgTemp = (dummySensors.reduce((sum, sensor) => sum + sensor.temperature, 0) / dummySensors.length).toFixed(1);
    document.querySelector('.card:nth-child(3) .value').textContent = `${avgTemp}°C`;

    // Update humidity card (average)
    const avgHumidity = Math.floor(dummySensors.reduce((sum, sensor) => sum + sensor.humidity, 0) / dummySensors.length);
    document.querySelector('.card:nth-child(4) .value').textContent = `${avgHumidity}%`;
}

// Update charts with rolling data
function updateCharts() {
    const now = new Date();
    const timeLabel = now.getHours() + ':' + now.getMinutes().toString().padStart(2, '0');
    
    // Update AQI chart
    const aqiData = window.aqiChart.data;
    aqiData.labels.push(timeLabel);
    aqiData.labels.shift(); // Remove oldest label
    
    const newAqi = Math.floor(dummySensors.reduce((sum, sensor) => sum + sensor.aqi, 0) / dummySensors.length);
    aqiData.datasets[0].data.push(newAqi);
    aqiData.datasets[0].data.shift(); // Remove oldest data point
    
    window.aqiChart.update('none');
    
    // Update pollutant chart
    const pollData = window.pollutantChart.data;
    pollData.labels.push(timeLabel);
    pollData.labels.shift();
    
    const newPm25 = Math.floor(dummySensors.reduce((sum, sensor) => sum + sensor.pm25, 0) / dummySensors.length);
    pollData.datasets[0].data.push(newPm25);
    pollData.datasets[0].data.shift();
    
    const newTemp = (dummySensors.reduce((sum, sensor) => sum + sensor.temperature, 0) / dummySensors.length).toFixed(1);
    pollData.datasets[1].data.push(parseFloat(newTemp));
    pollData.datasets[1].data.shift();
    
    window.pollutantChart.update('none');
}

// Simulate live updates - UPDATED VERSION
function startLiveUpdates() {
    // Initial update
    updateAllData();
    
    // Update everything every 3 seconds
    setInterval(() => {
        updateAllData();
        console.log('📊 Full data update completed at', new Date().toLocaleTimeString());
    }, 3000);
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

function getPm25Status(pm25) {
    if (pm25 <= 12) return 'Good';
    if (pm25 <= 35) return 'Moderate';
    return 'Poor';
}
