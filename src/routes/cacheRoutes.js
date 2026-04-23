const express = require('express');
const router = express.Router();

// In-memory cache tracking (in production, use Redis)
const cacheTracker = new Map();

// Check if cache needs invalidation
router.post('/check', (req, res) => {
  const { tenant_id, timestamp } = req.body;
  
  if (!tenant_id) {
    return res.status(400).json({ message: 'tenant_id is required' });
  }
  
  const lastInvalidation = cacheTracker.get(tenant_id) || 0;
  const needsInvalidation = lastInvalidation > (timestamp || 0);
  
  res.json({
    invalidated: needsInvalidation,
    lastInvalidation
  });
});

// Invalidate cache for a tenant
router.post('/invalidate', (req, res) => {
  const { tenant_id, action } = req.body;
  
  if (!tenant_id) {
    return res.status(400).json({ message: 'tenant_id is required' });
  }
  
  const timestamp = Date.now();
  cacheTracker.set(tenant_id, timestamp);
  
  console.log(`Cache invalidated for tenant ${tenant_id} at ${timestamp} - Action: ${action || 'unknown'}`);
  
  res.json({ 
    success: true, 
    timestamp,
    message: 'Cache invalidated successfully'
  });
});

module.exports = router;
