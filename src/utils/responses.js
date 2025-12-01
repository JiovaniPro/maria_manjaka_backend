/**
 * Fonctions utilitaires pour standardiser les réponses API
 */

/**
 * Réponse de succès standard
 * @param {Object} res - Objet response Express
 * @param {Object} data - Données à retourner
 * @param {String} message - Message de succès
 * @param {Number} statusCode - Code HTTP (défaut: 200)
 */
const successResponse = (res, data = null, message = 'Opération réussie', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

/**
 * Réponse d'erreur standard
 * @param {Object} res - Objet response Express
 * @param {String} message - Message d'erreur
 * @param {Number} statusCode - Code HTTP (défaut: 500)
 * @param {Object} errors - Détails des erreurs (optionnel)
 */
const errorResponse = (res, message = 'Une erreur est survenue', statusCode = 500, errors = null) => {
    const response = {
        success: false,
        message
    };

    if (errors) {
        response.errors = errors;
    }

    return res.status(statusCode).json(response);
};

/**
 * Réponse de validation échouée
 * @param {Object} res - Objet response Express
 * @param {Object} errors - Erreurs de validation
 */
const validationErrorResponse = (res, errors) => {
    return errorResponse(res, 'Erreur de validation', 400, errors);
};

/**
 * Réponse non autorisé
 * @param {Object} res - Objet response Express
 * @param {String} message - Message personnalisé
 */
const unauthorizedResponse = (res, message = 'Non autorisé') => {
    return errorResponse(res, message, 401);
};

/**
 * Réponse ressource non trouvée
 * @param {Object} res - Objet response Express
 * @param {String} resource - Nom de la ressource
 */
const notFoundResponse = (res, resource = 'Ressource') => {
    return errorResponse(res, `${resource} non trouvé(e)`, 404);
};

module.exports = {
    successResponse,
    errorResponse,
    validationErrorResponse,
    unauthorizedResponse,
    notFoundResponse
};
