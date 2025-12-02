// Global Configuration for d'sis Catering
const CONFIG = {
    // API Configuration
    API_BASE_URL: 'http://localhost:3000/api',
    
    // Application Settings
    APP_NAME: "d'sis Catering",
    APP_DESCRIPTION: "Celebrating Life with Food",
    
    // Company Information
    COMPANY: {
        name: "d'sis Catering",
        address: "San Lorenzo, Mexico, Pampanga, San Fernando, Philippines",
        phone: "+63 908 342 2706",
        email: "dsis_catering28@yahoo.com"
    },
    
    // UI Settings
    UI: {
        TOAST_DURATION: 3000,
        REFRESH_INTERVAL: 60000, // 1 minute
        SCROLL_CONTAINER_HEIGHT: 500,
        MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    },
    
    // Theme Colors
    COLORS: {
        PRIMARY: '#1e3c72',
        SECONDARY: '#2a5298', 
        GOLD: '#d4af37',
        GOLD_DARKER: '#b8941f',
        SUCCESS: '#28a745',
        WARNING: '#ffc107',
        DANGER: '#dc3545',
        INFO: '#17a2b8'
    },
    
    // Debug Settings
    DEBUG: {
        ENABLED: false,
        LOG_API_CALLS: false,
        SHOW_CONSOLE_LOGS: false
    }
};

// Export configuration
window.CONFIG = CONFIG;