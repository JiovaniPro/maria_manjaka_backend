const express = require('express');
const router = express.Router();
const {
    getAuditLogs,
    getAuditLogsByTable,
    getAuditLogsByUser
} = require('../controllers/auditController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getAuditLogs);
router.get('/table/:tableName', getAuditLogsByTable);
router.get('/user/:userId', getAuditLogsByUser);

module.exports = router;
