const express = require('express');
const router = express.Router();
const {
    getAllTransactions,
    getTransactionById,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    getTransactionStats
} = require('../controllers/transactionController');
const { authMiddleware } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/auditLog');
const { cacheMiddleware } = require('../middleware/cache');
const { createCacheInvalidation } = require('../middleware/cacheInvalidation');

router.use(authMiddleware);
router.use(auditMiddleware());

// Stats doit être avant /:id pour éviter de matcher "stats" comme un ID
// Cache court pour les stats (1 minute - données dynamiques)
router.get('/stats', cacheMiddleware(1 * 60 * 1000), getTransactionStats);

// Cache court pour les transactions (1 minute - données dynamiques)
router.get('/', cacheMiddleware(1 * 60 * 1000), getAllTransactions);
router.get('/:id', cacheMiddleware(1 * 60 * 1000), getTransactionById);
router.post('/', createCacheInvalidation(
    'GET_/api/transactions',
    'GET_/api/transactions/stats',
    'GET_/api/comptes'
), createTransaction);
router.put('/:id', createCacheInvalidation(
    'GET_/api/transactions',
    'GET_/api/transactions/:id',
    'GET_/api/transactions/stats',
    'GET_/api/comptes'
), updateTransaction);
router.delete('/:id', createCacheInvalidation(
    'GET_/api/transactions',
    'GET_/api/transactions/:id',
    'GET_/api/transactions/stats',
    'GET_/api/comptes'
), deleteTransaction);

module.exports = router;
