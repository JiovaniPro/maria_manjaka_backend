const jwt = require('jsonwebtoken');
const { unauthorizedResponse } = require('../utils/responses');
const logger = require('../utils/logger');

/**
 * Middleware de vérification du token JWT
 * Protège les routes nécessitant une authentification
 */
const authMiddleware = async (req, res, next) => {
    try {
        // Récupérer le token du header Authorization
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return unauthorizedResponse(res, 'Token manquant. Veuillez vous connecter.');
        }

        // Extraire le token
        const token = authHeader.split(' ')[1];

        if (!token) {
            return unauthorizedResponse(res, 'Token invalide');
        }

        // Vérifier et décoder le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Ajouter les infos de l'utilisateur à la requête
        req.user = {
            id: decoded.id,
            email: decoded.email,
            nom: decoded.nom,
            role: decoded.role || 'ADMIN'
        };

        logger.info(`User authenticated: ${decoded.email} (ID: ${decoded.id})`);

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return unauthorizedResponse(res, 'Token expiré. Veuillez vous reconnecter.');
        }
        if (error.name === 'JsonWebTokenError') {
            return unauthorizedResponse(res, 'Token invalide');
        }
        return unauthorizedResponse(res, 'Authentification échouée');
    }
};

/**
 * Middleware optionnel - récupère l'utilisateur si le token existe
 * Mais ne bloque pas la requête si pas de token
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = {
                id: decoded.id,
                email: decoded.email,
                nom: decoded.nom
            };
        }

        next();
    } catch (error) {
        // En cas d'erreur, on continue sans utilisateur
        next();
    }
};

module.exports = { authMiddleware, optionalAuth };
