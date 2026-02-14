/*
  AeroSense Campus & Location Module
  Handles Department Rankings, Heatmaps, Comparisons, and Timetables.
*/

const AeroCampus = {



    /* 6. Timetable-Based Air Prediction */
    // Mock timetable schedule
    getPredictedPollutionBySchedule: function (day, time) {
        // Return risk level based on typical student crowding
        const hour = parseInt(time.split(':')[0]);

        if (hour >= 11 && hour <= 12) return { level: "High", reason: "Lunch Break Rush" };
        if (hour >= 9 && hour <= 10) return { level: "Moderate", reason: "Morning Classes" };
        if (hour >= 15 && hour <= 16) return { level: "High", reason: "Pack-up Time" };
        return { level: "Low", reason: "Classes in Session" };
    },

    /* 11. Indoor Heatmap View (Mock logic for Leaflet) */
    // Returns weighted points for heatmap layer
    getHeatmapPoints: function () {
        return [
            [9.21188, 76.64215, 0.4], // Canteen (intensity 0-1)
            [9.21166, 76.64223, 0.7], // Library
            [9.21175, 76.64220, 0.2]  // Admin Block
        ];
    },

    /* 12. Compare Two Classrooms (Mock Comparator) */
    compareRooms: function (room1, room2) {
        // Generate mock stats for comparison
        const r1Stats = { pm25: 12, co2: 450, temp: 24 };
        const r2Stats = { pm25: 35, co2: 900, temp: 28 };

        return {
            r1: r1Stats,
            r2: r2Stats,
            winner: r1Stats.co2 < r2Stats.co2 ? room1 : room2
        };
    },

    /* 18. Block-wise AQI Average Card */
    getBlockAverage: function (blockName) {
        const averages = {
            "CS Block": 38,
            "Main Block": 52,
            "Civil Block": 55,
            "Mechanical Block": 68
        };
        return averages[blockName] || "--";
    }
};

window.AeroCampus = AeroCampus;
