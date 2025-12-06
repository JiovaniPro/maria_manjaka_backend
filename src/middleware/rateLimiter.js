/**
 * Rate Limiter optimisé avec :
 * - Limites adaptatives selon l'environnement
 * - Gestion intelligente des erreurs 429
 * - Headers informatifs
 * - Support pour whitelist IP
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Configuration selon l'environnement
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Limites par environnement
const RATE_LIMITS = {
  development: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requêtes en dev (plus permissif)
    message: 'Trop de requêtes en développement. Limite: 1000/15min',
  },
  production: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requêtes en production
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
  },
  test: {
    windowMs: 15 * 60 * 1000,
    max: 10000, // Très permissif en test
    message: 'Rate limit en mode test',
  },
};

// IPs whitelistées (ex: localhost, IPs internes)
const WHITELIST_IPS = [
  '127.0.0.1',
  '::1',
  'localhost',
  ...(process.env.WHITELIST_IPS ? process.env.WHITELIST_IPS.split(',') : []),
];

/**
 * Obtenir l'IP réelle du client
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

/**
 * Vérifier si une IP est whitelistée
 */
function isWhitelisted(ip) {
  return WHITELIST_IPS.includes(ip);
}

/**
 * Rate limiter global optimisé
 */
const globalLimiter = rateLimit({
  windowMs: isDevelopment
    ? RATE_LIMITS.development.windowMs
    : RATE_LIMITS.production.windowMs,
  max: isDevelopment
    ? RATE_LIMITS.development.max
    : RATE_LIMITS.production.max,
  message: (req, res) => {
    const ip = getClientIP(req);
    logger.warn(`Rate limit atteint pour IP: ${ip}`);
    return {
      success: false,
      message: isDevelopment
        ? RATE_LIMITS.development.message
        : RATE_LIMITS.production.message,
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    };
  },
  standardHeaders: true, // Retourne les headers `RateLimit-*`
  legacyHeaders: false, // Désactive les headers `X-RateLimit-*`
  skip: (req) => {
    // Skip pour les IPs whitelistées
    const ip = getClientIP(req);
    return isWhitelisted(ip);
  },
  handler: (req, res) => {
    const ip = getClientIP(req);
    logger.warn(`Rate limit dépassé - IP: ${ip}, Path: ${req.path}`);
    
    res.status(429).json({
      success: false,
      message: isDevelopment
        ? RATE_LIMITS.development.message
        : RATE_LIMITS.production.message,
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000),
      limit: req.rateLimit.limit,
      remaining: req.rateLimit.remaining,
    });
  },
});

/**
 * Rate limiter strict pour l'authentification
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives par 15 minutes
  message: {
    success: false,
    message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes.',
  },
  skipSuccessfulRequests: true, // Ne pas compter les connexions réussies
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const ip = getClientIP(req);
    logger.warn(`Rate limit auth dépassé - IP: ${ip}`);
    
    res.status(429).json({
      success: false,
      message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes.',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000),
    });
  },
});

/**
 * Rate limiter pour les opérations sensibles (modification, suppression)
 */
const mutationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 mutations par minute
  message: {
    success: false,
    message: 'Trop de modifications, veuillez ralentir.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isWhitelisted(getClientIP(req)),
});

/**
 * Rate limiter pour les requêtes lourdes (stats, exports)
 */
const heavyRequestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requêtes lourdes par 5 minutes
  message: {
    success: false,
    message: 'Trop de requêtes lourdes, veuillez patienter.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isWhitelisted(getClientIP(req)),
});

module.exports = {
  globalLimiter,
  authLimiter,
  mutationLimiter,
  heavyRequestLimiter,
  getClientIP,
  isWhitelisted,
};

