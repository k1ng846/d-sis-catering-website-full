const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Helper functions
async function readPromoData() {
  try {
    const promoPath = path.join(__dirname, '../data/promo-codes.json');
    const data = await fs.readFile(promoPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading promo codes data:', error);
    return [];
  }
}

async function writePromoData(promoCodes) {
  try {
    const promoPath = path.join(__dirname, '../data/promo-codes.json');
    await fs.writeFile(promoPath, JSON.stringify(promoCodes, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing promo codes data:', error);
    return false;
  }
}

// Get all promo codes
router.get('/', async (req, res) => {
  try {
    const promoCodes = await readPromoData();
    res.json({ success: true, promoCodes });
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch promo codes' });
  }
});

// Validate promo code (for user bookings)
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ success: false, error: 'Promo code is required' });
    }
    
    const promoCodes = await readPromoData();
    const promoCode = promoCodes.find(p => p.code.toUpperCase() === code.toUpperCase());
    
    if (!promoCode) {
      return res.status(404).json({ success: false, error: 'Invalid promo code' });
    }
    
    // Check if promo code is active
    if (!promoCode.active) {
      return res.status(400).json({ success: false, error: 'Promo code is no longer active' });
    }
    
    // Check date validity
    const now = new Date();
    if (promoCode.startAt && new Date(promoCode.startAt) > now) {
      return res.status(400).json({ success: false, error: 'Promo code is not yet active' });
    }
    
    if (promoCode.endAt && new Date(promoCode.endAt) < now) {
      return res.status(400).json({ success: false, error: 'Promo code has expired' });
    }
    
    // Check usage limit
    if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
      return res.status(400).json({ success: false, error: 'Promo code usage limit reached' });
    }
    
    res.json({ success: true, promoCode });
  } catch (error) {
    console.error('Error validating promo code:', error);
    res.status(500).json({ success: false, error: 'Failed to validate promo code' });
  }
});

// Create new promo code
router.post('/', async (req, res) => {
  try {
    const { code, discountPercent, description, usageLimit, startAt, endAt, active = true } = req.body;
    
    if (!code || !discountPercent) {
      return res.status(400).json({ 
        success: false, 
        error: 'Code and discount percentage are required' 
      });
    }
    
    if (discountPercent < 1 || discountPercent > 100) {
      return res.status(400).json({ 
        success: false, 
        error: 'Discount percentage must be between 1 and 100' 
      });
    }
    
    const promoCodes = await readPromoData();
    
    // Check if code already exists
    const existingCode = promoCodes.find(p => p.code.toUpperCase() === code.toUpperCase());
    if (existingCode) {
      return res.status(400).json({ 
        success: false, 
        error: 'Promo code already exists' 
      });
    }
    
    // Generate new ID
    const newId = promoCodes.length > 0 ? Math.max(...promoCodes.map(p => p.id || 0)) + 1 : 1;
    
    const newPromoCode = {
      id: newId,
      code: code.toUpperCase().trim(),
      discountPercent: parseInt(discountPercent),
      description: description || '',
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      usageCount: 0,
      startAt: startAt || new Date().toISOString(),
      endAt: endAt || null,
      active: Boolean(active),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    promoCodes.push(newPromoCode);
    
    const success = await writePromoData(promoCodes);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to save promo code' });
    }
    
    res.status(201).json({ success: true, promoCode: newPromoCode });
  } catch (error) {
    console.error('Error creating promo code:', error);
    res.status(500).json({ success: false, error: 'Failed to create promo code' });
  }
});

// Update promo code
router.put('/:id', async (req, res) => {
  try {
    const promoId = parseInt(req.params.id);
    const updates = req.body;
    
    const promoCodes = await readPromoData();
    const promoIndex = promoCodes.findIndex(promo => promo.id === promoId);
    
    if (promoIndex === -1) {
      return res.status(404).json({ success: false, error: 'Promo code not found' });
    }
    
    // Update promo code with new data
    const currentPromo = promoCodes[promoIndex];
    const updatedPromo = {
      ...currentPromo,
      ...updates,
      id: promoId, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };
    
    promoCodes[promoIndex] = updatedPromo;
    
    const success = await writePromoData(promoCodes);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to save promo code' });
    }
    
    res.json({ success: true, promoCode: updatedPromo });
  } catch (error) {
    console.error('Error updating promo code:', error);
    res.status(500).json({ success: false, error: 'Failed to update promo code' });
  }
});

// Toggle promo code status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const promoId = parseInt(req.params.id);
    const { active } = req.body;
    
    const promoCodes = await readPromoData();
    const promoIndex = promoCodes.findIndex(promo => promo.id === promoId);
    
    if (promoIndex === -1) {
      return res.status(404).json({ success: false, error: 'Promo code not found' });
    }
    
    promoCodes[promoIndex].active = Boolean(active);
    promoCodes[promoIndex].updatedAt = new Date().toISOString();
    
    const success = await writePromoData(promoCodes);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to update promo code' });
    }
    
    res.json({ success: true, promoCode: promoCodes[promoIndex] });
  } catch (error) {
    console.error('Error toggling promo code:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle promo code' });
  }
});

// Delete promo code
router.delete('/:id', async (req, res) => {
  try {
    const promoId = parseInt(req.params.id);
    
    const promoCodes = await readPromoData();
    const promoIndex = promoCodes.findIndex(promo => promo.id === promoId);
    
    if (promoIndex === -1) {
      return res.status(404).json({ success: false, error: 'Promo code not found' });
    }
    
    const deletedPromo = promoCodes.splice(promoIndex, 1)[0];
    
    const success = await writePromoData(promoCodes);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to delete promo code' });
    }
    
    res.json({ success: true, deletedPromo });
  } catch (error) {
    console.error('Error deleting promo code:', error);
    res.status(500).json({ success: false, error: 'Failed to delete promo code' });
  }
});

module.exports = router;