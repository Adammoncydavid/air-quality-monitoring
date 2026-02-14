/*
  AeroSense Maintenance & Reporting Module
  Handles Reports, Logs, Sensor Health, and System Settings.
*/

const AeroAdmin = {

    /* 8. Weekly / Monthly Air Report Generator */
    generateReport: function (type) {
        // Mock PDF generation trigger
        alert(`Generating ${type} Report... Download will start shortly.`);
        console.log(`[Report] Generated ${type} report for ${new Date().toLocaleDateString()}`);

        // In a real app, this would use jspdf to create a PDF
        // doc.text("Air Quality Report", 10, 10);
        // doc.save("report.pdf");

        // 29. Secure Audit Log
        this.logAction("Admin", `Generated ${type} Report`);
    },

    /* 9. Smart Alert Escalation System (Mock) */
    checkAlertEscalation: function (aqi) {
        if (aqi > 300) return "Level 3: Notify Campus Maintenance 🚨";
        if (aqi > 200) return "Level 2: Notify Admin ⚠️";
        if (aqi > 150) return "Level 1: Notify Class Representative 📢";
        return "Normal";
    },



    /* 16. Health Risk Indicator */
    getHealthRisk: function (aqi) {
        if (aqi > 200) return { level: "High", risk: "Asthma/Allergy Warning", color: "#ef4444" };
        if (aqi > 100) return { level: "Moderate", risk: "Sensitive Groups Warning", color: "#f59e0b" };
        return { level: "Low", risk: "Safe for All", color: "#10b981" };
    },

    /* 24. Custom AQI Threshold Settings */
    thresholds: { co2: 1000, pm25: 35 },

    setThreshold: function (type, value) {
        this.thresholds[type] = value;
        alert(`${type.toUpperCase()} threshold updated to ${value}`);
        this.logAction("Admin", `Updated ${type} threshold to ${value}`);
    },



    /* 29. Secure Audit Log */
    auditLogs: [
        { time: "10:00 AM", user: "Admin", action: "System Login" },
        { time: "11:30 AM", user: "Faculty", action: "Viewed Classroom Report" }
    ],

    logAction: function (user, action) {
        this.auditLogs.unshift({
            time: new Date().toLocaleTimeString(),
            user: user,
            action: action
        });
        this.updateAuditUI();
    },

    updateAuditUI: function () {
        const list = document.getElementById('auditLogList');
        if (list) {
            list.innerHTML = this.auditLogs.slice(0, 5).map(l =>
                `<li><small>${l.time}</small> <strong>${l.user}:</strong> ${l.action}</li>`
            ).join('');
        }
    },

    init: function () {
        this.updateAuditUI();
    }
};

window.AeroAdmin = AeroAdmin;
