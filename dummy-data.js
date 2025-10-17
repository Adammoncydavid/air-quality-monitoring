// Generate random initial data for more variety
function getRandomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Dummy sensor data with more variation
const dummySensors = [
    {
        id: 1,
        name: "Central Park Sensor",
        lat: 40.785091,
        lng: -73.968285,
        aqi: getRandomInRange(20, 40),
        pm25: getRandomInRange(5, 15),
        pm10: getRandomInRange(10, 25),
        temperature: getRandomInRange(20, 24),
        humidity: getRandomInRange(55, 65),
        status: "good",
        lastUpdate: new Date().toISOString()
    },
    {
        id: 2,
        name: "Downtown Station", 
        lat: 40.7589,
        lng: -73.9851,
        aqi: getRandomInRange(60, 80),
        pm25: getRandomInRange(20, 35),
        pm10: getRandomInRange(35, 60),
        temperature: getRandomInRange(24, 28),
        humidity: getRandomInRange(50, 60),
        status: "moderate",
        lastUpdate: new Date().toISOString()
    },
    {
        id: 3,
        name: "Industrial Area",
        lat: 40.7282,
        lng: -74.0776,
        aqi: getRandomInRange(100, 150),
        pm25: getRandomInRange(40, 60),
        pm10: getRandomInRange(70, 100),
        temperature: getRandomInRange(22, 26),
        humidity: getRandomInRange(65, 75),
        status: "poor", 
        lastUpdate: new Date().toISOString()
    },
    {
        id: 4,
        name: "Residential Zone",
        lat: 40.7505,
        lng: -73.9934,
        aqi: getRandomInRange(45, 65),
        pm25: getRandomInRange(15, 25),
        pm10: getRandomInRange(25, 40),
        temperature: getRandomInRange(21, 25),
        humidity: getRandomInRange(55, 65),
        status: "moderate",
        lastUpdate: new Date().toISOString()
    }
];

// Initialize historical data
const historicalData = {
    labels: ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"],
    aqi: [65, 58, 72, 85, 92, 78, 65, 58],
    pm25: [22, 18, 25, 32, 38, 28, 22, 19],
    temperature: [20, 19, 21, 24, 26, 25, 23, 21],
    humidity: [70, 75, 68, 62, 58, 60, 65, 68]
};
