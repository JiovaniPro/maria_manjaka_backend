/**
 * Middleware de cache simple en mémoire pour réduire les appels DB
 * Pour production, utiliser Redis
 */

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes par défaut

/**
 * Middleware de cache pour les routes GET
 */
const cacheMiddleware = (ttl = CACHE_TTL) => {
    return (req, res, next) => {
        // Ne cacher que les requêtes GET
        if (req.method !== 'GET') {
            return next();
        }

        // Créer une clé de cache basée sur l'URL et les query params
        const cacheKey = `${req.originalUrl}_${JSON.stringify(req.query)}`;
        const cached = cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < ttl) {
            // Retourner la réponse en cache
            return res.json(cached.data);
        }

        // Sauvegarder la fonction res.json originale
        const originalJson = res.json.bind(res);

        // Override res.json pour mettre en cache
        res.json = function(data) {
            cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
            return originalJson(data);
        };

        next();
    };
};

/**
 * Invalider le cache pour un pattern donné
 */
const invalidateCache = (pattern) => {
    const regex = new RegExp(pattern);
    for (const key of cache.keys()) {
        if (regex.test(key)) {
            cache.delete(key);
        }
    }
};

/**
 * Nettoyer le cache expiré
 */
const cleanupCache = () => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            cache.delete(key);
        }
    }
};

// Nettoyage automatique toutes les 10 minutes
setInterval(cleanupCache, 10 * 60 * 1000);

module.exports = {
    cacheMiddleware,
    invalidateCache,
    cleanupCache
};

