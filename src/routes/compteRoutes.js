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
const { cacheMiddleware } = require('../middleware/cache');
const { createCacheInvalidation } = require('../middleware/cacheInvalidation');

router.use(authMiddleware);
router.use(auditMiddleware());

// Cache pour les routes GET (30 secondes pour les comptes - données critiques qui changent souvent)
router.get('/', cacheMiddleware(30 * 1000), getAllComptes);
router.get('/:id', cacheMiddleware(30 * 1000), getCompteById);
router.get('/:id/solde', cacheMiddleware(10 * 1000), getCompteSolde); // 10 secondes pour les soldes
router.get('/:id/mouvements', cacheMiddleware(1 * 60 * 1000), getCompteMouvements); // 1 minute pour les mouvements

// Routes de mutation avec invalidation du cache
router.post('/', createCacheInvalidation('GET_/api/comptes'), createCompte);
router.put('/:id', createCacheInvalidation(
    'GET_/api/comptes',
    'GET_/api/comptes/:id'
), updateCompte);
router.delete('/:id', createCacheInvalidation(
    'GET_/api/comptes',
    'GET_/api/comptes/:id'
), deleteCompte);

module.exports = router;
