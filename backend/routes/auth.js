const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getDatabase } = require('../database/init');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Login endpoint
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const db = getDatabase();

    // Find user by email
    db.get(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email],
      async (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate token
        const token = generateToken(user);

        // Return user data (without password)
        const { password_hash, ...userWithoutPassword } = user;
        res.json({
          message: 'Login successful',
          token,
          user: userWithoutPassword
        });
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register endpoint
router.post('/register', [
  body('username').isLength({ min: 3 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').isLength({ min: 2 }).trim().escape(),
  body('lastName').isLength({ min: 2 }).trim().escape(),
  body('phoneNumber').optional().isMobilePhone()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, firstName, lastName, phoneNumber } = req.body;
    const db = getDatabase();

    // Check if user already exists
    db.get(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username],
      async (err, existingUser) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (existingUser) {
          return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        db.run(
          `INSERT INTO users (username, email, password_hash, first_name, last_name, phone_number, user_type) 
           VALUES (?, ?, ?, ?, ?, ?, 'customer')`,
          [username, email, hashedPassword, firstName, lastName, phoneNumber],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to create user' });
            }

            // Get the created user
            db.get(
              'SELECT * FROM users WHERE id = ?',
              [this.lastID],
              (err, user) => {
                if (err) {
                  return res.status(500).json({ error: 'Database error' });
                }

                const token = generateToken(user);
                const { password_hash, ...userWithoutPassword } = user;
                
                res.status(201).json({
                  message: 'User created successfully',
                  token,
                  user: userWithoutPassword
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user info
router.get('/me', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.get(
    'SELECT id, username, email, first_name, last_name, phone_number, user_type, created_at FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    }
  );
});

// Logout endpoint (client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logout successful' });
});

// Update profile
router.put('/profile', [
  authenticateToken,
  body('firstName').optional().isLength({ min: 2 }).trim().escape(),
  body('lastName').optional().isLength({ min: 2 }).trim().escape(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phoneNumber').optional().trim().escape(),
  body('username').optional().isLength({ min: 3 }).trim().escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, phoneNumber, username } = req.body;
    const db = getDatabase();

    // Check if email is being changed and if it's already taken
    if (email) {
      db.get(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, req.user.id],
        (err, existingUser) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          if (existingUser) {
            return res.status(409).json({ error: 'Email already in use' });
          }

          // Check if username is being changed and if it's already taken
          if (username) {
            db.get(
              'SELECT id FROM users WHERE username = ? AND id != ?',
              [username, req.user.id],
              (err, existingUsername) => {
                if (err) {
                  return res.status(500).json({ error: 'Database error' });
                }

                if (existingUsername) {
                  return res.status(409).json({ error: 'Username already in use' });
                }

                updateProfile();
              }
            );
          } else {
            updateProfile();
          }
        }
      );
    } else if (username) {
      // Check if username is being changed and if it's already taken
      db.get(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, req.user.id],
        (err, existingUsername) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          if (existingUsername) {
            return res.status(409).json({ error: 'Username already in use' });
          }

          updateProfile();
        }
      );
    } else {
      updateProfile();
    }

    function updateProfile() {
      const updates = [];
      const values = [];

      if (firstName) {
        updates.push('first_name = ?');
        values.push(firstName);
      }
      if (lastName) {
        updates.push('last_name = ?');
        values.push(lastName);
      }
      if (email) {
        updates.push('email = ?');
        values.push(email);
      }
      if (phoneNumber !== undefined) {
        updates.push('phone_number = ?');
        values.push(phoneNumber);
      }
      if (username) {
        updates.push('username = ?');
        values.push(username);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(req.user.id);

      db.run(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values,
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to update profile' });
          }

          // Get updated user
          db.get(
            'SELECT id, username, email, first_name, last_name, phone_number, user_type, created_at FROM users WHERE id = ?',
            [req.user.id],
            (err, user) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }

              res.json({
                message: 'Profile updated successfully',
                user
              });
            }
          );
        }
      );
    }
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.post('/change-password', [
  authenticateToken,
  body('currentPassword').isLength({ min: 8 }),
  body('newPassword').isLength({ min: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const db = getDatabase();

    // Get current user with password
    db.get(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id],
      async (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        db.run(
          'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [hashedNewPassword, req.user.id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to update password' });
            }

            res.json({ message: 'Password updated successfully' });
          }
        );
      }
    );
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;