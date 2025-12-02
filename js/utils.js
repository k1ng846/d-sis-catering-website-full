// Utility Functions for d'sis Catering
class Utils {
    // Logging utilities
    static log(message, data = null) {
        if (CONFIG.DEBUG.SHOW_CONSOLE_LOGS) {
            console.log(`[${CONFIG.APP_NAME}] ${message}`, data || '');
        }
    }

    static logError(message, error = null) {
        console.error(`[${CONFIG.APP_NAME}] ERROR: ${message}`, error || '');
    }

    static logAPI(endpoint, method = 'GET', data = null) {
        if (CONFIG.DEBUG.LOG_API_CALLS) {
            console.log(`[API] ${method} ${endpoint}`, data || '');
        }
    }

    // Date formatting utilities
    static formatDate(dateString) {
        if (!dateString) return 'No date set';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    static formatDateTime(dateTimeString) {
        if (!dateTimeString) return 'N/A';
        const date = new Date(dateTimeString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static formatDateShort(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    // Text utilities
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static truncateText(text, maxLength = 100) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // File utilities
    static fileToBase64(file) {
        return new Promise((resolve, reject) => {
            if (file.size > CONFIG.UI.MAX_FILE_SIZE) {
                reject(new Error(`File size too large. Maximum ${CONFIG.UI.MAX_FILE_SIZE / 1024 / 1024}MB allowed.`));
                return;
            }
            
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    static generateImageFileName(originalName) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = originalName.split('.').pop();
        return `offer-${timestamp}.${extension}`;
    }

    // Clipboard utilities
    static async copyToClipboard(text, element = null) {
        try {
            await navigator.clipboard.writeText(text);
            this.showCopyFeedback(element, 'Copied!');
            return true;
        } catch (err) {
            this.logError('Failed to copy to clipboard', err);
            // Fallback
            alert(`Copy this text: ${text}`);
            return false;
        }
    }

    static showCopyFeedback(element, message = 'Copied!') {
        if (!element) return;
        
        const originalBg = element.style.background;
        element.style.background = CONFIG.COLORS.SUCCESS;
        element.style.border = `1px solid ${CONFIG.COLORS.SUCCESS}`;
        
        const feedback = document.createElement('div');
        feedback.style.cssText = `
            position: absolute; 
            background: ${CONFIG.COLORS.SUCCESS}; 
            color: white; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 0.8em; 
            z-index: 1000; 
            top: -30px; 
            left: 50%; 
            transform: translateX(-50%);
            pointer-events: none;
        `;
        feedback.textContent = message;
        
        element.style.position = 'relative';
        element.appendChild(feedback);
        
        setTimeout(() => {
            element.style.background = originalBg;
            element.style.border = 'none';
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 2000);
    }

    // Toast notifications
    static showToast(message, type = 'info', duration = CONFIG.UI.TOAST_DURATION) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getToastColor(type)};
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 300px;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Fade in
        setTimeout(() => toast.style.opacity = '1', 100);
        
        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    static getToastColor(type) {
        const colors = {
            success: CONFIG.COLORS.SUCCESS,
            error: CONFIG.COLORS.DANGER,
            warning: CONFIG.COLORS.WARNING,
            info: CONFIG.COLORS.INFO
        };
        return colors[type] || CONFIG.COLORS.INFO;
    }

    // Loading utilities
    static showLoading(container, message = 'Loading...') {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        if (!container) return;
        
        container.innerHTML = `
            <div class="loading text-center" style="padding: 40px; color: #666;">
                <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i>
                <div>${message}</div>
            </div>
        `;
    }

    static showError(container, message = 'An error occurred') {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        if (!container) return;
        
        container.innerHTML = `
            <div class="error text-center" style="padding: 40px; color: ${CONFIG.COLORS.DANGER};">
                <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
                <div>${message}</div>
            </div>
        `;
    }

    // Validation utilities
    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    static validatePhone(phone) {
        const re = /^[\+]?[1-9][\d]{0,15}$/;
        return re.test(phone.replace(/\s/g, ''));
    }

    static validateRequired(value) {
        return value && value.toString().trim().length > 0;
    }

    // Storage utilities
    static setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            this.logError('Failed to save to localStorage', e);
        }
    }

    static getStorage(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (e) {
            this.logError('Failed to read from localStorage', e);
            return defaultValue;
        }
    }

    static removeStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            this.logError('Failed to remove from localStorage', e);
        }
    }
}

// Export utilities
window.Utils = Utils;