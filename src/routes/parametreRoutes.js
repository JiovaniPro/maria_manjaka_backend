const express = require('express');
const router = express.Router();
const {
    getAllParametres,
    getParametreByCle,
    upsertParametre,
    updateParametre,
    deleteParametre
} = require('../controllers/parametreController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getAllParametres);
router.get('/:cle', getParametreByCle);
router.post('/', upsertParametre);
router.put('/:cle', updateParametre);
router.delete('/:cle', deleteParametre);

module.exports = router;
