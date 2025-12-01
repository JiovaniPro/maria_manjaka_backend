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

router.use(authMiddleware);
router.use(auditMiddleware());

// Stats doit être avant /:id pour éviter de matcher "stats" comme un ID
router.get('/stats', getTransactionStats);

router.get('/', getAllTransactions);
router.get('/:id', getTransactionById);
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;
