const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Generate JWT token
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    userType: user.userType,
    username: user.username
  };
  
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'dsis-catering',
    audience: 'dsis-users'
  });
}

// Verify JWT token middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({ error: 'Invalid token' });
      }
      return res.status(403).json({ error: 'Token verification failed' });
    }
    
    req.user = user;
    next();
  });
}

// Require admin role
function requireAdmin(req, res, next) {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Require customer or admin role
function requireCustomerOrAdmin(req, res, next) {
  if (!req.user || (req.user.userType !== 'customer' && req.user.userType !== 'admin')) {
    return res.status(403).json({ error: 'Customer or admin access required' });
  }
  next();
}

// Hash password
async function hashPassword(password) {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  return await bcrypt.hash(password, saltRounds);
}

// Verify password
async function verifyPassword(plainPassword, hashedPassword) {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

// Validate password strength
function validatePasswordStrength(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  
  if (!hasSpecial) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    strength: calculatePasswordStrength(password)
  };
}

function calculatePasswordStrength(password) {
  let score = 0;
  
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
  
  if (score < 3) return 'weak';
  if (score < 5) return 'medium';
  return 'strong';
}

module.exports = {
  generateToken,
  authenticateToken,
  requireAdmin,
  requireCustomerOrAdmin,
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  JWT_SECRET
};