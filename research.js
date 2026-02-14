/*
  AeroSense Advanced Research Module
  Handles Compliance, Health Advisory, Tampering Detection, and Notification Logic.
*/

const AeroResearch = {

    // 15. Compliance Mode (WHO & ASHRAE Standards)
    checkCompliance: function (pm25, co2) {
        const standards = {
            who_pm25_24h: 15, // WHO 2021 Guideline for 24h PM2.5 mean
            ashrae_co2: 1000  // ASHRAE 62.1 recommendation
        };

        let status = { compliant: true, issues: [] };

        if (pm25 > standards.who_pm25_24h) {
            status.compliant = false;
            status.issues.push(`PM2.5 exceeds WHO Limit (${standards.who_pm25_24h}µg/m³)`);
        }
        if (co2 > standards.ashrae_co2) {
            status.compliant = false;
            status.issues.push(`CO2 exceeds ASHRAE Limit (${standards.ashrae_co2}ppm)`);
        }
        return status;
    },

    // 4. True Health-Based Advisory (Asthma/Sensitive Mode)
    getHealthAdvisory: function (aqi, co2, isSensitiveMode = false) {
        let advisory = "Air quality is satisfactory.";

        if (isSensitiveMode) {
            // Stricter logic for asthma/sensitive groups
            if (aqi > 50 || co2 > 800) return "⚠️ ASTHMA ALERT: Air quality may trigger symptoms. Keep inhaler ready.";
            return "✅ ASTHMA SAFE: Condition is optimal.";
        } else {
            // Standard logic
            if (aqi > 150) return "⛔ DANGER: Avoid prolonged exertion.";
            if (aqi > 100) return "⚠️ UNHEALTHY: Sensitive groups should reduce activity.";
        }
        return advisory;
    },

    // 9. Sensor Tampering Detection
    lastReading: null,
    stagnantCount: 0,

    detectTampering: function (currentData) {
        if (!this.lastReading) {
            this.lastReading = currentData;
            return false;
        }

        // Check 1: Sudden Clean Drop (Unplugged/Zeroed)
        if (this.lastReading.co2 > 450 && currentData.co2 === 0) {
            return "CRITICAL: Sensor Disconnected or Reading Zero!";
        }

        // Check 2: Stagnant Data (Frozen Sensor)
        if (currentData.co2 === this.lastReading.co2 && currentData.pm25 === this.lastReading.pm25) {
            this.stagnantCount++;
            if (this.stagnantCount > 10) { // ~10 minutes if called every minute
                return "WARNING: Sensor values unchanged for 10+ mins. Check connection.";
            }
        } else {
            this.stagnantCount = 0;
        }

        this.lastReading = currentData;
        return null; // No tampering
    },

    // 5. Push Notifications
    sendPushNotification: function (title, body) {
        if (!("Notification" in window)) return;

        if (Notification.permission === "granted") {
            new Notification(title, { body: body, icon: 'icon-192.png' });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    new Notification(title, { body: body, icon: 'icon-192.png' });
                }
            });
        }
    },

    // 10. Academic Impact Correlation (Mock)
    getAcademicImpact: function (co2) {
        // Based on Harvard PH study: Cognitive scores drop ~15% at 950ppm and ~50% at 1400ppm
        if (co2 < 600) return { score: "Optimal", cognitiveLoss: "0%", color: "green" };
        if (co2 < 1000) return { score: "Good", cognitiveLoss: "~5%", color: "orange" };
        if (co2 < 1400) return { score: "Impaired", cognitiveLoss: "~15%", color: "red" };
        return { score: "Critical", cognitiveLoss: ">50%", color: "darkred" };
    }
};

window.AeroResearch = AeroResearch;
