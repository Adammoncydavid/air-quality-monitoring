// Dummy sensor data
const dummySensors = [
    {
        id: 1,
        name: "Central Park Sensor",
        lat: 40.785091,
        lng: -73.968285,
        aqi: 35,
        pm25: 8,
        pm10: 15,
        temperature: 22,
        humidity: 60,
        status: "good",
        lastUpdate: "2024-01-15T10:30:00Z"
    },
    {
        id: 2,
        name: "Downtown Station",
        lat: 40.7589,
        lng: -73.9851,
        aqi: 68,
        pm25: 25,
        pm10: 45,
        temperature: 26,
        humidity: 55,
        status: "moderate",
        lastUpdate: "2024-01-15T10:28:00Z"
    },
    {
        id: 3,
        name: "Industrial Area",
        lat: 40.7282,
        lng: -74.0776,
        aqi: 120,
        pm25: 45,
        pm10: 80,
        temperature: 24,
        humidity: 70,
        status: "poor",
        lastUpdate: "2024-01-15T10:25:00Z"
    },
    {
        id: 4,
        name: "Residential Zone",
        lat: 40.7505,
        lng: -73.9934,
        aqi: 52,
        pm25: 18,
        pm10: 32,
        temperature: 23,
        humidity: 58,
        status: "moderate",
        lastUpdate: "2024-01-15T10:32:00Z"
    }
];

// Historical data for charts
const historicalData = {
    labels: ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"],
    aqi: [65, 58, 72, 85, 92, 78, 65, 58],
    pm25: [22, 18, 25, 32, 38, 28, 22, 19],
    temperature: [20, 19, 21, 24, 26, 25, 23, 21],
    humidity: [70, 75, 68, 62, 58, 60, 65, 68]
};