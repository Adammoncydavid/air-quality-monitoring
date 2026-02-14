// Dark Mode Toggle
const themeToggle = document.getElementById('themeToggle');
const moonIcon = document.getElementById('moonIcon');
const sunIcon = document.getElementById('sunIcon');

const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    moonIcon.style.display = 'none';
    sunIcon.style.display = 'inline';
}

themeToggle.addEventListener('click', () => {
    if (document.body.hasAttribute('data-theme')) {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        moonIcon.style.display = 'inline';
        sunIcon.style.display = 'none';
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        moonIcon.style.display = 'none';
        sunIcon.style.display = 'inline';
    }
    if (trendsChart) trendsChart.destroy();
    if (pollutantChart) pollutantChart.destroy();
    initializeChart();
});

// MQTT Connection to your HiveMQ Cloud
const MQTT_HOST = "cd29a7c955164a079ab779cab2f382d7.s1.eu.hivemq.cloud";
const MQTT_PORT = 8884;
const MQTT_USERNAME = "adam1234";
const MQTT_PASSWORD = "Adam1234";
const MQTT_TOPIC = "esp32/sensor";

const MAX_HISTORY = 1440;

let dataHistory = {
    timestamps: [],
    pm25: [],
    co2: [],
    co: [],
    temperature: [],
    humidity: []
};

let peakPollution = { time: '--:--', value: 0 };

let trendsChart;
let pollutantChart;
let liveMap;
let client;
/* ===== ESP32 PAYLOAD PARSER (ADDED) ===== */
function parseESP32Payload(payload) {
    let raw;

    try {
        raw = JSON.parse(payload);   // JSON payload
    } catch (e) {
        raw = {};                    // string payload
        payload.split(',').forEach(pair => {
            const [key, value] = pair.split(':');
            if (!key || !value) return;
            raw[key.trim().toLowerCase()] = parseFloat(value);
        });
    }

    // ✅ NORMALIZE KEYS FOR DASHBOARD
    return {
        pm25: raw.pm25,
        co2: raw.co2,
        co: raw.co,
        temperature: raw.temperature ?? raw.temp,
        humidity: raw.humidity ?? raw.hum
    };
}

/* ===== END ADDED CODE ===== */

function connectMqtt() {
    const options = {
        username: MQTT_USERNAME,
        password: MQTT_PASSWORD,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000
    };

    client = mqtt.connect(`wss://${MQTT_HOST}:${MQTT_PORT}/mqtt`, options);

    client.on('connect', function () {
        console.log('Connected to HiveMQ Cloud');
        document.getElementById('connectionDot').classList.add('connected');
        document.getElementById('connectionStatus').textContent = 'Connected';
        client.subscribe(MQTT_TOPIC, function (err) {
            if (!err) {
                console.log('Subscribed to ' + MQTT_TOPIC);
            } else {
                console.error('Subscription error:', err);
            }
        });
    });

    client.on('message', function (topic, message) {
        try {
            const data = parseESP32Payload(message.toString());
            updateDashboard(data);
            updateChart(data);
            updateMapMarkers(data);
            updateRawData(message.toString());
            document.getElementById('lastUpdate').textContent = `Last Update: ${new Date().toLocaleTimeString()}`;
        } catch (error) {
            console.error('Error parsing MQTT message:', error);
        }
    });

    client.on('error', function (error) {
        console.error('MQTT Error:', error);
        document.getElementById('connectionStatus').textContent = 'Connection Error';
    });

    client.on('offline', function () {
        document.getElementById('connectionDot').classList.remove('connected');
        document.getElementById('connectionStatus').textContent = 'Offline - Reconnecting...';
    });
}

function updateDashboard(data) {
    if (data.pm25 !== undefined) {
        updateSensorValue('pm25Value', data.pm25.toFixed(1), 'μg/m³');
        updateAqiIndicator('pm25Status', data.pm25, 'pm25');
    }
    if (data.co2 !== undefined) {
        updateSensorValue('co2Value', data.co2.toFixed(0), 'ppm');
        updateAqiIndicator('co2Status', data.co2, 'co2');
    }
    if (data.co !== undefined) {
        updateSensorValue('coValue', data.co.toFixed(0), 'ppm');
        updateAqiIndicator('coStatus', data.co, 'co');
    }
    if (data.temperature !== undefined) {
        updateSensorValue('tempValue', data.temperature.toFixed(1), '°C');
        updateAqiIndicator('tempStatus', data.temperature, 'temp');
    }
    if (data.humidity !== undefined) {
        updateSensorValue('humValue', data.humidity.toFixed(1), '%');
        updateAqiIndicator('humStatus', data.humidity, 'hum');
    }

    /* ===== NEW ANALYTICS INTEGRATION ===== */

    // 1. AI Prediction
    // Ensure we have some history, else use current
    const predHistory = dataHistory.pm25.length > 0 ? dataHistory.pm25 : [data.pm25 || 0];
    const predAQI = AeroAnalysis.predictNextHourAQI(predHistory);
    updateSensorValue('predValue', predAQI, 'AQI');

    const predEl = document.getElementById('predStatus');
    if (predAQI !== "Insufficient Data") {
        if (predAQI <= 50) { predEl.textContent = "Good"; predEl.className = "aqi-indicator aqi-good"; }
        else if (predAQI <= 100) { predEl.textContent = "Moderate"; predEl.className = "aqi-indicator aqi-moderate"; }
        else { predEl.textContent = "Poor"; predEl.className = "aqi-indicator aqi-poor"; }
    } else {
        predEl.textContent = "Gathering Data";
    }

    // 2. Performace Index
    const perf = AeroAnalysis.calculatePerformanceIndex(data.co2 || 400);
    updateSensorValue('perfScore', perf.score, '%');
    document.getElementById('perfText').textContent = perf.label;

    // 3. Ventilation Advice & Anomaly Detection
    const advice = AeroAnalysis.getVentilationAdvice(data.co2 || 400, data.pm25 || 10, 50);
    const anomalies = AeroAnalysis.detectAnomalies(data, dataHistory.co2.length > 0 ? { co2: dataHistory.co2[dataHistory.co2.length - 1], pm25: dataHistory.pm25[dataHistory.pm25.length - 1] } : null);

    const ventText = document.getElementById('ventilationText');
    if (ventText) {
        let html = advice.map(a => `• ${a}`).join('<br>');
        if (anomalies.length > 0) {
            html += `<br><strong style="color: #ef4444;">⚠️ ALERT: ${anomalies.join(', ')}</strong>`;
        }
        ventText.innerHTML = html;
    }

    // 4. Occupancy
    const occ = AeroAnalysis.estimateOccupancy(data.co2 || 400);
    const occEl = document.getElementById('occupancyEst');
    if (occEl) occEl.textContent = `~${occ} Students`;



    // 7. Thermal Comfort
    const comfort = AeroAnalysis.calculateThermalComfort(data.temperature || 25, data.humidity || 50);
    const comfortEl = document.getElementById('comfortIndex');
    if (comfortEl) comfortEl.textContent = comfort;

    // 19. Peak Pollution
    const currentAQI = calculateOverallAQI(data);
    if (currentAQI > peakPollution.value) {
        peakPollution.value = currentAQI;
        peakPollution.time = new Date().toLocaleTimeString();
        const peakEl = document.getElementById('peakTime');
        if (peakEl) peakEl.textContent = peakPollution.time;
    }

    // 20. Vent Efficiency
    if (dataHistory.co2.length > 1) {
        const prevCo2 = dataHistory.co2[dataHistory.co2.length - 2] || 400;
        const currCo2 = data.co2 || prevCo2;
        if (currCo2 < prevCo2) {
            const eff = AeroAnalysis.calculateVentilationEfficiency(prevCo2, currCo2, 1);
            const ventEffEl = document.getElementById('ventEff');
            if (ventEffEl) ventEffEl.textContent = `${eff}%`;
        }
    }

    // 28. Carbon Footprint
    const hours = Math.max(1, dataHistory.timestamps.length) / 60;
    const carbon = AeroAnalysis.estimateCarbonFootprint(hours);
    const carbonEl = document.getElementById('carbonFp');
    if (carbonEl) carbonEl.textContent = `${carbon} kg`;
}

function updateSensorValue(id, value, unit) {
    const element = document.getElementById(id);
    element.innerHTML = `${value} <span class="sensor-unit">${unit}</span>`;
    element.classList.add('data-update');
    setTimeout(() => element.classList.remove('data-update'), 1500);
}

function updateAqiIndicator(id, value, type) {

    let statusEl, textEl;

    // overall AQI has different ID pattern
    if (type === 'aqi') {
        statusEl = document.getElementById('overallAqiStatus');
        textEl = document.getElementById('overallAqiText');
    } else {
        statusEl = document.getElementById(type + 'Status');
        textEl = document.getElementById(type + 'Text');
    }

    // 🔒 SAFETY GUARD (CRITICAL)
    if (!statusEl || !textEl) return;

    let className, text, statusText;

    switch (type) {
        case 'pm25':
            if (value <= 30) {
                className = 'aqi-good'; text = 'Good'; statusText = 'Excellent';
            } else if (value <= 37) {
                className = 'aqi-moderate'; text = 'Average'; statusText = 'Acceptable';
            } else {
                className = 'aqi-poor'; text = 'Bad'; statusText = 'Unhealthy';
            }
            break;

        case 'co2':
            if (value <= 400) { className = 'aqi-good'; text = 'Good'; statusText = 'Fresh Air'; }
            else if (value <= 1000) { className = 'aqi-moderate'; text = 'Moderate'; statusText = 'Normal'; }
            else { className = 'aqi-poor'; text = 'Poor'; statusText = 'High'; }
            break;
        case 'co':
            if (value <= 2) {
                className = 'aqi-good'; text = 'Good'; statusText = 'Safe';
            } else if (value <= 9) {
                className = 'aqi-moderate'; text = 'Average'; statusText = 'Caution';
            } else {
                className = 'aqi-poor'; text = 'Bad'; statusText = 'Dangerous';
            }
            break;

        case 'temp':
            if (value <= 35) {
                className = 'aqi-good'; text = 'Good'; statusText = 'Comfortable';
            } else if (value <= 40) {
                className = 'aqi-moderate'; text = 'Average'; statusText = 'Warm';
            } else {
                className = 'aqi-poor'; text = 'Bad'; statusText = 'Too Hot';
            }
            break;

        case 'hum':
            if (value <= 60) {
                className = 'aqi-good'; text = 'Good'; statusText = 'Comfortable';
            } else if (value <= 70) {
                className = 'aqi-moderate'; text = 'Average'; statusText = 'Slightly Humid';
            } else {
                className = 'aqi-poor'; text = 'Bad'; statusText = 'Uncomfortable';
            }
            break;

        case 'aqi':
            if (value <= 50) { className = 'aqi-good'; text = 'Good'; statusText = 'Excellent'; }
            else if (value <= 100) { className = 'aqi-moderate'; text = 'Moderate'; statusText = 'Acceptable'; }
            else { className = 'aqi-poor'; text = 'Poor'; statusText = 'Unhealthy'; }
            break;
    }

    statusEl.className = `aqi-indicator ${className}`;
    statusEl.textContent = text;
    textEl.textContent = statusText;

}

function calculateOverallAQI(data) {
    const pm25Aqi = data.pm25 || 0;
    const co2Aqi = (data.co2 / 10) || 0;
    const coAqi = data.co * 5 || 0;
    return Math.max(pm25Aqi, co2Aqi, coAqi);
}

function updateLocationData(locationId, data) {
    if (locationId === 'canteen') {
        document.getElementById('canteenPm25').textContent = `${data.pm25?.toFixed(1) || '--'} μg/m³`;
        document.getElementById('canteenCo2').textContent = `${data.co2?.toFixed(0) || '--'} ppm`;
        document.getElementById('canteenCo').textContent = `${data.co?.toFixed(0) || '--'} ppm`;
        document.getElementById('canteenTemp').textContent = `${data.temperature?.toFixed(1) || '--'} °C`;
        document.getElementById('canteenHum').textContent = `${data.humidity?.toFixed(1) || '--'} %`;
        document.getElementById('canteenAqi').textContent = `${data.aqi?.toFixed(0) || '--'}`;
    } else if (locationId === 'library') {
        document.getElementById('libraryPm25').textContent = `${data.pm25?.toFixed(1) || '--'} μg/m³`;
        document.getElementById('libraryCo2').textContent = `${data.co2?.toFixed(0) || '--'} ppm`;
        document.getElementById('libraryCo').textContent = `${data.co?.toFixed(0) || '--'} ppm`;
        document.getElementById('libraryTemp').textContent = `${data.temperature?.toFixed(1) || '--'} °C`;
        document.getElementById('libraryHum').textContent = `${data.humidity?.toFixed(1) || '--'} %`;
        document.getElementById('libraryAqi').textContent = `${data.aqi?.toFixed(0) || '--'}`;
    }
}

function updateRawData(message) {
    const rawDataDiv = document.getElementById('rawData');
    rawDataDiv.innerHTML += message + '\n';
    rawDataDiv.scrollTop = rawDataDiv.scrollHeight;
}

function initializeMap() {
    liveMap = L.map('liveMap').setView([9.2118, 76.6422], 18);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(liveMap);

    updateMapMarkers();

    // 11. Heatmap (Mock)
    if (L.heatLayer) {
        const heatPoints = AeroCampus.getHeatmapPoints();
        L.heatLayer(heatPoints, { radius: 25 }).addTo(liveMap);
    }
}

let mapMarkers = {};
function updateMapMarkers(latestData = {}) {
    // 19. Peak Pollution Logic (Mock forecast)
    const today = new Date().getDay();
    // Using simplified forecast
    const forecast = AeroCampus.getPredictedPollutionBySchedule(today, new Date().toLocaleTimeString());

    // Update UI for forecast if element exists (implementation pending in HTML)
    // ...

    const markers = [
        { name: 'Canteen', lat: 9.211881385210457, lon: 76.64215282012833, value: latestData.aqi || 45 },
        { name: 'Library', lat: 9.211669160050889, lon: 76.64223541613268, value: latestData.aqi || 68 }
    ];

    markers.forEach(m => {
        let color;
        if (m.value <= 50) color = '#22c55e';
        else if (m.value <= 100) color = '#f59e0b';
        else color = '#ef4444';

        const markerHtmlStyles = `
      background-color: ${color};
      width: 35px;
      height: 35px;
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 50%;
      color: white;
      font-weight: bold;
      border: 4px solid ${document.body.hasAttribute('data-theme') ? '#1e293b' : 'white'};
      box-shadow: 0 0 10px rgba(0,0,0,0.6);
    `;

        const customIcon = L.divIcon({
            className: "custom-div-icon",
            html: `<div style="${markerHtmlStyles}">${m.value}</div>`,
            iconSize: [35, 45],
            iconAnchor: [17.5, 22.5]
        });

        if (mapMarkers[m.name]) {
            mapMarkers[m.name].setIcon(customIcon);
            mapMarkers[m.name].getPopup().setContent(`<b>${m.name}</b><br>AQI: ${m.value}`);
        } else {
            const marker = L.marker([m.lat, m.lon], { icon: customIcon })
                .bindPopup(`<b>${m.name}</b><br>AQI: ${m.value}`);
            marker.addTo(liveMap);
            mapMarkers[m.name] = marker;
        }
    });
}

function getPastHourLabels(count) {
    const labels = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60000);
        labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    return labels;
}

function initializeChart() {
    const isDark = document.body.hasAttribute('data-theme');
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    /* ===== AIR QUALITY TRENDS (PM2.5, CO2, CO) ===== */
    trendsChart = new Chart(document.getElementById('trendsChart'), {
        type: 'line',
        data: {
            labels: [], // REAL timestamps only
            datasets: [
                {
                    label: 'PM2.5 (μg/m³)',
                    data: [],
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'CO2 (ppm)',
                    data: [],
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'CO (ppm)',
                    data: [],
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }
            },
            plugins: { legend: { labels: { color: textColor } } }
        }
    });

    /* ===== POLLUTANT LEVELS (TEMP, HUMIDITY) ===== */
    pollutantChart = new Chart(document.getElementById('pollutantChart'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: [],
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Humidity (%)',
                    data: [],
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    position: 'left',
                    title: { display: true, text: 'Temperature (°C)', color: textColor },
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                },
                y1: {
                    position: 'right',
                    title: { display: true, text: 'Humidity (%)', color: textColor },
                    ticks: { color: textColor },
                    grid: { drawOnChartArea: false }
                },
                x: { ticks: { color: textColor }, grid: { color: gridColor } }
            },
            plugins: { legend: { labels: { color: textColor } } }
        }
    });
}

function updateChart(data) {
    const timestamp = new Date().toLocaleTimeString();

    /* PUSH REAL DATA */
    dataHistory.timestamps.push(timestamp);
    dataHistory.pm25.push(data.pm25 ?? null);
    dataHistory.co2.push(data.co2 ?? null);
    dataHistory.co.push(data.co ?? null);
    dataHistory.temperature.push(data.temperature ?? null);
    dataHistory.humidity.push(data.humidity ?? null);

    /* KEEP LAST 24 HOURS (1440 points @ 1/min) */
    if (dataHistory.timestamps.length > MAX_HISTORY) {
        Object.keys(dataHistory).forEach(key => dataHistory[key].shift());
    }

    /* UPDATE TRENDS CHART */
    if (trendsChart) {
        trendsChart.data.labels = dataHistory.timestamps;
        trendsChart.data.datasets[0].data = dataHistory.pm25;
        trendsChart.data.datasets[1].data = dataHistory.co2;
        trendsChart.data.datasets[2].data = dataHistory.co;
        trendsChart.update('none');
    }

    /* UPDATE POLLUTANT CHART */
    if (pollutantChart) {
        pollutantChart.data.labels = dataHistory.timestamps;
        pollutantChart.data.datasets[0].data = dataHistory.temperature;
        pollutantChart.data.datasets[1].data = dataHistory.humidity;
        pollutantChart.update('none');
    }
}


/* ===== CAMPUS STRUCTURE DATA ===== */
const campusData = {
    "Main Block": {
        "Ground Floor": {
            dept: "Biotechnology & Biochemical Engineering",
            rooms: ["A101", "A102", "A103", "A104", "A105", "A106", "A107", "A108"]
        },
        "First Floor": {
            dept: "Food Technology Engineering",
            rooms: ["A201", "A202", "A203", "A204", "A205", "A206", "A207", "A208"]
        },
        "Second Floor": {
            dept: "Electronics & Communication Engineering",
            rooms: ["A301", "A302", "A303", "A304", "A305", "A306", "A307", "A308"]
        }
    },

    "Civil Block": {
        "Ground Floor": {
            dept: "Civil Engineering",
            rooms: ["B101", "B102", "B103", "B104", "B105", "B106", "B107", "B108"]
        },
        "First Floor": {
            dept: "Civil Engineering",
            rooms: ["B201", "B202", "B203", "B204", "B205", "B206", "B207", "B208", "B209"]
        },
        "Second Floor": {
            dept: "Electronics & Computer Engineering",
            rooms: ["B301", "B302", "B303", "B304", "B305", "B306", "B307", "B308"]
        }
    },

    "CS Block": {
        "Ground Floor": {
            dept: "Computer Science & Engineering",
            rooms: ["C101", "C102", "C103", "C104", "C105", "C106", "C107", "C108"]
        },
        "First Floor": {
            dept: "Computer Science & Engineering",
            rooms: ["C201", "C202", "C203", "C204", "C205", "C206", "C207", "C208"]
        },
        "Second Floor": {
            dept: "AI & Machine Learning",
            rooms: ["C301", "C302", "C303", "C304", "C305", "C306", "C307", "C308"]
        }
    },

    "Mechanical Block": {
        "Ground Floor": {
            dept: "Mechanical Engineering",
            rooms: ["M101", "M102", "M103", "M104", "M105", "M106", "M107", "M108"]
        },
        "First Floor": {
            dept: "Mechanical Engineering",
            rooms: ["M201", "M202", "M203", "M204", "M205", "M206", "M207", "M208"]
        },
        "Second Floor": {
            dept: "Electrical & Electronics Engineering",
            rooms: ["M301", "M302", "M303", "M304", "M305", "M306", "M307", "M308"]
        }
    }
};

/* ===== DROPDOWN LOGIC ===== */
const blockSelect = document.getElementById("blockSelect");
const floorSelect = document.getElementById("floorSelect");
const roomSelect = document.getElementById("roomSelect");
const roomDisplay = document.getElementById("currentRoomDisplay");

/* Populate Blocks */
Object.keys(campusData).forEach(block => {
    const option = document.createElement("option");
    option.value = block;
    option.textContent = block;
    blockSelect.appendChild(option);
});

/* Block → Floor */
blockSelect.addEventListener("change", () => {
    floorSelect.innerHTML = '<option value="">-- Select Floor --</option>';
    roomSelect.innerHTML = '<option value="">-- Select Room --</option>';
    floorSelect.disabled = true;
    roomSelect.disabled = true;

    const block = blockSelect.value;
    if (!block) return;

    Object.keys(campusData[block]).forEach(floor => {
        const option = document.createElement("option");
        option.value = floor;
        option.textContent = `${floor} (${campusData[block][floor].dept})`;
        floorSelect.appendChild(option);
    });

    floorSelect.disabled = false;
});

/* Floor → Room */
floorSelect.addEventListener("change", () => {
    roomSelect.innerHTML = '<option value="">-- Select Room --</option>';
    roomSelect.disabled = true;

    const block = blockSelect.value;
    const floor = floorSelect.value;
    if (!block || !floor) return;

    campusData[block][floor].rooms.forEach(room => {
        const option = document.createElement("option");
        option.value = room;
        option.textContent = room;
        roomSelect.appendChild(option);
    });

    roomSelect.disabled = false;
});

/* Room Selection */
roomSelect.addEventListener("change", () => {
    if (roomSelect.value) {
        roomDisplay.textContent = `Room ${roomSelect.value}`;
    }
});


window.addEventListener('load', function () {
    initializeMap();
    initializeChart();
    connectMqtt();

    /* ===== PWA REGISTRATION ===== */
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.log('SW Registration Failed', err));
    }

    /* ===== UI EVENT LISTENERS ===== */
    // Login
    document.getElementById('loginBtn').addEventListener('click', () => {
        document.getElementById('loginModal').style.display = 'flex';
    });
    document.getElementById('closeLogin').addEventListener('click', () => {
        document.getElementById('loginModal').style.display = 'none';
    });

    // Language
    document.getElementById('langBtn').addEventListener('click', () => {
        const newLang = AeroAuth.language === 'en' ? 'ml' : 'en';
        AeroAuth.setLanguage(newLang);
    });

    // Chatbot
    document.getElementById('chatFab').addEventListener('click', () => {
        document.getElementById('chatModal').style.display = 'flex';
    });
    document.getElementById('closeChat').addEventListener('click', () => {
        document.getElementById('chatModal').style.display = 'none';
    });

    document.getElementById('sendChat').addEventListener('click', () => {
        const input = document.getElementById('chatInput');
        const history = document.getElementById('chatHistory');
        const question = input.value;
        if (!question) return;

        // User Msg
        history.innerHTML += `<div style="margin-bottom: 5px; text-align: right;"><strong>You:</strong> ${question}</div>`;

        // Bot Msg
        const answer = AeroAuth.askBot(question);
        history.innerHTML += `<div style="margin-bottom: 15px;"><strong>AeroBot:</strong> ${answer}</div>`;

        input.value = '';
        history.scrollTop = history.scrollHeight;
    });

    /* ===== REPLAY MODE ===== */
    document.getElementById('replayBtn').addEventListener('click', () => {
        if (dataHistory.timestamps.length === 0) { alert("No data to replay yet!"); return; }

        // Backup current data
        const backup = JSON.parse(JSON.stringify(dataHistory));

        // Reset Charts
        trendsChart.data.labels = [];
        trendsChart.data.datasets.forEach(d => d.data = []);
        trendsChart.update();

        let i = 0;
        const interval = setInterval(() => {
            if (i >= backup.timestamps.length) {
                clearInterval(interval);
                return;
            }

            trendsChart.data.labels.push(backup.timestamps[i]);
            trendsChart.data.datasets[0].data.push(backup.pm25[i]);
            trendsChart.data.datasets[1].data.push(backup.co2[i]);
            trendsChart.data.datasets[2].data.push(backup.co[i]);
            trendsChart.update('none');
            i++;
        }, 200); // 200ms per point
    });

    /* ===== COMPARE & ADMIN INIT ===== */
    // 12. Compare Two Classrooms
    const compareBtn = document.getElementById('compareBtn');
    if (compareBtn) {
        compareBtn.addEventListener('click', () => {
            const r1 = document.getElementById('compRoom1').value;
            const r2 = document.getElementById('compRoom2').value;
            const res = AeroCampus.compareRooms(r1, r2);

            const div = document.getElementById('compareResult');
            div.style.display = 'block';
            div.innerHTML = `
            <strong>${res.winner}</strong> has better air quality.<br>
            <small>
            ${r1}: ${res.r1.co2}ppm CO2, ${res.r1.pm25} µg/m³<br>
            ${r2}: ${res.r2.co2}ppm CO2, ${res.r2.pm25} µg/m³
            </small>
          `;
        });
    }


    // Init Admin Module
    if (window.AeroAdmin && AeroAdmin.init) {
        AeroAdmin.init();
    }

    // Initial UI Check
    AeroAuth.updateUIForRole();

    /* ===== SMART FEATURES LOGIC ===== */

    // 9. Exam Mode
    const examToggle = document.getElementById('examModeToggle');
    if (examToggle) {
        examToggle.addEventListener('change', (e) => {
            const isExam = e.target.checked;
            if (isExam && window.AeroAdmin) {
                AeroAdmin.setThreshold('co2', 800); // Stricter
                alert("[EXAM MODE] Activated: CO2 Threshold set to 800ppm (Strict)");
            } else if (window.AeroAdmin) {
                AeroAdmin.setThreshold('co2', 1000); // Normal
                alert("[EXAM MODE] Deactivated: CO2 Threshold restored to 1000ppm");
            }
        });
    }

    // 22. Research Mode Export
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            let csv = "Time,PM2.5,CO2,Temperature,Humidity\n";
            dataHistory.timestamps.forEach((t, i) => {
                csv += `${t},${dataHistory.pm25[i]},${dataHistory.co2[i]},${dataHistory.temperature[i]},${dataHistory.humidity[i]}\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AeroSense_Data_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
        });
    }

    // 25. Smart Fan Simulation (Loop update)
    // 25. Smart Fan Simulation (Loop update)
    setInterval(() => {
        // 14. Emergency CO Leak Protocol
        const coVal = parseFloat(document.getElementById('coValue').textContent) || 0;
        if (coVal > 50) {
            document.body.style.animation = "flashRed 1s infinite";
            // Add keyframe if not exists, or just red border
            document.body.style.border = "5px solid red";
            const status = document.getElementById('connectionStatus');
            if (status) status.textContent = "⚠️ EMERGENCY: HIGH CO LEVELS!";
        } else {
            document.body.style.animation = "none";
            document.body.style.border = "none";
        }

        // Fan Logic
        const co2Val = parseFloat(document.getElementById('co2Value').textContent) || 400;
        const fanStatus = document.getElementById('fanStatus');
        if (fanStatus) {
            if (co2Val > 800) {
                fanStatus.textContent = "ON (Auto)";
                fanStatus.style.background = "#dcfce7";
                fanStatus.style.color = "#166534";
            } else {
                fanStatus.textContent = "OFF";
                fanStatus.style.background = "#e0e7ff";
                fanStatus.style.color = "#4338ca";
            }
        }

        /* ===== RESEARCH MODULE UPDATES ===== */
        if (window.AeroResearch) {
            const pm25Val = parseFloat(document.getElementById('pm25Value').textContent) || 0;
            const aqiVal = parseFloat(document.getElementById('overallAqiStatus')?.previousElementSibling?.textContent) || 0;

            // 15. Compliance
            const compliance = AeroResearch.checkCompliance(pm25Val, co2Val);
            const complWho = document.getElementById('complWho');
            const complAshrae = document.getElementById('complAshrae');

            if (complWho) {
                complWho.textContent = compliance.compliant ? "Pass" : "Fail";
                complWho.style.color = compliance.compliant ? "green" : "red";
            }
            if (complAshrae) {
                complAshrae.textContent = co2Val < 1000 ? "Pass" : "Fail";
                complAshrae.style.color = co2Val < 1000 ? "green" : "red";
            }

            // 10. Academic Impact
            const impact = AeroResearch.getAcademicImpact(co2Val);
            const cogText = document.getElementById('cognitionText');
            const cogBar = document.getElementById('cognitionBar');
            const cogLoss = document.getElementById('cogLoss');

            if (cogText) cogText.textContent = `${impact.score} learning environment.`;
            if (cogBar) {
                cogBar.style.width = impact.score === "Optimal" ? "100%" : impact.score === "Good" ? "80%" : "40%";
                cogBar.style.background = impact.color;
            }
            if (cogLoss) cogLoss.textContent = impact.cognitiveLoss;

            // 4. Asthma Mode
            const asthmaToggle = document.getElementById('asthmaToggle');
            const asthmaText = document.getElementById('asthmaText');
            if (asthmaToggle && asthmaToggle.checked) {
                const advisory = AeroResearch.getHealthAdvisory(aqiVal, co2Val, true);
                if (asthmaText) asthmaText.textContent = advisory;
                if (advisory.includes("ALERT")) {
                    AeroResearch.sendPushNotification("Asthma Alert", "High pollution levels detected. Take precautions.");
                }
            } else if (asthmaText) {
                asthmaText.textContent = "Strict alerts for sensitive individuals.";
            }

            // 9. Tampering
            const currentData = { co2: co2Val, pm25: pm25Val };
            const tampering = AeroResearch.detectTampering(currentData);
            if (tampering) console.warn(tampering);
        }

    }, 5000);

    // 2. Long-Term Storage (Save every 1 min)
    setInterval(() => {
        if (window.AeroDB) {
            const data = {
                pm25: parseFloat(document.getElementById('pm25Value').textContent) || 0,
                co2: parseFloat(document.getElementById('co2Value').textContent) || 0,
                co: parseFloat(document.getElementById('coValue').textContent) || 0,
                temperature: parseFloat(document.getElementById('tempValue').textContent) || 0,
                humidity: parseFloat(document.getElementById('humValue').textContent) || 0
            };
            AeroDB.saveReading(data);
        }
    }, 60000);

    console.log("1048 Line Pure Code Dashboard - Updated with Smart Features");
});
