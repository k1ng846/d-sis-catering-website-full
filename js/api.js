// API Client for d'sis Catering Backend
class APIClient {
    constructor() {
        this.baseURL = CONFIG ? CONFIG.API_BASE_URL : 'http://localhost:3000/api';
        this.token = localStorage.getItem('dsis_token');
    }

    // Set authentication token
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('dsis_token', token);
        } else {
            localStorage.removeItem('dsis_token');
        }
    }

    // Get headers with auth token
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    // Make HTTP request
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options
        };

        try {
            if (window.Utils && CONFIG && CONFIG.DEBUG.LOG_API_CALLS) {
                Utils.logAPI(endpoint, options.method || 'GET', options.body ? JSON.parse(options.body) : null);
            }
            
            const response = await fetch(url, config);
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            const text = await response.text();
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                try {
                    data = text ? JSON.parse(text) : {};
                } catch (parseError) {
                    if (window.Utils) {
                        Utils.logError('JSON parse error', parseError);
                    } else {
                        console.error('JSON parse error:', parseError, 'Response text:', text);
                    }
                    throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
                }
            } else {
                data = { message: text };
            }

            if (!response.ok) {
                const error = new Error(data.error || data.message || `HTTP ${response.status}`);
                error.data = data;
                error.status = response.status;
                throw error;
            }

            return data;
        } catch (error) {
            if (window.Utils) {
                Utils.logError('API Request failed', error);
            } else {
                console.error('API Request failed:', error);
            }
            throw error;
        }
    }

    // Authentication endpoints
    async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async getCurrentUser() {
        return this.request('/auth/me');
    }

    async updateProfile(profileData) {
        // For simple backend, include current email from localStorage
        const userRaw = localStorage.getItem('dsis_user');
        if (userRaw) {
            try {
                const user = JSON.parse(userRaw);
                profileData.email = user.email; // Include current email for simple backend
            } catch (e) {
                console.warn('Could not parse user from localStorage');
            }
        }
        return this.request('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    async changePassword(currentPassword, newPassword) {
        // For simple backend, include email from localStorage
        const userRaw = localStorage.getItem('dsis_user');
        const passwordData = { currentPassword, newPassword };
        if (userRaw) {
            try {
                const user = JSON.parse(userRaw);
                passwordData.email = user.email; // Include email for simple backend
            } catch (e) {
                console.warn('Could not parse user from localStorage');
            }
        }
        return this.request('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify(passwordData)
        });
    }

    async logout() {
        const result = await this.request('/auth/logout', { method: 'POST' });
        this.setToken(null);
        return result;
    }

    async forgotPassword({ email, mobileNumber, newPassword }) {
        return this.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email, mobileNumber, newPassword })
        });
    }

    // Menu endpoints
    async getMenuItems(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/menu?${params}`);
    }

    async getMenuCategories() {
        return this.request('/menu/categories/list');
    }

    // Booking endpoints
    async createBooking(bookingData) {
        return this.request('/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });
    }

    async getBookings(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/bookings?${params}`);
    }

    async getBooking(id) {
        return this.request(`/bookings/${id}`);
    }

    async updateBookingStatus(id, status) {
        return this.request(`/bookings/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    }

    // Receipt endpoints
    async generateReceipt(bookingId, paymentData = {}) {
        return this.request('/receipts/generate', {
            method: 'POST',
            body: JSON.stringify({ bookingId, ...paymentData })
        });
    }

    // Admin endpoints
    async getAdminDashboard() {
        return this.request('/admin/dashboard');
    }

    // Messages endpoints (simple JSON-backed)
    async sendMessage({ subject, messageContent, userEmail, userName }) {
        // DB backend ignores userEmail/userName (uses token). Including for backward compatibility.
        return this.request('/messages', {
            method: 'POST',
            body: JSON.stringify({ subject, messageContent, userEmail, userName })
        });
    }

    async getMyMessages(email = null) {
        // If email provided, use simple backend format
        if (email) {
            const params = new URLSearchParams({ email });
            return this.request(`/messages/my?${params.toString()}`);
        }
        // Otherwise, use DB backend: token-based
        return this.request('/messages/my-messages');
    }

    async adminGetAllMessages() {
        return this.request('/messages/admin');
    }

    async adminRespondToMessage(id, adminResponse) {
        return this.request(`/messages/${id}/respond`, {
            method: 'POST',
            body: JSON.stringify({ adminResponse })
        });
    }

    async adminUpdateMessageStatus(id, status) {
        return this.request(`/messages/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    }
}

// Initialize API client
const api = new APIClient();

// Export for use in other scripts
window.api = api;
