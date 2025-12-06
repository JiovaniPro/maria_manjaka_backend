/**
 * Middleware pour invalider le cache après les mutations
 */

const { invalidateCache } = require('./cache');

/**
 * Crée un middleware qui invalide le cache après une mutation réussie
 */
function createCacheInvalidation(...patterns) {
    return (req, res, next) => {
        // Sauvegarder la fonction res.json originale
        const originalJson = res.json.bind(res);
        
        // Override res.json pour invalider le cache après succès
        res.json = function(data) {
            // Invalider le cache seulement si la requête a réussi
            if (res.statusCode >= 200 && res.statusCode < 300) {
                patterns.forEach(pattern => {
                    // Remplacer les paramètres dynamiques dans le pattern
                    let finalPattern = pattern;
                    if (req.params) {
                        Object.keys(req.params).forEach(key => {
                            finalPattern = finalPattern.replace(`:${key}`, req.params[key]);
                        });
                    }
                    invalidateCache(finalPattern);
                });
            }
            
            return originalJson(data);
        };
        
        next();
    };
}

module.exports = {
    createCacheInvalidation,
};

