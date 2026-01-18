const express = require('express');
const router = express.Router();
const {
    createCompteSecretaire,
    getAllComptesSecretaires,
    alimenterCompteSecretaire,
    transfererReste,
    getMonCompteSecretaire
} = require('../controllers/compteSecretaireController');
const { authMiddleware } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/auditLog');
const { cacheMiddleware } = require('../middleware/cache');
const { createCacheInvalidation } = require('../middleware/cacheInvalidation');

router.use(authMiddleware);
router.use(auditMiddleware());

// Route pour obtenir le compte secrétaire de l'utilisateur connecté (secrétaire)
router.get('/mon-compte', cacheMiddleware(10 * 1000), getMonCompteSecretaire);

// Routes admin
router.get('/', cacheMiddleware(30 * 1000), getAllComptesSecretaires);
router.post('/', createCacheInvalidation('GET_/api/comptes-secretaires', 'GET_/api/comptes'), createCompteSecretaire);
router.post('/:id/alimenter', createCacheInvalidation(
    'GET_/api/comptes-secretaires',
    'GET_/api/comptes-secretaires/:id',
    'GET_/api/comptes',
    'GET_/api/comptes/:id'
), alimenterCompteSecretaire);

// Route secrétaire
router.post('/:id/transferer-reste', createCacheInvalidation(
    'GET_/api/comptes-secretaires',
    'GET_/api/comptes-secretaires/mon-compte',
    'GET_/api/comptes',
    'GET_/api/comptes/:id'
), transfererReste);

module.exports = router;
