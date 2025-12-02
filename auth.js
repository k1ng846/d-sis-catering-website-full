// Authentication System for d'sis Catering
class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        // Check if user is logged in on page load
        this.checkAuthStatus();

        // Add event listeners for login/logout after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
    }

    checkAuthStatus() {
        const userData = localStorage.getItem('dsis_user');
        if (userData) {
            this.currentUser = JSON.parse(userData);
            this.updateUIForLoggedInUser();
        } else {
            this.redirectToLogin();
        }
    }

    async login(email, password) {
        try {
            const response = await api.login(email, password);
            this.currentUser = response.user;
            api.setToken(response.token);
            if (response.token) {
                try {
                    localStorage.setItem('dsis_token', response.token);
                } catch (e) {
                    console.warn('Unable to persist token to localStorage:', e);
                }
            }
            localStorage.setItem('dsis_user', JSON.stringify(this.currentUser));
            this.updateUIForLoggedInUser();
            return true;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }

    async logout() {
        const confirmed = window.confirm('Are you sure you want to logout?');
        if (!confirmed) {
            return;
        }

        try {
            await api.logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
        this.currentUser = null;
        localStorage.removeItem('dsis_user');
        api.setToken(null);
        this.redirectToLogin();
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    redirectToLogin() {
        // Redirect to root login page from anywhere if not on login/signup
        const isLoginOrSignup = window.location.pathname.includes('login.html') ||
                                window.location.pathname.includes('signup.html');
        if (!isLoginOrSignup) {
            // If we are inside /admin/, go up one level to root login
            const inAdminPath = window.location.pathname.includes('/admin/');
            window.location.href = inAdminPath ? '../login.html' : 'login.html';
        }
    }

    updateUIForLoggedInUser() {
        // Update navigation to show user info and logout option
        const userIcon = document.querySelector('a[href="login.html"]');
        if (userIcon && this.currentUser) {
            const firstName = this.currentUser.firstName || this.currentUser.first_name || '';
            userIcon.innerHTML = `
                <i class="fas fa-user-circle" style="font-size: 24px;"></i>
                <span style="margin-left: 5px;">${firstName}</span>
            `;
            userIcon.onclick = (e) => {
                e.preventDefault();
                this.showUserMenu();
            };
        }
    }

    showUserMenu() {
        const menu = document.createElement('div');
        menu.className = 'user-menu';
        menu.style.cssText = `
            position: absolute;
            top: 60px;
            right: 20px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            min-width: 150px;
        `;
        
        const firstName = this.currentUser.firstName || this.currentUser.first_name || '';
        const lastName = this.currentUser.lastName || this.currentUser.last_name || '';
        const email = this.currentUser.email || '';
        const isAdmin = (this.currentUser.userType === 'admin') || (this.currentUser.user_type === 'admin');
        const profileLink = isAdmin ? 'admin/profile.html' : 'profile.html';
        
        menu.innerHTML = `
            <div style="padding: 10px; border-bottom: 1px solid #eee;">
                <strong style="color: #000;">${firstName} ${lastName}</strong><br>
                <small style="color: #000;">${email}</small>
            </div>
            <div style="padding: 5px 0;">
                <a href="${profileLink}" style="display: block; padding: 8px 15px; text-decoration: none; color: #000;">
                    <i class="fas fa-user-cog"></i> Profile Settings
                </a>
                <a href="#" onclick="auth.logout()" style="display: block; padding: 8px 15px; text-decoration: none; color: #000;">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </a>
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // Remove menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function removeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', removeMenu);
                }
            });
        }, 100);
    }

    // Handle login form submission
    async handleLogin(event) {
        event.preventDefault();
        const form = event.target;
        const email = form.querySelector('input[name="email"]').value;
        const password = form.querySelector('input[name="password"]').value;
        const remember = form.querySelector('input[name="remember"]')?.checked;
        
        try {
            const success = await this.login(email, password);
            if (success) {
                const isAdmin = (this.currentUser.userType === 'admin') || (this.currentUser.user_type === 'admin');
                const inAdminPath = window.location.pathname.includes('/admin/');
                if (isAdmin) {
                    window.location.href = inAdminPath ? 'dashboard.html' : 'admin/dashboard.html';
                } else {
                    window.location.href = inAdminPath ? '../main.html' : 'main.html';
                }
            } else {
                alert('Invalid email or password. Please try again.');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('An error occurred during login. Please try again.');
        }
        return false;
    }

    setupEventListeners() {
        // Login form submission is now handled by the handleLogin method
        // which is directly attached to the form's onsubmit event
    }

    getUsers() {
        // Mock user database - in real app, this would be fetched from server
        return [
            {
                id: 1,
                email: 'admin@dsis.com',
                password: 'admin123',
                firstName: 'Admin',
                lastName: 'User',
                userType: 'admin'
            },
            {
                id: 2,
                email: 'customer@test.com',
                password: 'customer123',
                firstName: 'John',
                lastName: 'Doe',
                userType: 'customer'
            }
        ];
    }
}

// Initialize authentication system
const auth = new AuthSystem();

// Export for use in other scripts
window.auth = auth;
