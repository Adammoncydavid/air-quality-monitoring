/*
  AeroSense Intelligence Module
  Handles AI predictions, analytics, and smart recommendations.
*/

const AeroAnalysis = {

    /* 1. AI-Based AQI Prediction (Simple Linear Regression / Trend) */
    predictNextHourAQI: function (history) {
        if (history.length < 10) return "Insufficient Data";

        // Simple Linear Regression on last 10 points
        const n = 10;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = history.slice(-n);

        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Predict for next hour (approx 60 mins from now, so x = n + 60/interval)
        // Assuming 1 min interval, next hour is x = 9 + 60 = 69
        const prediction = slope * 69 + intercept;
        return Math.max(0, prediction).toFixed(0);
    },

    /* 2. Classroom Performance Index */
    // CO2 < 800: Optimal Learning (100%)
    // CO2 800-1200: Good (80%)
    // CO2 1200-1500: Drowsy (60%)
    // CO2 > 1500: Poor Concentration (40%)
    calculatePerformanceIndex: function (co2) {
        if (co2 <= 800) return { score: 100, label: "Optimal Learning Zone 🧠" };
        if (co2 <= 1200) return { score: 80, label: "Good Concentration 👍" };
        if (co2 <= 1500) return { score: 60, label: "Mild Drowsiness 😴" };
        return { score: 40, label: "Poor Focus - Ventilate! ⚠️" };
    },

    /* 3. Smart Ventilation Recommendations */
    getVentilationAdvice: function (co2, pm25, outdoorAqi = 50) {
        let advice = [];
        if (co2 > 1000) advice.push("Open windows to reduce CO2.");
        if (pm25 > 35) advice.push("Enable air purifier / filters.");

        // Logic: If outdoor is bad, don't open windows unless CO2 is critical
        if (outdoorAqi > 100 && co2 > 1000) {
            advice = ["CO2 High but Outdoor Air Poor. Use Mechanical Ventilation."];
        } else if (outdoorAqi > 150) {
            advice.push("Keep windows closed (Outdoor Pollution).");
        }

        if (advice.length === 0) advice.push("Air quality is good. Maintain current settings.");
        return advice;
    },

    /* 4. Occupancy Estimation (Simplified) */
    // Base CO2 ~ 400ppm. Each person adds ~400ppm in a closed small room (mock logic)
    estimateOccupancy: function (co2, baseCo2 = 400) {
        const diff = Math.max(0, co2 - baseCo2);
        // Rough heuristic: 1 person increases CO2 by X ppm depending on room volume
        // Let's assume approx 50-70 ppm per person for a standard classroom size estimate
        return Math.round(diff / 60);
    },

    /* 7. Thermal Comfort Index (Simplified PMV) */
    // 18-24°C & 40-60% Hum = Comfort
    calculateThermalComfort: function (temp, hum) {
        if (temp >= 20 && temp <= 26 && hum >= 30 && hum <= 60) return "Comfortable 😌";
        if (temp > 26 && hum > 60) return "Warm & Humid 🥵";
        if (temp > 26) return "Warm ☀️";
        if (temp < 20) return "Cool ❄️";
        if (hum > 70) return "Too Humid 💧";
        return "Slightly Uncomfortable 😐";
    },

    /* 10. Anomaly Detection */
    detectAnomalies: function (currentData, lastData) {
        const anomalies = [];
        if (!lastData) return anomalies;

        // Check for sudden spikes (> 20% jump in 1 min is suspicious)
        if (currentData.co2 > lastData.co2 * 1.2 && currentData.co2 > 600) anomalies.push("Sudden CO2 Spike");
        if (currentData.pm25 > lastData.pm25 * 1.5 && currentData.pm25 > 20) anomalies.push("Sudden PM2.5 Spike");

        // Check for sensor failure (0 or max values)
        if (currentData.co2 <= 0) anomalies.push("CO2 Sensor Error (0 ppm)");

        return anomalies;
    },

    /* 19. Peak Pollution Time Analytics */
    // In a real app, this would query a DB. Here we scan local history.
    findPeakPollutionTime: function (timestamps, values) {
        if (!values || values.length === 0) return "N/A";
        const maxVal = Math.max(...values);
        const index = values.indexOf(maxVal);
        return { time: timestamps[index] || "N/A", value: maxVal };
    },

    /* 20. Ventilation Efficiency Score */
    // Measures how fast CO2 drops when windows open (mock)
    calculateVentilationEfficiency: function (startCo2, endCo2, timeMins) {
        if (timeMins <= 0) return 0;
        const drop = startCo2 - endCo2;
        if (drop <= 0) return 0;
        // Arbitrary score: drop of 100ppm/min = 100% efficient
        const rate = drop / timeMins;
        return Math.min(100, (rate / 100) * 100).toFixed(1);
    },

    /* 28. Carbon Footprint Estimator */
    // HVAC usage related to poor ventilation
    estimateCarbonFootprint: function (hoursRunning, powerKw = 2.5) {
        const co2PerKwh = 0.85; // kg CO2 per kWh (approx grid avg)
        return (hoursRunning * powerKw * co2PerKwh).toFixed(2); // kg CO2
    }
};

// Expose to window
window.AeroAnalysis = AeroAnalysis;
