const logger = require('../utils/logger');
const { errorResponse } = require('../utils/responses');

/**
 * Middleware global de gestion des erreurs
 * Doit être placé en dernier dans la chaîne de middlewares Express
 */
const errorHandler = (err, req, res, next) => {
    // Logger l'erreur
    logger.error(`Error: ${err.message}`, {
        path: req.path,
        method: req.method,
        stack: err.stack,
        body: req.body
    });

    // Erreur Prisma - violation de contrainte unique
    if (err.code === 'P2002') {
        return errorResponse(
            res,
            `Cette valeur existe déjà pour le champ: ${err.meta?.target?.join(', ')}`,
            409
        );
    }

    // Erreur Prisma - enregistrement non trouvé
    if (err.code === 'P2025') {
        return errorResponse(res, 'Ressource non trouvée', 404);
    }

    // Erreur Prisma - relation manquante
    if (err.code === 'P2003') {
        return errorResponse(
            res,
            'Impossible de supprimer cette ressource car elle est utilisée ailleurs',
            400
        );
    }

    // Erreur de validation Joi
    if (err.isJoi) {
        return errorResponse(
            res,
            'Erreur de validation',
            400,
            err.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }))
        );
    }

    // Erreur JWT - token invalide
    if (err.name === 'JsonWebTokenError') {
        return errorResponse(res, 'Token invalide', 401);
    }

    // Erreur JWT - token expiré
    if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'Token expiré', 401);
    }

    // Erreur par défaut
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Erreur interne du serveur';

    return errorResponse(res, message, statusCode);
};

/**
 * Middleware pour gérer les routes non trouvées
 */
const notFoundHandler = (req, res, next) => {
    return errorResponse(
        res,
        `La route ${req.method} ${req.originalUrl} n'existe pas`,
        404
    );
};

module.exports = { errorHandler, notFoundHandler };
