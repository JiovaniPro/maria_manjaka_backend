const express = require('express');
const router = express.Router();
const {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
} = require('../controllers/categorieController');
const { authMiddleware } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/auditLog');
const { cacheMiddleware } = require('../middleware/cache');
const { createCacheInvalidation } = require('../middleware/cacheInvalidation');

router.use(authMiddleware);
router.use(auditMiddleware());

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Obtenir toutes les catégories
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [RECETTE, DEPENSE]
 *       - in: query
 *         name: statut
 *         schema:
 *           type: string
 *           enum: [ACTIF, INACTIF]
 *     responses:
 *       200:
 *         description: Liste des catégories
 */
// Cache pour les routes GET (10 minutes - données statiques)
router.get('/', cacheMiddleware(10 * 60 * 1000), getAllCategories);
router.get('/:id', cacheMiddleware(10 * 60 * 1000), getCategoryById);
router.post('/', createCacheInvalidation('GET_/api/categories'), createCategory);
router.put('/:id', createCacheInvalidation(
    'GET_/api/categories',
    'GET_/api/categories/:id'
), updateCategory);
router.delete('/:id', createCacheInvalidation(
    'GET_/api/categories',
    'GET_/api/categories/:id'
), deleteCategory);

module.exports = router;
