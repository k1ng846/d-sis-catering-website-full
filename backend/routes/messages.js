const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Send message to admin
router.post('/', [
  authenticateToken,
  body('subject').notEmpty().trim().escape(),
  body('messageContent').notEmpty().trim().escape()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { subject, messageContent } = req.body;
  const db = getDatabase();
  const messageId = `MSG-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

  db.run(
    `INSERT INTO admin_messages (message_id, user_id, subject, message_content)
     VALUES (?, ?, ?, ?)`,
    [messageId, req.user.id, subject, messageContent],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to send message' });
      }

      res.status(201).json({
        message: 'Message sent successfully',
        messageId: this.lastID
      });
    }
  );
});

// Get user's messages
router.get('/my-messages', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  db.all(
    `SELECT * FROM admin_messages 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`,
    [req.user.id, parseInt(limit), offset],
    (err, messages) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Get total count
      db.get(
        'SELECT COUNT(*) as total FROM admin_messages WHERE user_id = ?',
        [req.user.id],
        (err, countResult) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          res.json({
            messages,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: countResult.total,
              pages: Math.ceil(countResult.total / limit)
            }
          });
        }
      );
    }
  );
});

// Get single message
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const messageId = req.params.id;

  db.get(
    `SELECT * FROM admin_messages 
     WHERE id = ? AND user_id = ?`,
    [messageId, req.user.id],
    (err, message) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      res.json({ message });
    }
  );
});

// Admin: Get all messages
router.get('/admin/all', authenticateToken, requireAdmin, (req, res) => {
  const db = getDatabase();
  const { page = 1, limit = 10, status = '' } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT m.*, u.first_name, u.last_name, u.email
    FROM admin_messages m
    JOIN users u ON m.user_id = u.id
  `;
  const params = [];

  if (status) {
    query += ' WHERE m.message_status = ?';
    params.push(status);
  }

  query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  db.all(query, params, (err, messages) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM admin_messages m
      JOIN users u ON m.user_id = u.id
    `;
    const countParams = [];

    if (status) {
      countQuery += ' WHERE m.message_status = ?';
      countParams.push(status);
    }

    db.get(countQuery, countParams, (err, countResult) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          pages: Math.ceil(countResult.total / limit)
        }
      });
    });
  });
});

// Admin: Get single message
router.get('/admin/:id', authenticateToken, requireAdmin, (req, res) => {
  const db = getDatabase();
  const messageId = req.params.id;

  db.get(
    `SELECT m.*, u.first_name, u.last_name, u.email, u.phone_number
     FROM admin_messages m
     JOIN users u ON m.user_id = u.id
     WHERE m.id = ?`,
    [messageId],
    (err, message) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      res.json({ message });
    }
  );
});

// Admin: Respond to message
router.post('/admin/:id/respond', [
  authenticateToken,
  requireAdmin,
  body('adminResponse').notEmpty().trim().escape()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { adminResponse } = req.body;
  const messageId = req.params.id;
  const db = getDatabase();

  db.run(
    `UPDATE admin_messages 
     SET admin_response = ?, message_status = 'replied', updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [adminResponse, messageId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to respond to message' });
      }

      res.json({ message: 'Response sent successfully' });
    }
  );
});

// Admin: Update message status
router.patch('/admin/:id/status', [
  authenticateToken,
  requireAdmin,
  body('status').isIn(['unread', 'read', 'replied'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { status } = req.body;
  const messageId = req.params.id;
  const db = getDatabase();

  db.run(
    'UPDATE admin_messages SET message_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, messageId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to update message status' });
      }

      res.json({ message: 'Message status updated successfully' });
    }
  );
});

// Admin: Get message statistics
router.get('/admin/statistics', authenticateToken, requireAdmin, (req, res) => {
  const db = getDatabase();

  const queries = {
    totalMessages: 'SELECT COUNT(*) as count FROM admin_messages',
    unreadMessages: 'SELECT COUNT(*) as count FROM admin_messages WHERE message_status = "unread"',
    repliedMessages: 'SELECT COUNT(*) as count FROM admin_messages WHERE message_status = "replied"',
    recentMessages: `
      SELECT m.*, u.first_name, u.last_name, u.email
      FROM admin_messages m
      JOIN users u ON m.user_id = u.id
      ORDER BY m.created_at DESC
      LIMIT 5
    `
  };

  const results = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;

  Object.keys(queries).forEach(key => {
    db.all(queries[key], (err, rows) => {
      if (err) {
        console.error(`Error in query ${key}:`, err);
        results[key] = key.includes('recent') ? [] : 0;
      } else {
        if (key.includes('recent')) {
          results[key] = rows;
        } else {
          results[key] = rows[0].count || 0;
        }
      }

      completed++;
      if (completed === totalQueries) {
        res.json({
          statistics: {
            totalMessages: results.totalMessages,
            unreadMessages: results.unreadMessages,
            repliedMessages: results.repliedMessages
          },
          recentMessages: results.recentMessages
        });
      }
    });
  });
});

module.exports = router;