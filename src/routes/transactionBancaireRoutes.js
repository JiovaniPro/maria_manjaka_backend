const express = require('express');
const router = express.Router();
const {
    getAllTransactionsBancaires,
    getTransactionBancaireById,
    createTransactionBancaire,
    updateTransactionBancaire,
    deleteTransactionBancaire
} = require('../controllers/transactionBancaireController');
const { authMiddleware } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/auditLog');

router.use(authMiddleware);
router.use(auditMiddleware());

router.get('/', getAllTransactionsBancaires);
router.get('/:id', getTransactionBancaireById);
router.post('/', createTransactionBancaire);
router.put('/:id', updateTransactionBancaire);
router.delete('/:id', deleteTransactionBancaire);

module.exports = router;
