/* 
  AeroSense Database Module (IndexedDB)
  Handles long-term storage of sensor data locally in the browser.
  Persists data across reloads and device restarts.
*/

const AeroDB = {
    dbName: 'AeroSenseDB',
    dbVersion: 1,
    db: null,

    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error("Database error: " + event.target.errorCode);
                reject(event.target.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Create an object store for sensor readings
                // Keypath is timestamp (unique)
                if (!db.objectStoreNames.contains('readings')) {
                    const objectStore = db.createObjectStore('readings', { keyPath: 'timestamp' });
                    objectStore.createIndex('date', 'date', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("AeroSense Local DB Initialized");
                resolve(this.db);
            };
        });
    },

    saveReading: function(data) {
        if(!this.db) return;
        
        const reading = {
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString(),
            pm25: data.pm25,
            co2: data.co2,
            co: data.co,
            temp: data.temperature,
            hum: data.humidity
        };

        const transaction = this.db.transaction(['readings'], 'readwrite');
        const store = transaction.objectStore('readings');
        store.add(reading);
    },

    getHistory: function(days = 30) {
        return new Promise((resolve, reject) => {
            if(!this.db) { resolve([]); return; }

            const transaction = this.db.transaction(['readings'], 'readonly');
            const store = transaction.objectStore('readings');
            const request = store.getAll();

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    },

    // 22. Research Mode Export (Enhanced)
    exportCSV: async function() {
        const data = await this.getHistory(); // Get ALL history
        if(data.length === 0) { alert("No history to export."); return; }

        let csv = "Timestamp,Date,PM2.5,CO2,CO,Temp,Humidity\n";
        data.forEach(row => {
            csv += `${row.timestamp},${row.date},${row.pm25},${row.co2},${row.co},${row.temp},${row.hum}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AeroSense_Full_History_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
    }
};

// Auto-init
window.addEventListener('load', () => AeroDB.init());
