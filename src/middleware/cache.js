/**
 * Middleware de cache optimisé avec :
 * - Cache en mémoire (production: utiliser Redis)
 * - TTL configurable
 * - Invalidation par pattern
 * - Nettoyage automatique
 * - Support pour les requêtes GET uniquement
 */

const logger = require('../utils/logger');

// Cache en mémoire (pour production, utiliser Redis)
const cache = new Map();

// Configuration
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes par défaut
const MAX_CACHE_SIZE = 1000; // Maximum 1000 entrées en cache

/**
 * Génère une clé de cache unique
 */
function generateCacheKey(req) {
  const queryString = JSON.stringify(req.query || {});
  const path = req.originalUrl || req.path;
  return `${req.method}_${path}_${queryString}`;
}

/**
 * Middleware de cache pour les routes GET
 */
const cacheMiddleware = (ttl = DEFAULT_TTL) => {
  return (req, res, next) => {
    // Ne cacher que les requêtes GET
    if (req.method !== 'GET') {
      return next();
    }

    // Ne pas cacher les requêtes d'authentification
    if (req.path.includes('/auth') || req.path.includes('/login')) {
      return next();
    }

    const cacheKey = generateCacheKey(req);
    const cached = cache.get(cacheKey);

    // Vérifier si le cache est valide
    if (cached && Date.now() - cached.timestamp < ttl) {
      logger.debug(`Cache hit: ${cacheKey}`);
      return res.json(cached.data);
    }

    // Si le cache est expiré, le supprimer
    if (cached) {
      cache.delete(cacheKey);
    }

    // Sauvegarder la fonction res.json originale
    const originalJson = res.json.bind(res);

    // Override res.json pour mettre en cache
    res.json = function(data) {
      // Ne mettre en cache que les réponses réussies
      if (res.statusCode === 200 && data.success !== false) {
        // Limiter la taille du cache
        if (cache.size >= MAX_CACHE_SIZE) {
          // Supprimer les entrées les plus anciennes
          const oldestKey = cache.keys().next().value;
          cache.delete(oldestKey);
        }

        cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });
        
        logger.debug(`Cache set: ${cacheKey}`);
      }
      
      return originalJson(data);
    };

    next();
  };
};

/**
 * Invalider le cache pour un pattern donné
 */
function invalidateCache(pattern) {
  const regex = new RegExp(pattern);
  let count = 0;
  
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
      count++;
    }
  }
  
  logger.info(`Cache invalidated: ${count} entries for pattern "${pattern}"`);
  return count;
}

/**
 * Invalider tout le cache
 */
function clearCache() {
  const size = cache.size;
  cache.clear();
  logger.info(`Cache cleared: ${size} entries removed`);
  return size;
}

/**
 * Nettoyer le cache expiré
 */
function cleanupCache() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > DEFAULT_TTL) {
      cache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug(`Cache cleanup: ${cleaned} expired entries removed`);
  }
  
  return cleaned;
}

/**
 * Obtenir les statistiques du cache
 */
function getCacheStats() {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    entries: Array.from(cache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
      size: JSON.stringify(value.data).length,
    })),
  };
}

// Nettoyage automatique toutes les 10 minutes
setInterval(cleanupCache, 10 * 60 * 1000);

module.exports = {
  cacheMiddleware,
  invalidateCache,
  clearCache,
  cleanupCache,
  getCacheStats,
};
