// MQTT Configuration
const MQTT_CONFIG = {
    BROKER: "cd29a7c955164a079ab779cab2f382d7.s1.eu.hivemq.cloud",
    PORT: 8883,
    TOPIC: "esp32/sensor",
    USERNAME: "adam1234",
    PASSWORD: "Adam1234",
    CLIENT_ID: "web_client_" + Math.random().toString(16).substr(2, 8)
};

class MQTTClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.sensorData = {
            temperature: null,
            humidity: null,
            gas: null,
            timestamp: null
        };
        this.history = {
            temperature: [],
            humidity: [],
            gas: [],
            timestamps: []
        };
        this.maxHistoryLength = 30;
    }

    connect() {
        this.client = new Paho.MQTT.Client(
            MQTT_CONFIG.BROKER,
            MQTT_CONFIG.PORT,
            MQTT_CONFIG.CLIENT_ID
        );

        // Set callback handlers
        this.client.onConnectionLost = this.onConnectionLost.bind(this);
        this.client.onMessageArrived = this.onMessageArrived.bind(this);

        // Connect the client
        const connectOptions = {
            useSSL: true,
            userName: MQTT_CONFIG.USERNAME,
            password: MQTT_CONFIG.PASSWORD,
            onSuccess: this.onConnect.bind(this),
            onFailure: this.onConnectFailure.bind(this),
            timeout: 3,
            keepAliveInterval: 60,
            cleanSession: true
        };

        console.log("Connecting to MQTT broker...");
        this.client.connect(connectOptions);
    }

    onConnect() {
        console.log("Connected to MQTT broker");
        this.isConnected = true;
        this.updateConnectionStatus(true);
        
        // Subscribe to the topic
        this.client.subscribe(MQTT_CONFIG.TOPIC);
        console.log(`Subscribed to topic: ${MQTT_CONFIG.TOPIC}`);
    }

    onConnectFailure(response) {
        console.error("Failed to connect to MQTT broker:", response.errorMessage);
        this.isConnected = false;
        this.updateConnectionStatus(false);
        
        // Try to reconnect after 5 seconds
        setTimeout(() => {
            console.log("Attempting to reconnect...");
            this.connect();
        }, 5000);
    }

    onConnectionLost(response) {
        console.log("Connection lost:", response.errorMessage);
        this.isConnected = false;
        this.updateConnectionStatus(false);
        
        // Attempt reconnect
        setTimeout(() => {
            console.log("Attempting to reconnect...");
            this.connect();
        }, 3000);
    }

    onMessageArrived(message) {
        try {
            console.log("Message received:", message.payloadString);
            const data = JSON.parse(message.payloadString);
            this.processSensorData(data);
        } catch (error) {
            console.error("Error parsing MQTT message:", error);
            this.displayRawData(message.payloadString);
        }
    }

    processSensorData(data) {
        const timestamp = new Date().toLocaleTimeString();
        
        // Update current readings
        this.sensorData = {
            temperature: data.temperature !== undefined ? data.temperature : data.temp,
            humidity: data.humidity !== undefined ? data.humidity : data.hum,
            gas: data.gas !== undefined ? data.gas : data.gasLevel,
            timestamp: timestamp
        };

        // Add to history
        this.addToHistory(this.sensorData);

        // Update UI
        this.updateUI();
        this.displayRawData(JSON.stringify(data, null, 2));
        
        // Update charts if they exist
        if (window.realtimeChart) {
            this.updateCharts();
        }
    }

    addToHistory(data) {
        this.history.temperature.push(data.temperature);
        this.history.humidity.push(data.humidity);
        this.history.gas.push(data.gas);
        this.history.timestamps.push(data.timestamp);

        // Keep history length limited
        if (this.history.temperature.length > this.maxHistoryLength) {
            this.history.temperature.shift();
            this.history.humidity.shift();
            this.history.gas.shift();
            this.history.timestamps.shift();
        }
    }

    updateUI() {
        // Update main cards
        this.updateCard('tempValue', `${this.sensorData.temperature !== null ? this.sensorData.temperature.toFixed(1) : '--'} °C`);
        this.updateCard('humidityValue', `${this.sensorData.humidity !== null ? this.sensorData.humidity.toFixed(1) : '--'} %`);
        this.updateCard('gasValue', `${this.sensorData.gas !== null ? this.sensorData.gas.toFixed(1) : '--'} ppm`);
        this.updateCard('systemStatus', 'Online', 'status-good');

        // Update status texts
        this.updateStatus('tempStatus', this.sensorData.temperature, 'Temperature');
        this.updateStatus('humidityStatus', this.sensorData.humidity, 'Humidity');
        this.updateStatus('gasStatus', this.sensorData.gas, 'Gas');

        // Update gauges
        this.updateGauge('tempGauge', this.sensorData.temperature, 0, 50, '°C');
        this.updateGauge('humidityGauge', this.sensorData.humidity, 0, 100, '%');
        this.updateGauge('gasGauge', this.sensorData.gas, 0, 1000, 'ppm');

        // Update details
        this.updateDetail('tempDetail', this.sensorData.temperature, '°C');
        this.updateDetail('humidityDetail', this.sensorData.humidity, '%');
        this.updateDetail('gasDetail', this.sensorData.gas, 'ppm');

        // Update last update time
        document.getElementById('lastUpdate').textContent = `Last update: ${this.sensorData.timestamp}`;
    }

    updateCard(elementId, value, statusClass = '') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
            if (statusClass) {
                element.className = `value ${statusClass}`;
            }
        }
    }

    updateStatus(elementId, value, type) {
        const element = document.getElementById(elementId);
        if (element && value !== null) {
            let status = 'Normal';
            let statusClass = 'status-good';

            if (type === 'Temperature') {
                if (value < 10) { status = 'Cold'; statusClass = 'status-moderate'; }
                else if (value > 30) { status = 'Hot'; statusClass = 'status-poor'; }
            } else if (type === 'Humidity') {
                if (value < 30) { status = 'Dry'; statusClass = 'status-moderate'; }
                else if (value > 70) { status = 'Humid'; statusClass = 'status-poor'; }
            } else if (type === 'Gas') {
                if (value > 300) { status = 'High'; statusClass = 'status-poor'; }
                else if (value > 150) { status = 'Moderate'; statusClass = 'status-moderate'; }
            }

            element.textContent = status;
            element.className = statusClass;
        }
    }

    updateGauge(gaugeId, value, min, max, unit) {
        const gauge = document.getElementById(gaugeId);
        if (gauge && value !== null) {
            const fill = gauge.querySelector('.gauge-fill');
            const valueSpan = gauge.querySelector('.gauge-value');
            
            const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
            fill.style.width = `${percentage}%`;
            valueSpan.textContent = `${value.toFixed(1)} ${unit}`;
        }
    }

    updateDetail(elementId, value, unit) {
        const element = document.getElementById(elementId);
        if (element && value !== null) {
            element.textContent = `${value.toFixed(1)}${unit}`;
        }
    }

    updateCharts() {
        // This will be implemented in script.js
        if (window.updateRealtimeCharts) {
            window.updateRealtimeCharts(this.history);
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = connected ? '🟢 Connected' : '🔴 Disconnected';
            statusElement.className = connected ? 'connected' : 'disconnected';
        }
    }

    displayRawData(data) {
        const rawDataElement = document.getElementById('rawData');
        if (rawDataElement) {
            rawDataElement.textContent = data;
        }
    }
}

// Initialize MQTT client
const mqttClient = new MQTTClient();