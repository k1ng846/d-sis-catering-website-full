const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const router = express.Router();

// Generate receipt for booking
router.post('/generate', [
  authenticateToken,
  requireCustomerOrAdmin,
  body('bookingId').isInt(),
  body('paymentMethod').optional().trim().escape(),
  body('paymentStatus').optional().isIn(['pending', 'paid', 'failed', 'refunded'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { bookingId, paymentMethod = 'Cash/Card', paymentStatus = 'pending' } = req.body;
  const db = getDatabase();

  // Get booking details
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

      // Check if user is admin or booking owner
      if (req.user.userType !== 'admin' && booking.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
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

          // Calculate totals
          const subtotal = booking.total_amount || 0;
          const taxRate = 0.12; // 12% VAT
          const taxAmount = subtotal * taxRate;
          const totalAmount = subtotal + taxAmount;

          // Generate receipt ID and number
          const receiptId = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
          const receiptNumber = `R${Date.now().toString().slice(-6)}`;

          // Create receipt
          db.run(
            `INSERT INTO receipts (receipt_id, booking_id, receipt_number, subtotal, tax_rate, tax_amount, total_amount, payment_method, payment_status, issued_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [receiptId, bookingId, receiptNumber, subtotal, totalAmount, paymentMethod, paymentStatus, new Date().toISOString().split('T')[0]],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Failed to create receipt' });
              }

              const receipt = {
                id: this.lastID,
                receiptId,
                receiptNumber,
                bookingId: booking.booking_id,
                customerName: `${booking.first_name} ${booking.last_name}`,
                customerEmail: booking.email,
                customerPhone: booking.phone_number,
                eventType: booking.event_type,
                eventDate: booking.event_date,
                eventVenue: booking.event_venue,
                numGuests: booking.num_guests,
                items: items,
                subtotal,
                totalAmount,
                paymentMethod,
                paymentStatus,
                issuedDate: new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString()
              };

              res.status(201).json({
                message: 'Receipt generated successfully',
                receipt
              });
            }
          );
        }
      );
    }
  );
});

// Get all receipts (admin) or user's receipts
router.get('/', authenticateToken, requireCustomerOrAdmin, (req, res) => {
  const db = getDatabase();
  const isAdmin = req.user.userType === 'admin';
  
  let query = `
    SELECT r.*, b.booking_id, b.event_type, b.event_date, b.event_venue, b.num_guests,
           u.first_name, u.last_name, u.email
    FROM receipts r
    JOIN bookings b ON r.booking_id = b.id
    JOIN users u ON b.user_id = u.id
  `;
  
  const params = [];
  if (!isAdmin) {
    query += ' WHERE b.user_id = ?';
    params.push(req.user.id);
  }
  
  query += ' ORDER BY r.created_at DESC';

  db.all(query, params, (err, receipts) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ receipts });
  });
});

// Get single receipt
router.get('/:id', authenticateToken, requireCustomerOrAdmin, (req, res) => {
  const db = getDatabase();
  const receiptId = req.params.id;
  const isAdmin = req.user.userType === 'admin';
  
  let query = `
    SELECT r.*, b.booking_id, b.event_type, b.event_date, b.event_venue, b.num_guests,
           u.first_name, u.last_name, u.email, u.phone_number
    FROM receipts r
    JOIN bookings b ON r.booking_id = b.id
    JOIN users u ON b.user_id = u.id
    WHERE r.id = ?
  `;
  
  const params = [receiptId];
  if (!isAdmin) {
    query += ' AND b.user_id = ?';
    params.push(req.user.id);
  }

  db.get(query, params, (err, receipt) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Get receipt items
    db.all(
      `SELECT bi.*, mi.item_name, mi.description, mi.category
       FROM booking_items bi
       JOIN menu_items mi ON bi.item_id = mi.id
       WHERE bi.booking_id = ?`,
      [receipt.booking_id],
      (err, items) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        res.json({ 
          receipt: {
            ...receipt,
            items
          }
        });
      }
    );
  });
});

// Update payment status (admin only)
router.patch('/:id/payment-status', [
  authenticateToken,
  requireCustomerOrAdmin,
  body('paymentStatus').isIn(['pending', 'paid', 'failed', 'refunded'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { paymentStatus } = req.body;
  const receiptId = req.params.id;
  const db = getDatabase();

  // Check if user is admin or receipt owner
  db.get(
    `SELECT b.user_id FROM receipts r
     JOIN bookings b ON r.booking_id = b.id
     WHERE r.id = ?`,
    [receiptId],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!result) {
        return res.status(404).json({ error: 'Receipt not found' });
      }

      if (req.user.userType !== 'admin' && result.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      db.run(
        'UPDATE receipts SET payment_status = ? WHERE id = ?',
        [paymentStatus, receiptId],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to update payment status' });
          }

          res.json({ message: 'Payment status updated successfully' });
        }
      );
    }
  );
});

// Get receipt by booking ID
router.get('/booking/:bookingId', authenticateToken, requireCustomerOrAdmin, (req, res) => {
  const db = getDatabase();
  const bookingId = req.params.bookingId;
  const isAdmin = req.user.userType === 'admin';
  
  let query = `
    SELECT r.*, b.booking_id, b.event_type, b.event_date, b.event_venue, b.num_guests,
           u.first_name, u.last_name, u.email, u.phone_number
    FROM receipts r
    JOIN bookings b ON r.booking_id = b.id
    JOIN users u ON b.user_id = u.id
    WHERE b.id = ?
  `;
  
  const params = [bookingId];
  if (!isAdmin) {
    query += ' AND b.user_id = ?';
    params.push(req.user.id);
  }

  db.get(query, params, (err, receipt) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found for this booking' });
    }

    res.json({ receipt });
  });
});

// Generate PDF receipt
router.get('/:receiptId/pdf', async (req, res) => {
  const { receiptId } = req.params;

  try {
    // Read receipts data
    const receiptsPath = path.join(__dirname, '../data/receipts.json');
    const bookingsPath = path.join(__dirname, '../data/bookings.json');
    const usersPath = path.join(__dirname, '../data/users.json');
    const menuPath = path.join(__dirname, '../data/menu.json');
    
    const receiptsData = JSON.parse(fs.readFileSync(receiptsPath, 'utf8'));
    const bookingsData = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
    const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));

    // Find receipt
    const receipt = receiptsData.find(r => r.receiptId === receiptId);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Find related booking
    const booking = bookingsData.find(b => b.id === receipt.bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Related booking not found' });
    }

    // Find user
    const user = usersData.find(u => u.id === booking.userId);

    // Get menu items for this booking
    const bookingItems = booking.selectedItems || [];

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receiptNumber}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Create combined receipt data
    const receiptData = {
      ...receipt,
      ...booking,
      first_name: user?.firstName || 'N/A',
      last_name: user?.lastName || 'N/A',
      email: user?.email || 'N/A',
      phone_number: user?.phoneNumber || 'N/A'
    };

    // Generate PDF content
    generateReceiptPDF(doc, receiptData, bookingItems);
    
    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Generate PDF receipt for admin (booking-based)
router.get('/booking/:bookingId/pdf', async (req, res) => {
  const { bookingId } = req.params;

  try {
    // Read data files
    const bookingsPath = path.join(__dirname, '../data/bookings.json');
    const usersPath = path.join(__dirname, '../data/users.json');
    const menuPath = path.join(__dirname, '../data/menu.json');
    
    const bookingsData = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
    const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));

    // Find booking
    const booking = bookingsData.find(b => b.id === parseInt(bookingId));
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Find user
    const user = usersData.find(u => u.id === booking.userId);

    // Get menu items for this booking
    const bookingItems = booking.selectedItems || [];

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    const receiptNumber = `R${Date.now().toString().slice(-6)}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="booking-receipt-${booking.bookingId || bookingId}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Create receipt object for PDF generation
    const receiptData = {
      receipt_number: receiptNumber,
      receiptNumber: receiptNumber,
      booking_id: booking.bookingId || booking.id,
      first_name: user?.firstName || 'N/A',
      last_name: user?.lastName || 'N/A',
      email: user?.email || 'N/A',
      phone_number: user?.phoneNumber || 'N/A',
      event_type: booking.eventType,
      event_date: booking.eventDate,
      event_venue: booking.venue,
      num_guests: booking.numGuests,
      total_amount: booking.totalAmount,
      payment_method: 'Cash/Card',
      payment_status: booking.status || 'pending',
      issued_date: new Date().toISOString().split('T')[0]
    };

    // Generate PDF content
    generateReceiptPDF(doc, receiptData, bookingItems);
    
    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

function generateReceiptPDF(doc, receipt, items) {
  // Header
  doc.fontSize(24).text("d'sis Catering", 50, 50);
  doc.fontSize(12).text('Celebrating Life with Food', 50, 80);
  doc.text('San Lorenzo, Mexico, Pampanga, San Fernando, Philippines', 50, 95);
  doc.text('+63 908 342 2706 | dsis_catering28@yahoo.com', 50, 110);
  
  // Receipt details
  doc.fontSize(16).text('RECEIPT', 400, 50);
  doc.fontSize(12);
  doc.text(`Receipt #: ${receipt.receipt_number || receipt.receiptNumber}`, 400, 80);
  doc.text(`Date: ${receipt.issued_date || new Date().toLocaleDateString()}`, 400, 95);
  doc.text(`Booking #: ${receipt.booking_id || receipt.bookingId}`, 400, 110);
  doc.text(`Status: ${receipt.payment_status || 'Pending'}`, 400, 125);

  // Line separator
  doc.moveTo(50, 140).lineTo(550, 140).stroke();

  // Customer Information
  let yPos = 160;
  doc.fontSize(14).text('Customer Information', 50, yPos);
  yPos += 20;
  doc.fontSize(11);
  doc.text(`Name: ${receipt.first_name} ${receipt.last_name}`, 50, yPos);
  yPos += 15;
  doc.text(`Email: ${receipt.email}`, 50, yPos);
  yPos += 15;
  doc.text(`Phone: ${receipt.phone_number}`, 50, yPos);
  yPos += 25;

  // Event Details
  doc.fontSize(14).text('Event Details', 50, yPos);
  yPos += 20;
  doc.fontSize(11);
  doc.text(`Event Type: ${receipt.event_type || receipt.eventType}`, 50, yPos);
  yPos += 15;
  doc.text(`Date: ${new Date(receipt.event_date || receipt.eventDate).toLocaleDateString()}`, 50, yPos);
  yPos += 15;
  
  // Add time slot information
  const timeSlot = receipt.timeSlot || receipt.time_slot;
  if (timeSlot) {
    const timeDisplay = timeSlot === 'morning' ? '8:00 AM - 2:00 PM' : 
                       timeSlot === 'afternoon' ? '3:00 PM - 11:00 PM' : 
                       'Time not specified';
    doc.text(`Time Slot: ${timeDisplay}`, 50, yPos);
    yPos += 15;
  }
  
  doc.text(`Venue: ${receipt.event_venue || receipt.venue}`, 50, yPos);
  yPos += 15;
  doc.text(`Number of Guests: ${receipt.num_guests || receipt.numGuests}`, 50, yPos);
  yPos += 25;

  // Menu Items Table Header
  doc.fontSize(14).text('Menu Items', 50, yPos);
  yPos += 20;
  
  // Table headers
  doc.fontSize(10);
  doc.text('Item', 50, yPos);
  doc.text('Qty', 250, yPos);
  doc.text('Unit Price', 300, yPos);
  doc.text('Total', 400, yPos);
  
  // Header line
  yPos += 15;
  doc.moveTo(50, yPos).lineTo(450, yPos).stroke();
  yPos += 10;

  // Menu Items
  let subtotal = 0;
  if (items && items.length > 0) {
    items.forEach(item => {
      const quantity = item.quantity || 1;
      const price = item.price || 0;
      const itemTotal = price * quantity;
      subtotal += itemTotal;
      
      doc.text(item.item_name || item.name || 'Menu Item', 50, yPos);
      doc.text(quantity.toString(), 250, yPos);
      doc.text(`₱${price.toFixed(2)}`, 300, yPos);
      doc.text(`₱${itemTotal.toFixed(2)}`, 400, yPos);
      yPos += 15;
    });
  } else {
    doc.text('No items selected', 50, yPos);
    yPos += 15;
  }

  // Total section
  yPos += 10;
  doc.moveTo(50, yPos).lineTo(450, yPos).stroke();
  yPos += 15;
  
  doc.fontSize(12);
  const totalAmount = receipt.total_amount || receipt.totalAmount || subtotal;
  doc.text('Subtotal:', 300, yPos);
  doc.text(`₱${totalAmount.toFixed(2)}`, 400, yPos);
  yPos += 20;
  
  doc.fontSize(14);
  doc.text('Total Amount:', 300, yPos);
  doc.text(`₱${totalAmount.toFixed(2)}`, 400, yPos);

  // Footer
  yPos += 40;
  doc.fontSize(10).text(
    'Thank you for choosing d\'sis Catering!\nWe look forward to making your event memorable.',
    50, yPos, { align: 'center', width: 500 }
  );
}

module.exports = router;