const express = require('express');
const router = express.Router();
const {
    getAllComptes,
    getCompteById,
    getCompteSolde,
    getCompteMouvements,
    createCompte,
    updateCompte,
    deleteCompte
} = require('../controllers/compteController');
const { authMiddleware } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/auditLog');

router.use(authMiddleware);
router.use(auditMiddleware());

router.get('/', getAllComptes);
router.get('/:id', getCompteById);
router.get('/:id/solde', getCompteSolde);
router.get('/:id/mouvements', getCompteMouvements);
router.post('/', createCompte);
router.put('/:id', updateCompte);
router.delete('/:id', deleteCompte);

module.exports = router;
