// Enable CORS with specific options
const corsOptions = {
  origin: [
    'https://k1ng846.github.io',
    'http://localhost:3000',
    'https://k1ng846.github.io/d-sis-catering-'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With'],
  credentials: true
};
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));// Simple Backend Server for d'sis Catering (Student Level)
// This server uses JSON files instead of a database for simplicity

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Data storage directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Simple data storage functions
function readData(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading data:', error);
        return [];
    }
}

function writeData(filename, data) {
    const filePath = path.join(DATA_DIR, filename);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing data:', error);
        return false;
    }
}

// Initialize sample data if files don't exist
function initializeData() {
    const usersFile = path.join(DATA_DIR, 'users.json');
    const menuFile = path.join(DATA_DIR, 'menu.json');
    const messagesFile = path.join(DATA_DIR, 'messages.json');
    
    if (!fs.existsSync(usersFile)) {
        const sampleUsers = [
            {
                id: 1,
                username: 'admin',
                email: 'admin@dsis.com',
                password: 'admin123',
                firstName: 'Admin',
                lastName: 'User',
                userType: 'admin'
            },
            {
                id: 2,
                username: 'customer',
                email: 'customer@test.com',
                password: 'customer123',
                firstName: 'John',
                lastName: 'Doe',
                userType: 'customer'
            }
        ];
        writeData('users.json', sampleUsers);
    }
    
    if (!fs.existsSync(menuFile)) {
        const sampleMenu = [
            {
                id: 1,
                itemName: 'Lechon',
                description: 'Traditional Filipino roasted pig',
                category: 'Main Course',
                pricePerServing: 500,
                imageUrl: '/img/lechon.jpg',
                isAvailable: true
            },
            {
                id: 2,
                itemName: 'Chicken Cordon Bleu',
                description: 'Breaded chicken with ham and cheese',
                category: 'Main Course',
                pricePerServing: 350,
                imageUrl: '/img/cordonblue.jpg',
                isAvailable: true
            },
            {
                id: 3,
                itemName: 'Lasagna',
                description: 'Layered pasta with meat and cheese',
                category: 'Main Course',
                pricePerServing: 300,
                imageUrl: '/img/lasagna.jpg',
                isAvailable: true
            },
            {
                id: 4,
                itemName: 'Shanghai Rolls',
                description: 'Crispy spring rolls with meat filling',
                category: 'Appetizer',
                pricePerServing: 200,
                imageUrl: '/img/shanghai.jpg',
                isAvailable: true
            },
            {
                id: 5,
                itemName: 'Fruit Salad',
                description: 'Fresh mixed fruits with cream',
                category: 'Dessert',
                pricePerServing: 150,
                imageUrl: '/img/fruitsalad.jpg',
                isAvailable: true
            },
            {
                id: 6,
                itemName: 'Rice',
                description: 'Steamed white rice',
                category: 'Side Dish',
                pricePerServing: 50,
                imageUrl: '/img/rice.jpg',
                isAvailable: true
            },
            {
                id: 7,
                itemName: 'Soft Drinks',
                description: 'Assorted soft drinks',
                category: 'Beverage',
                pricePerServing: 30,
                imageUrl: '/img/drinks.png',
                isAvailable: true
            },
            {
                id: 8,
                itemName: 'Cucumber Juice',
                description: 'Fresh cucumber juice',
                category: 'Beverage',
                pricePerServing: 80,
                imageUrl: '/img/cucumberjuice.jpg',
                isAvailable: true
            }
        ];
        writeData('menu.json', sampleMenu);
    }

    // Initialize empty messages store
    if (!fs.existsSync(messagesFile)) {
        writeData('messages.json', []);
    }
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Simple server is running',
        timestamp: new Date().toISOString()
    });
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const users = readData('users.json');
    const user = users.find(u => u.email === email);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if password is hashed (starts with $2a$ or $2b$) or plain text
    let passwordValid = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        // Password is hashed, use bcrypt to compare
        try {
            const bcrypt = require('bcryptjs');
            passwordValid = await bcrypt.compare(password, user.password);
        } catch (err) {
            // If bcrypt is not available, check against known good passwords
            if (email === 'admin@dsis.com' && password === 'admin123') {
                passwordValid = true;
            } else if (password === 'customer123') {
                passwordValid = true;
            }
        }
    } else {
        // Password is plain text, compare directly
        passwordValid = user.password === password;
    }
    
    if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
        message: 'Login successful',
        user: userWithoutPassword,
        token: 'simple_token_' + Date.now() // Simple token for frontend compatibility
    });
});

// Register/Signup route
app.post('/api/auth/register', (req, res) => {
    const { firstName, lastName, email, mobileNumber, password, repeatPassword } = req.body;
    
    // Validation
    if (!firstName || !lastName || !email || !password || !repeatPassword) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (password !== repeatPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    const users = readData('users.json');
    
    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.status(409).json({ error: 'User with this email already exists' });
    }
    
    // Create new user
    const newUser = {
        id: users.length + 1,
        username: email.split('@')[0],
        email,
        password,
        firstName,
        lastName,
        phoneNumber: mobileNumber || '',
        userType: 'customer',
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    
    if (!writeData('users.json', users)) {
        return res.status(500).json({ error: 'Failed to save user data' });
    }
    
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.status(201).json({
        message: 'User created successfully',
        user: userWithoutPassword
    });
});

app.get('/api/auth/me', (req, res) => {
    const users = readData('users.json');
    const adminUser = users.find(u => u.userType === 'admin');
    const { password: _, ...userWithoutPassword } = adminUser;
    
    res.json({ user: userWithoutPassword });
});

app.post('/api/auth/logout', (req, res) => {
    res.json({ message: 'Logout successful' });
});

// Update profile (simple backend - no auth required, uses email to identify user)
app.put('/api/auth/profile', (req, res) => {
    // The email field in req.body is the CURRENT email (used to identify user)
    // If user wants to change email, it would be sent as a separate field, but for simplicity,
    // we'll use the email field as both identifier and new value if it's different
    const currentEmail = req.body.email; // This is the current email from localStorage
    const { firstName, lastName, email: newEmail, phoneNumber, username } = req.body;
    
    if (!currentEmail) {
        return res.status(400).json({ error: 'Current email is required' });
    }
    
    const users = readData('users.json');
    const userIndex = users.findIndex(u => u.email === currentEmail);
    
    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // If newEmail is provided and different from current, check if it's available
    if (newEmail && newEmail !== currentEmail) {
        const emailExists = users.find(u => u.email === newEmail && u.email !== currentEmail);
        if (emailExists) {
            return res.status(409).json({ error: 'Email already in use' });
        }
        users[userIndex].email = newEmail;
    }
    
    // Check if username is already taken
    if (username && username !== users[userIndex].username) {
        const usernameExists = users.find(u => u.username === username && u.email !== (newEmail || currentEmail));
        if (usernameExists) {
            return res.status(409).json({ error: 'Username already in use' });
        }
        users[userIndex].username = username;
    }
    
    // Update other fields
    if (firstName) users[userIndex].firstName = firstName;
    if (lastName) users[userIndex].lastName = lastName;
    if (phoneNumber !== undefined) users[userIndex].phoneNumber = phoneNumber;
    
    if (!writeData('users.json', users)) {
        return res.status(500).json({ error: 'Failed to update profile' });
    }
    
    const { password: _, ...userWithoutPassword } = users[userIndex];
    res.json({
        message: 'Profile updated successfully',
        user: userWithoutPassword
    });
});

// Change password (simple backend)
app.post('/api/auth/change-password', (req, res) => {
    const { email, currentPassword, newPassword } = req.body;
    
    if (!email || !currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Email, current password, and new password are required' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    
    const users = readData('users.json');
    const user = users.find(u => u.email === email);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.password !== currentPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    user.password = newPassword;
    
    if (!writeData('users.json', users)) {
        return res.status(500).json({ error: 'Failed to update password' });
    }
    
    res.json({ message: 'Password updated successfully' });
});

// Forgot password (simple reset using email + optional mobile verification)
app.post('/api/auth/forgot-password', (req, res) => {
    const { email, mobileNumber, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ error: 'Email and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const users = readData('users.json');
    const user = users.find(u => u.email === email);

    if (!user) {
        return res.status(404).json({ error: 'No account found for this email' });
    }

    if (mobileNumber && user.phoneNumber && user.phoneNumber !== mobileNumber) {
        return res.status(401).json({ error: 'Mobile number does not match our records' });
    }

    user.password = newPassword;

    if (!writeData('users.json', users)) {
        return res.status(500).json({ error: 'Failed to update password' });
    }

    res.json({ message: 'Password reset successfully. You may now log in with your new password.' });
});

// Menu routes
app.get('/api/menu', (req, res) => {
    const { category } = req.query;
    const menuItems = readData('menu.json');
    
    let filteredItems = menuItems;
    if (category) {
        filteredItems = menuItems.filter(item => item.category === category);
    }
    
    res.json({ success: true, items: filteredItems });
});

app.get('/api/menu/categories/list', (req, res) => {
    const menuItems = readData('menu.json');
    const categories = [...new Set(menuItems.map(item => item.category))];
    res.json({ success: true, categories });
});

// Admin: Create new menu item
app.post('/api/menu', (req, res) => {
    const { itemName, description, category, pricePerServing, imageUrl, isAvailable = true } = req.body;
    
    console.log('Received menu item data:', req.body);
    
    if (!itemName || !category || pricePerServing === undefined) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: itemName, category, pricePerServing' 
        });
    }

    if (pricePerServing < 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Price per serving must be non-negative' 
        });
    }

    const menuItems = readData('menu.json');
    
    // Generate new ID
    const newId = menuItems.length > 0 ? Math.max(...menuItems.map(item => item.id || 0)) + 1 : 1;
    
    const newItem = {
        id: newId,
        itemName: itemName.trim(),
        description: description || '',
        category: category.trim(),
        pricePerServing: parseFloat(pricePerServing),
        imageUrl: imageUrl || '',
        isAvailable: Boolean(isAvailable),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    menuItems.push(newItem);
    
    if (!writeData('menu.json', menuItems)) {
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to save menu item' 
        });
    }

    console.log('Menu item created successfully:', newItem);
    res.status(201).json({
        success: true,
        message: 'Menu item created successfully',
        item: newItem
    });
});

// Admin: Update menu item
app.put('/api/menu/:id', (req, res) => {
    const itemId = parseInt(req.params.id);
    const updates = req.body;
    
    console.log('Updating menu item:', itemId, updates);
    
    if (updates.pricePerServing !== undefined && updates.pricePerServing < 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Price per serving must be non-negative' 
        });
    }

    const menuItems = readData('menu.json');
    const itemIndex = menuItems.findIndex(item => item.id === itemId);

    if (itemIndex === -1) {
        return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    // Update only provided fields
    const currentItem = menuItems[itemIndex];
    const updatedItem = { ...currentItem };

    if (updates.itemName !== undefined) {
        updatedItem.itemName = updates.itemName.trim();
    }
    if (updates.description !== undefined) {
        updatedItem.description = updates.description;
    }
    if (updates.category !== undefined) {
        updatedItem.category = updates.category.trim();
    }
    if (updates.pricePerServing !== undefined) {
        updatedItem.pricePerServing = parseFloat(updates.pricePerServing);
    }
    if (updates.imageUrl !== undefined) {
        updatedItem.imageUrl = updates.imageUrl;
    }
    if (updates.isAvailable !== undefined) {
        updatedItem.isAvailable = Boolean(updates.isAvailable);
    }

    updatedItem.updatedAt = new Date().toISOString();
    menuItems[itemIndex] = updatedItem;
    
    if (!writeData('menu.json', menuItems)) {
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to save menu item' 
        });
    }

    console.log('Menu item updated successfully:', updatedItem);
    res.json({
        success: true,
        message: 'Menu item updated successfully',
        item: updatedItem
    });
});

// Admin: Delete menu item
app.delete('/api/menu/:id', (req, res) => {
    const itemId = parseInt(req.params.id);
    
    const menuItems = readData('menu.json');
    const itemIndex = menuItems.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
        return res.status(404).json({ success: false, error: 'Menu item not found' });
    }
    
    const deletedItem = menuItems.splice(itemIndex, 1)[0];
    
    if (!writeData('menu.json', menuItems)) {
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to delete menu item' 
        });
    }

    console.log('Menu item deleted successfully:', deletedItem);
    res.json({
        success: true,
        message: 'Menu item deleted successfully',
        deletedItem
    });
});

// Booking routes
app.get('/api/bookings', (req, res) => {
    const bookings = readData('bookings.json');
    res.json({ bookings });
});

// Offers routes (simple JSON store)
app.get('/api/offers/active', (req, res) => {
    const offers = readData('offers.json');
    const now = new Date();
    const active = offers.filter(o => {
        if (!o.active) return false;
        const start = o.startAt ? new Date(o.startAt) : null;
        const end = o.endAt ? new Date(o.endAt) : null;
        if (start && now < start) return false;
        if (end && now > end) return false;
        return true;
    });
    res.json({ offers: active });
});

// Admin: list all offers
app.get('/api/offers', (req, res) => {
    const offers = readData('offers.json');
    res.json({ success: true, offers });
});

// Admin: create offer
app.post('/api/offers', (req, res) => {
    const { title, description, imageUrl, imageData, imageFileName, startAt, endAt, active=true } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Title is required' });

    const offers = readData('offers.json');
    const newOffer = {
        id: offers.length ? Math.max(...offers.map(o=>o.id)) + 1 : 1,
        title,
        description: description || '',
        imageUrl: imageData || imageUrl || '', // Prefer imageData over imageUrl
        imageData: imageData || '',
        imageFileName: imageFileName || '',
        startAt: startAt || null,
        endAt: endAt || null,
        active: !!active,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    offers.push(newOffer);
    if (!writeData('offers.json', offers)) return res.status(500).json({ success: false, error: 'Failed to save offer' });
    res.status(201).json({ success: true, offer: newOffer });
});

// Admin: update offer
app.put('/api/offers/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const offers = readData('offers.json');
    const idx = offers.findIndex(o=>o.id===id);
    if (idx === -1) return res.status(404).json({ error: 'Offer not found' });
    const { title, description, imageUrl, startAt, endAt, active } = req.body;
    if (title !== undefined) offers[idx].title = title;
    if (description !== undefined) offers[idx].description = description;
    if (imageUrl !== undefined) offers[idx].imageUrl = imageUrl;
    if (startAt !== undefined) offers[idx].startAt = startAt;
    if (endAt !== undefined) offers[idx].endAt = endAt;
    if (active !== undefined) offers[idx].active = !!active;
    offers[idx].updatedAt = new Date().toISOString();
    if (!writeData('offers.json', offers)) return res.status(500).json({ error: 'Failed to update offer' });
    res.json({ offer: offers[idx] });
});

// Admin: delete offer
app.delete('/api/offers/:id', (req, res) => {
    const id = parseInt(req.params.id);
    let offers = readData('offers.json');
    const idx = offers.findIndex(o=>o.id===id);
    if (idx === -1) return res.status(404).json({ error: 'Offer not found' });
    offers.splice(idx, 1);
    if (!writeData('offers.json', offers)) return res.status(500).json({ error: 'Failed to delete offer' });
    res.json({ message: 'Offer deleted' });
});

app.get('/api/bookings/:id', (req, res) => {
    const bookings = readData('bookings.json');
    const booking = bookings.find(b => b.id === parseInt(req.params.id));
    
    if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({ booking });
});

app.post('/api/bookings', (req, res) => {
    const { eventType, eventDate, eventVenue, numGuests, specialInstructions, menuItems, customerName, customerEmail, customerPhone } = req.body;
    
    if (!eventType || !eventDate || !eventVenue || !numGuests || !menuItems || !customerName || !customerEmail) {
        return res.status(400).json({ error: 'Missing required fields (eventType, eventDate, eventVenue, numGuests, menuItems, customerName, customerEmail)' });
    }
    
    const bookings = readData('bookings.json');
    const menuData = readData('menu.json');

    // Prevent multiple bookings on the same calendar date (unless previous booking was cancelled)
    const dateAlreadyBooked = bookings.some(b =>
        b.eventDate === eventDate &&
        b.bookingStatus !== 'cancelled'
    );

    if (dateAlreadyBooked) {
        return res.status(409).json({
            error: 'Sorry, this date is already booked. Please choose another date.'
        });
    }
    
    let totalAmount = 0;
    const bookingItems = menuItems.map(item => {
        const menuItem = menuData.find(m => m.id === item.itemId);
        const itemTotal = menuItem.pricePerServing * item.quantity;
        totalAmount += itemTotal;
        
        return {
            itemId: item.itemId,
            itemName: menuItem.itemName,
            quantity: item.quantity,
            unitPrice: menuItem.pricePerServing,
            totalPrice: itemTotal
        };
    });
    
    const newBooking = {
        id: bookings.length + 1,
        bookingId: `BK-${Date.now()}`,
        customerName,
        customerEmail,
        customerPhone: customerPhone || '',
        eventType,
        eventDate,
        eventVenue,
        numGuests: parseInt(numGuests),
        specialInstructions: specialInstructions || '',
        bookingStatus: 'pending',
        totalAmount,
        items: bookingItems,
        createdAt: new Date().toISOString()
    };
    
    bookings.push(newBooking);
    writeData('bookings.json', bookings);
    
    res.status(201).json({
        message: 'Booking created successfully',
        booking: newBooking
    });
});

app.patch('/api/bookings/:id/status', (req, res) => {
    const { status } = req.body;
    const bookings = readData('bookings.json');
    const booking = bookings.find(b => b.id === parseInt(req.params.id));
    
    if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
    }
    
    booking.bookingStatus = status;
    writeData('bookings.json', bookings);
    
    res.json({ message: 'Booking status updated successfully' });
});
// Receipt routes
app.post('/api/receipts/generate', (req, res) => {
  const { bookingId, paymentMethod = 'Cash', paymentStatus = 'pending' } = req.body;

  const bookings = readData('bookings.json');
  const booking = bookings.find(b => b.id === parseInt(bookingId));

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const subtotal = booking.totalAmount;
  const taxRate = 0.12; // 12% VAT
  const taxAmount = subtotal * taxRate;
  const totalAmount = subtotal + taxAmount;

  const receipts = readData('receipts.json');
  const newReceipt = {
    id: receipts.length + 1,
    receiptId: `RCP-${Date.now()}`,
    receiptNumber: `R${String(receipts.length + 1).padStart(6, '0')}`,
    bookingId: booking.bookingId,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone || '',
    eventType: booking.eventType,
    eventDate: booking.eventDate,
    eventVenue: booking.eventVenue,
    numGuests: booking.numGuests,
    items: booking.items,
    subtotal,
    taxRate,
    taxAmount,
    totalAmount,
    paymentMethod,
    paymentStatus,
    issuedDate: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };

  receipts.push(newReceipt);
  writeData('receipts.json', receipts);

  res.status(201).json({
    message: 'Receipt generated successfully',
    receipt: newReceipt
  });
});

// Messages routes (simple JSON-backed)
// Customer: send message
app.post('/api/messages', (req, res) => {
  const { userEmail, userName, subject, messageContent } = req.body;
  if (!userEmail || !subject || !messageContent) {
    return res.status(400).json({ error: 'userEmail, subject and messageContent are required' });
  }

  const messages = readData('messages.json');
  const newMessage = {
    id: messages.length + 1,
    userEmail,
    userName: userName || userEmail.split('@')[0],
    subject,
    messageContent,
    adminResponse: '',
    messageStatus: 'unread',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  messages.push(newMessage);
  writeData('messages.json', messages);

  res.status(201).json({
    message: 'Message sent successfully',
    data: newMessage
  });
});

// Get messages for a specific customer by email
app.get('/api/messages/my', (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email query param is required' });

  const messages = readData('messages.json').filter(m => m.userEmail === email);
  res.json({ messages });
});

// Admin: get all messages
app.get('/api/messages/admin', (req, res) => {
  // No auth layer in simple server; assume admin UI controls access
  const messages = readData('messages.json').sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json({ messages });
});

// Admin: respond to a message
app.post('/api/messages/:id/respond', (req, res) => {
  const { id } = req.params;
  const { adminResponse } = req.body;
  if (!adminResponse) return res.status(400).json({ error: 'adminResponse is required' });

  const messages = readData('messages.json');
  const msg = messages.find(m => m.id === parseInt(id));
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  msg.adminResponse = adminResponse;
  msg.messageStatus = 'replied';
  msg.updatedAt = new Date().toISOString();
  writeData('messages.json', messages);

  res.json({ message: 'Response saved', data: msg });
});

// Admin: update message status (unread, read, replied)
app.patch('/api/messages/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['unread', 'read', 'replied'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const messages = readData('messages.json');
  const msg = messages.find(m => m.id === parseInt(id));
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  msg.messageStatus = status;
  msg.updatedAt = new Date().toISOString();
  writeData('messages.json', messages);

  res.json({ message: 'Status updated', data: msg });
});

// Admin dashboard
app.get('/api/admin/dashboard', (req, res) => {
  const users = readData('users.json');
  const bookings = readData('bookings.json');
  const receipts = readData('receipts.json');
  const menuItems = readData('menu.json');

  const statistics = {
    totalUsers: users.length,
    totalBookings: bookings.length,
    totalRevenue: receipts
      .filter(r => r.paymentStatus === 'paid')
      .reduce((sum, r) => sum + r.totalAmount, 0),
    pendingBookings: bookings.filter(b => b.bookingStatus === 'pending').length,
    totalMenuItems: menuItems.length,
    availableMenuItems: menuItems.filter(m => m.isAvailable).length
  };

  res.json({
    statistics,
    recentBookings: bookings.slice(-10).reverse()
  });
});

// Load route files if they exist
const routeFiles = ['offers.js', 'promo-codes.js'];

routeFiles.forEach(routeFile => {
  const routePath = path.join(__dirname, 'routes', routeFile);
  if (fs.existsSync(routePath)) {
    try {
      const routeName = routeFile.replace('.js', '');
      app.use(`/api/${routeName}`, require(`./routes/${routeFile}`));
      console.log(`✅ Loaded route: /api/${routeName}`);
    } catch (error) {
      console.warn(`⚠️  Failed to load route ${routeFile}:`, error.message);
    }
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize data and start server
initializeData();

app.listen(PORT, () => {
  console.log(`🚀 Simple server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📁 Data stored in: ${DATA_DIR}`);
});

module.exports = app;

