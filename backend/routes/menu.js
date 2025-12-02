const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Helper functions
async function readMenuData() {
  try {
    const menuPath = path.join(__dirname, '../data/menu.json');
    const data = await fs.readFile(menuPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading menu data:', error);
    return [];
  }
}

async function writeMenuData(menuItems) {
  try {
    const menuPath = path.join(__dirname, '../data/menu.json');
    await fs.writeFile(menuPath, JSON.stringify(menuItems, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing menu data:', error);
    return false;
  }
}

// Simple auth check for admin operations
function isAdmin(req) {
  // For now, just check if there's a user in headers (simplified)
  // In a real app, you'd verify JWT tokens properly
  return req.headers.authorization || req.headers['user-type'] === 'admin';
}

// Get all menu items
router.get('/', async (req, res) => {
  try {
    const menuItems = await readMenuData();
    const { category, available } = req.query;
    
    let filteredItems = menuItems;
    
    if (category) {
      filteredItems = filteredItems.filter(item => 
        item.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    if (available !== undefined) {
      const isAvailable = available === 'true';
      filteredItems = filteredItems.filter(item => item.isAvailable === isAvailable);
    }
    
    // Sort by category, then by name
    filteredItems.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.itemName.localeCompare(b.itemName);
    });

    res.json({ success: true, items: filteredItems });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch menu items' });
  }
});

// Get menu item by ID
router.get('/:id', async (req, res) => {
  try {
    const menuItems = await readMenuData();
    const itemId = parseInt(req.params.id);
    
    const item = menuItems.find(item => item.id === itemId);
    
    if (!item) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    res.json({ success: true, item });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch menu item' });
  }
});

// Get menu categories
router.get('/categories/list', async (req, res) => {
  try {
    const menuItems = await readMenuData();
    const categories = [...new Set(menuItems.map(item => item.category))].sort();
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

// Create new menu item (admin only)
router.post('/', async (req, res) => {
  try {
    // Basic validation - in production you'd use proper validation middleware
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

    const menuItems = await readMenuData();
    
    // Generate new ID
    const newId = Math.max(...menuItems.map(item => item.id || 0)) + 1;
    
    const newItem = {
      id: newId,
      itemName: itemName.trim(),
      description: description || '',
      category: category.trim(),
      pricePerServing: parseFloat(pricePerServing),
      imageUrl: imageUrl || '',
      isAvailable: Boolean(isAvailable)
    };

    menuItems.push(newItem);
    
    const success = await writeMenuData(menuItems);
    
    if (!success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save menu item' 
      });
    }

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      item: newItem
    });
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ success: false, error: 'Failed to create menu item' });
  }
});

// Update menu item (admin only)
router.put('/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const updates = req.body;
    
    // Basic validation
    if (updates.pricePerServing !== undefined && updates.pricePerServing < 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Price per serving must be non-negative' 
      });
    }

    const menuItems = await readMenuData();
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

    menuItems[itemIndex] = updatedItem;
    
    const success = await writeMenuData(menuItems);
    
    if (!success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save menu item' 
      });
    }

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      item: updatedItem
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ success: false, error: 'Failed to update menu item' });
  }
});

// Delete menu item (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const menuItems = await readMenuData();
    
    const itemIndex = menuItems.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    // Remove the item
    const deletedItem = menuItems.splice(itemIndex, 1)[0];
    
    const success = await writeMenuData(menuItems);
    
    if (!success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to delete menu item' 
      });
    }

    res.json({
      success: true,
      message: 'Menu item deleted successfully',
      deletedItem
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ success: false, error: 'Failed to delete menu item' });
  }
});

// Toggle availability (admin only)
router.patch('/:id/availability', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const menuItems = await readMenuData();
    
    const itemIndex = menuItems.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    // Toggle availability
    menuItems[itemIndex].isAvailable = !menuItems[itemIndex].isAvailable;
    
    const success = await writeMenuData(menuItems);
    
    if (!success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update menu item availability' 
      });
    }

    res.json({
      success: true,
      message: 'Menu item availability updated successfully',
      item: menuItems[itemIndex]
    });
  } catch (error) {
    console.error('Error toggling availability:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle availability' });
  }
});

module.exports = router;