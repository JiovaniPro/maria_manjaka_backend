const express = require('express');
const router = express.Router();
const {
    getAllSousCategories,
    getSousCategorieById,
    createSousCategorie,
    updateSousCategorie,
    deleteSousCategorie
} = require('../controllers/sousCategorieController');
const { authMiddleware } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/auditLog');
const { cacheMiddleware } = require('../middleware/cache');
const { createCacheInvalidation } = require('../middleware/cacheInvalidation');

router.use(authMiddleware);
router.use(auditMiddleware());

// Cache pour les routes GET (5 minutes)
router.get('/', cacheMiddleware(5 * 60 * 1000), getAllSousCategories);
router.get('/:id', cacheMiddleware(5 * 60 * 1000), getSousCategorieById);

// Routes de mutation avec invalidation du cache
router.post('/', createCacheInvalidation('GET_/api/sous-categories'), createSousCategorie);
router.put('/:id', createCacheInvalidation(
    'GET_/api/sous-categories',
    'GET_/api/sous-categories/:id'
), updateSousCategorie);
router.delete('/:id', createCacheInvalidation(
    'GET_/api/sous-categories',
    'GET_/api/sous-categories/:id'
), deleteSousCategorie);

module.exports = router;

