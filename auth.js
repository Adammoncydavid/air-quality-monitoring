/*
  AeroSense Auth & User Experience Module
  Handles Role-Based Login, Multi-language Support, and Chatbot.
*/

const AeroAuth = {
    currentUser: null,
    language: 'en',

    translations: {
        en: {
            title: "Air Quality Monitoring Dashboard",
            status: "Real-time Air Quality Monitoring System",
            login: "Login",
            logout: "Logout",
            connect: "Connecting...",
            connected: "Connected",
            pm25: "PM2.5",
            co2: "CO2",
            temp: "Temperature",
            hum: "Humidity",
            rank: "Dept. Rankings",
            chat: "Chat with AeroBot"
        },
        ml: {
            title: "വായു ഗുണനിലവാര നിരീക്ഷണ ഡാഷ്ബോർഡ്",
            status: "തത്സമയ വായു ഗുണനിലവാര സംവിധാനം",
            login: "ലോഗിൻ",
            logout: "ലോഗ് ഔട്ട്",
            connect: "ബന്ധിപ്പിക്കുന്നു...",
            connected: "ബന്ധിപ്പിച്ചു",
            pm25: "PM2.5",
            co2: "CO2",
            temp: "താപനില",
            hum: "അന്തരീക്ഷ ഈർപ്പം",
            rank: "വകുപ്പ് റാങ്കിംഗ്",
            chat: "AeroBot-നോട് സംസാരിക്കുക"
        }
    },

    /* 21. Role-Based Login */
    login: function (role) {
        this.currentUser = role; // 'admin', 'faculty', 'student'
        console.log(`Logged in as ${role}`);
        this.updateUIForRole();
        return true;
    },

    logout: function () {
        this.currentUser = null;
        console.log("Logged out");
        this.updateUIForRole();
    },

    updateUIForRole: function () {
        const adminPanels = document.querySelectorAll('.admin-only');
        const facultyPanels = document.querySelectorAll('.faculty-only');

        // Hide all first
        adminPanels.forEach(el => el.style.display = 'none');
        facultyPanels.forEach(el => el.style.display = 'none');

        if (this.currentUser === 'admin') {
            adminPanels.forEach(el => el.style.display = 'block');
            facultyPanels.forEach(el => el.style.display = 'block');
        } else if (this.currentUser === 'faculty') {
            facultyPanels.forEach(el => el.style.display = 'block');
        }
    },

    /* 23. Multi-language Support */
    setLanguage: function (lang) {
        if (!this.translations[lang]) return;
        this.language = lang;

        // Update simple text elements (naive implementation)
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (this.translations[lang][key]) {
                el.textContent = this.translations[lang][key];
            }
        });
    },

    /* 30. Chatbot Assistant (AeroBot) logic */
    askBot: function (query) {
        const q = query.toLowerCase();
        if (q.includes('co2') && q.includes('high')) return "High CO2 levels indicate poor ventilation. Open windows immediately.";
        if (q.includes('best air')) return "Currently, the Computer Science Block has the best air quality.";
        if (q.includes('health')) return "Air quality is currently safe for all students.";
        return "I am AeroBot. I can help you with air quality data. Ask me about CO2, temperature, or room rankings.";
    }
};

window.AeroAuth = AeroAuth;
