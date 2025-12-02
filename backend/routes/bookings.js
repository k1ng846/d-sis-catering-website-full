const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Helper function to read JSON files
function readJSONFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading JSON file:', error);
    return [];
  }
}

// Helper function to write JSON files
function writeJSONFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing JSON file:', error);
    return false;
  }
}

// Check availability for a specific date
router.get('/availability/:date', (req, res) => {
  const { date } = req.params;
  
  try {
    // Read bookings data
    const bookingsPath = path.join(__dirname, '../data/bookings.json');
    const bookings = readJSONFile(bookingsPath);
    
    // Find bookings for the specified date
    const dateBookings = bookings.filter(booking => {
      const bookingDate = booking.eventDate || booking.event_date;
      return bookingDate === date;
    });
    
    res.json({
      success: true,
      date: date,
      bookings: dateBookings,
      availableSlots: getAvailableSlots(dateBookings)
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check availability' 
    });
  }
});

function getAvailableSlots(dateBookings) {
  const allSlots = ['morning', 'afternoon'];
  const bookedSlots = dateBookings.map(booking => booking.timeSlot || booking.time_slot).filter(slot => slot);
  
  return allSlots.filter(slot => !bookedSlots.includes(slot));
}

// Get all bookings (admin) or user's bookings
router.get('/', (req, res) => {
  try {
    // Read bookings and users data
    const bookingsPath = path.join(__dirname, '../data/bookings.json');
    const usersPath = path.join(__dirname, '../data/users.json');
    
    const bookings = readJSONFile(bookingsPath);
    const users = readJSONFile(usersPath);
    
    // Enhance bookings with user information
    const enhancedBookings = bookings.map(booking => {
      const user = users.find(u => u.id === booking.userId);
      return {
        ...booking,
        customerName: user ? `${user.firstName} ${user.lastName}` : 'Unknown Customer',
        customerPhone: user ? user.phoneNumber : 'No phone',
        first_name: user?.firstName || 'Unknown',
        last_name: user?.lastName || 'Customer',
        email: user?.email || 'No email',
        phone_number: user?.phoneNumber || 'No phone'
      };
    });
    
    res.json({ bookings: enhancedBookings });
  } catch (error) {
    console.error('Error loading bookings:', error);
    res.status(500).json({ error: 'Failed to load bookings' });
  }
});

// Get single booking
router.get('/:id', authenticateToken, requireCustomerOrAdmin, (req, res) => {
  const db = getDatabase();
  const bookingId = req.params.id;
  const isAdmin = req.user.userType === 'admin';
  
  let query = `
    SELECT b.*, u.first_name, u.last_name, u.email, u.phone_number
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    WHERE b.id = ?
  `;
  
  const params = [bookingId];
  if (!isAdmin) {
    query += ' AND b.user_id = ?';
    params.push(req.user.id);
  }

  db.get(query, params, (err, booking) => {
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
  });
});

// Create new booking
router.post('/', async (req, res) => {
  try {
    const { 
      firstName, lastName, email, contactNumber, occasion, 
      eventDate, timeSlot, numGuests, eventVenue, 
      eventAddress, eventCity, eventProvince, eventPostal, 
      instructions, fullAddress, selectedItems
    } = req.body;

    // Validate required fields
    if (!eventDate || !timeSlot || !selectedItems || !selectedItems.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Read data files
    const bookingsPath = path.join(__dirname, '../data/bookings.json');
    const usersPath = path.join(__dirname, '../data/users.json');
    
    const bookings = readJSONFile(bookingsPath);
    const users = readJSONFile(usersPath);

    // Check if time slot is available
    const conflictingBooking = bookings.find(booking => 
      booking.eventDate === eventDate && 
      (booking.timeSlot === timeSlot || booking.time_slot === timeSlot)
    );

    if (conflictingBooking) {
      return res.status(400).json({ 
        error: `The ${timeSlot} time slot is already booked for ${eventDate}` 
      });
    }

    // Generate booking ID
    const bookingId = `BK-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const newId = Math.max(0, ...bookings.map(b => b.id || 0)) + 1;

    // Calculate total amount
    let totalAmount = 0;
    selectedItems.forEach(item => {
      totalAmount += (item.price || 0) * (item.quantity || 0);
    });

    // Create new booking object
    const newBooking = {
      id: newId,
      bookingId: bookingId,
      userId: 1, // Default user ID for now
      customerName: `${firstName} ${lastName}`,
      customerPhone: contactNumber,
      eventType: occasion,
      eventDate: eventDate,
      timeSlot: timeSlot,
      eventVenue: eventVenue || fullAddress,
      venue: fullAddress,
      numGuests: parseInt(numGuests),
      totalAmount: totalAmount,
      specialInstructions: instructions || '',
      selectedItems: selectedItems,
      items: selectedItems.map(item => ({
        itemName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: (item.price || 0) * (item.quantity || 0)
      })),
      bookingStatus: 'pending',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add to bookings array
    bookings.push(newBooking);

    // Save back to file
    if (!writeJSONFile(bookingsPath, bookings)) {
      return res.status(500).json({ error: 'Failed to save booking' });
    }

    res.status(201).json({
      message: 'Booking created successfully',
      booking: newBooking
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update booking status (admin only)
router.patch('/:id/status', [
  authenticateToken,
  requireCustomerOrAdmin,
  body('status').isIn(['pending', 'confirmed', 'cancelled', 'completed'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { status } = req.body;
  const bookingId = req.params.id;
  const db = getDatabase();

  // Check if user is admin or booking owner
  db.get(
    'SELECT user_id FROM bookings WHERE id = ?',
    [bookingId],
    (err, booking) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      if (req.user.userType !== 'admin' && booking.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

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
    }
  );
});

// Delete booking
router.delete('/:id', authenticateToken, requireCustomerOrAdmin, (req, res) => {
  const bookingId = req.params.id;
  const db = getDatabase();

  // Check if user is admin or booking owner
  db.get(
    'SELECT user_id FROM bookings WHERE id = ?',
    [bookingId],
    (err, booking) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      if (req.user.userType !== 'admin' && booking.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Delete booking items first
      db.run('DELETE FROM booking_items WHERE booking_id = ?', [bookingId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete booking items' });
        }

        // Delete booking
        db.run('DELETE FROM bookings WHERE id = ?', [bookingId], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to delete booking' });
          }

          res.json({ message: 'Booking deleted successfully' });
        });
      });
    }
  );
});

module.exports = router;