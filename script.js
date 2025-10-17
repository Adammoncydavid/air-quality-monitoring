// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeCharts();
    loadSensors();
    startLiveUpdates();
});

// Initialize Leaflet Map
function initializeMap() {
    // Create map centered on a default location
    const map = L.map('map').setView([40.7589, -73.9851], 12);

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add sensor markers
    dummySensors.forEach(sensor => {
        const marker = L.marker([sensor.lat, sensor.lng])
            .addTo(map)
            .bindPopup(`
                <strong>${sensor.name}</strong><br>
                AQI: ${sensor.aqi} (${sensor.status})<br>
                PM2.5: ${sensor.pm25} μg/m³<br>
                Temp: ${sensor.temperature}°C
            `);
        
        // Color code markers based on AQI
        const iconColor = getStatusColor(sensor.status);
        marker.setIcon(
            L.divIcon({
                className: `custom-marker ${sensor.status}`,
                html: `<div style="background-color: ${iconColor}">${sensor.aqi}</div>`,
                iconSize: [30, 30]
            })
        );
    });

    window.map = map; // Store map globally
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
            </div>
        `;
        sensorGrid.appendChild(sensorElement);
    });
}

// Simulate live updates
function startLiveUpdates() {
    setInterval(() => {
        // Update overall AQI card with random variation
        const aqiCard = document.querySelector('.aqi-value');
        const currentAqi = parseInt(aqiCard.textContent);
        const newAqi = Math.max(0, currentAqi + Math.floor(Math.random() * 10 - 5));
        
        aqiCard.textContent = newAqi;
        aqiCard.className = 'aqi-value ' + getAqiStatus(newAqi);
        
        // Update the status text
        const statusText = aqiCard.nextElementSibling;
        statusText.textContent = getAqiStatus(newAqi).charAt(0).toUpperCase() + getAqiStatus(newAqi).slice(1);

        console.log('Live update: AQI now at', newAqi);
    }, 5000); // Update every 5 seconds
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