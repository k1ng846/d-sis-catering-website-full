const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Helper functions
async function readOffersData() {
  try {
    const offersPath = path.join(__dirname, '../data/offers.json');
    const data = await fs.readFile(offersPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading offers data:', error);
    return [];
  }
}

async function writeOffersData(offers) {
  try {
    const offersPath = path.join(__dirname, '../data/offers.json');
    await fs.writeFile(offersPath, JSON.stringify(offers, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing offers data:', error);
    return false;
  }
}

// Get all offers
router.get('/', async (req, res) => {
  try {
    const offers = await readOffersData();
    res.json({ success: true, offers });
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch offers' });
  }
});

// Get active offers only (for public page)
router.get('/active', async (req, res) => {
  try {
    const offers = await readOffersData();
    const now = new Date();
    
    const activeOffers = offers.filter(offer => {
      if (!offer.active) return false;
      
      const startDate = offer.startAt ? new Date(offer.startAt) : new Date(0);
      const endDate = offer.endAt ? new Date(offer.endAt) : new Date('2099-12-31');
      
      return now >= startDate && now <= endDate;
    });
    
    res.json({ success: true, offers: activeOffers });
  } catch (error) {
    console.error('Error fetching active offers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch active offers' });
  }
});

// Create new offer
router.post('/', async (req, res) => {
  try {
    const { title, description, benefits, imageData, imageFileName, startAt, endAt, active = true } = req.body;
    
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    
    const offers = await readOffersData();
    
    // Generate new ID
    const newId = offers.length > 0 ? Math.max(...offers.map(o => o.id || 0)) + 1 : 1;
    
    const newOffer = {
      id: newId,
      title: title.trim(),
      description: description || '',
      benefits: benefits || '',
      imageUrl: imageData || '', // Store base64 data directly for now
      imageFileName: imageFileName || '',
      startAt: startAt || new Date().toISOString(),
      endAt: endAt || null,
      active: Boolean(active),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    offers.push(newOffer);
    
    const success = await writeOffersData(offers);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to save offer' });
    }
    
    res.status(201).json({ success: true, offer: newOffer });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ success: false, error: 'Failed to create offer' });
  }
});

// Update offer
router.put('/:id', async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);
    const updates = req.body;
    
    const offers = await readOffersData();
    const offerIndex = offers.findIndex(offer => offer.id === offerId);
    
    if (offerIndex === -1) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }
    
    // Update offer with new data
    const currentOffer = offers[offerIndex];
    const updatedOffer = {
      ...currentOffer,
      ...updates,
      id: offerId, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };
    
    offers[offerIndex] = updatedOffer;
    
    const success = await writeOffersData(offers);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to save offer' });
    }
    
    res.json({ success: true, offer: updatedOffer });
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({ success: false, error: 'Failed to update offer' });
  }
});

// Delete offer
router.delete('/:id', async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);
    
    const offers = await readOffersData();
    const offerIndex = offers.findIndex(offer => offer.id === offerId);
    
    if (offerIndex === -1) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }
    
    const deletedOffer = offers.splice(offerIndex, 1)[0];
    
    const success = await writeOffersData(offers);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to delete offer' });
    }
    
    res.json({ success: true, deletedOffer });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ success: false, error: 'Failed to delete offer' });
  }
});

module.exports = router;