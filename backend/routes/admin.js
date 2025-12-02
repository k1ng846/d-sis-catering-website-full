const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/dashboard', authenticateToken, requireAdmin, (req, res) => {
  const db = getDatabase();

  // Get all statistics in parallel
  const queries = {
    totalUsers: 'SELECT COUNT(*) as count FROM users WHERE is_active = 1',
    totalBookings: 'SELECT COUNT(*) as count FROM bookings',
    totalRevenue: 'SELECT COALESCE(SUM(total_amount), 0) as total FROM receipts WHERE payment_status = "paid"',
    pendingBookings: 'SELECT COUNT(*) as count FROM bookings WHERE booking_status = "pending"',
    totalMenuItems: 'SELECT COUNT(*) as count FROM menu_items',
    availableMenuItems: 'SELECT COUNT(*) as count FROM menu_items WHERE is_available = 1',
    recentBookings: `
      SELECT b.*, u.first_name, u.last_name, u.email
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
      LIMIT 10
    `,
    monthlyRevenue: `
      SELECT 
        strftime('%Y-%m', created_at) as month,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM receipts 
      WHERE payment_status = 'paid' 
        AND created_at >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month DESC
    `
  };

  const results = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;

  Object.keys(queries).forEach(key => {
    db.all(queries[key], (err, rows) => {
      if (err) {
        console.error(`Error in query ${key}:`, err);
        results[key] = key.includes('recent') || key.includes('monthly') ? [] : 0;
      } else {
        if (key.includes('recent') || key.includes('monthly')) {
          results[key] = rows;
        } else {
          results[key] = rows[0].count || rows[0].total || 0;
        }
      }

      completed++;
      if (completed === totalQueries) {
        res.json({
          statistics: {
            totalUsers: results.totalUsers,
            totalBookings: results.totalBookings,
            totalRevenue: results.totalRevenue,
            pendingBookings: results.pendingBookings,
            totalMenuItems: results.totalMenuItems,
            availableMenuItems: results.availableMenuItems
          },
          recentBookings: results.recentBookings,
          monthlyRevenue: results.monthlyRevenue
        });
      }
    });
  });
});

// Get all users
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  const db = getDatabase();
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT id, username, email, first_name, last_name, phone_number, user_type, is_active, created_at
    FROM users
  `;
  const params = [];

  if (search) {
    query += ' WHERE (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR username LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  db.all(query, params, (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    const countParams = [];
    
    if (search) {
      countQuery += ' WHERE (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR username LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    db.get(countQuery, countParams, (err, countResult) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        users,
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

// Update user status
router.patch('/users/:id/status', [
  authenticateToken,
  requireAdmin,
  body('isActive').isBoolean()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { isActive } = req.body;
  const userId = req.params.id;
  const db = getDatabase();

  db.run(
    'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [isActive ? 1 : 0, userId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to update user status' });
      }

      res.json({ message: 'User status updated successfully' });
    }
  );
});

// Get all bookings with filters
router.get('/bookings', authenticateToken, requireAdmin, (req, res) => {
  const db = getDatabase();
  const { 
    page = 1, 
    limit = 10, 
    status = '', 
    eventType = '', 
    dateFrom = '', 
    dateTo = '' 
  } = req.query;
  
  const offset = (page - 1) * limit;

  let query = `
    SELECT b.*, u.first_name, u.last_name, u.email, u.phone_number
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND b.booking_status = ?';
    params.push(status);
  }

  if (eventType) {
    query += ' AND b.event_type LIKE ?';
    params.push(`%${eventType}%`);
  }

  if (dateFrom) {
    query += ' AND b.event_date >= ?';
    params.push(dateFrom);
  }

  if (dateTo) {
    query += ' AND b.event_date <= ?';
    params.push(dateTo);
  }

  query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  db.all(query, params, (err, bookings) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Get total count with same filters
    let countQuery = `
      SELECT COUNT(*) as total
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;
    const countParams = params.slice(0, -2); // Remove limit and offset

    if (status) {
      countQuery += ' AND b.booking_status = ?';
    }
    if (eventType) {
      countQuery += ' AND b.event_type LIKE ?';
    }
    if (dateFrom) {
      countQuery += ' AND b.event_date >= ?';
    }
    if (dateTo) {
      countQuery += ' AND b.event_date <= ?';
    }

    db.get(countQuery, countParams, (err, countResult) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        bookings,
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

// Get booking details with items
router.get('/bookings/:id', authenticateToken, requireAdmin, (req, res) => {
  const db = getDatabase();
  const bookingId = req.params.id;

  db.get(
    `SELECT b.*, u.first_name, u.last_name, u.email, u.phone_number
     FROM bookings b
     JOIN users u ON b.user_id = u.id
     WHERE b.id = ?`,
    [bookingId],
    (err, booking) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Get booking items
      db.all(
        `SELECT bi.*, mi.item_name, mi.description, mi.category
         FROM booking_items bi
         JOIN menu_items mi ON bi.item_id = mi.id
         WHERE bi.booking_id = ?`,
        [bookingId],
        (err, items) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          res.json({
            booking: {
              ...booking,
              items
            }
          });
        }
      );
    }
  );
});

// Update booking status
router.patch('/bookings/:id/status', [
  authenticateToken,
  requireAdmin,
  body('status').isIn(['pending', 'confirmed', 'cancelled', 'completed'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { status } = req.body;
  const bookingId = req.params.id;
  const db = getDatabase();

  db.run(
    'UPDATE bookings SET booking_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, bookingId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to update booking status' });
      }

      res.json({ message: 'Booking status updated successfully' });
    }
  );
});

// Get revenue analytics
router.get('/analytics/revenue', authenticateToken, requireAdmin, (req, res) => {
  const db = getDatabase();
  const { period = 'month' } = req.query;

  let dateFormat, groupBy;
  switch (period) {
    case 'day':
      dateFormat = '%Y-%m-%d';
      groupBy = 'DATE(created_at)';
      break;
    case 'week':
      dateFormat = '%Y-%W';
      groupBy = 'strftime("%Y-%W", created_at)';
      break;
    case 'year':
      dateFormat = '%Y';
      groupBy = 'strftime("%Y", created_at)';
      break;
    default: // month
      dateFormat = '%Y-%m';
      groupBy = 'strftime("%Y-%m", created_at)';
  }

  const query = `
    SELECT 
      ${groupBy} as period,
      COUNT(*) as total_receipts,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_revenue,
      COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN total_amount ELSE 0 END), 0) as pending_revenue,
      COALESCE(SUM(total_amount), 0) as total_revenue
    FROM receipts 
    WHERE created_at >= date('now', '-12 months')
    GROUP BY ${groupBy}
    ORDER BY period DESC
  `;

  db.all(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ analytics: results });
  });
});

module.exports = router;