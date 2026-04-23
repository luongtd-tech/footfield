const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.get('/', notificationController.getAllNotifications);
router.get('/tenant/:tenantId', notificationController.getTenantNotifications);
router.post('/tenant/:tenantId/read-all', notificationController.markAsRead);
router.post('/', notificationController.createNotification);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
