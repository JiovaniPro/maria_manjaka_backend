const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// ====================================
// MIDDLEWARES GLOBAUX
// ====================================

// Sécurité - Helmet
app.use(helmet());

// CORS - Autoriser le frontend
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parser JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting optimisé
const {
    globalLimiter,
    authLimiter,
    mutationLimiter,
    heavyRequestLimiter,
} = require('./middleware/rateLimiter');

// Rate limiting global (plus permissif)
app.use('/api/', globalLimiter);

// Rate limiting pour l'authentification (strict)
// (appliqué dans authRoutes)

// Logger les requêtes
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// ====================================
// SWAGGER DOCUMENTATION
// ====================================

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Gestion Maria Manjaka API',
            version: '1.0.0',
            description: 'API REST pour la gestion financière de l\'église Maria Manjaka',
            contact: {
                name: 'API Support',
                email: 'support@mariamanjaka.com'
            }
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 5000}/api`,
                description: 'Serveur de développement'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
        },
        security: [{
            bearerAuth: []
        }]
    },
    apis: ['./src/routes/*.js'] // Chemins vers les routes avec annotations Swagger
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ====================================
// ROUTES
// ====================================

// Route de santé
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API fonctionnelle',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Routes API
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const categorieRoutes = require('./routes/categorieRoutes');
const sousCategorieRoutes = require('./routes/sousCategorieRoutes');
const compteRoutes = require('./routes/compteRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const transactionBancaireRoutes = require('./routes/transactionBancaireRoutes');
const parametreRoutes = require('./routes/parametreRoutes');
const auditRoutes = require('./routes/auditRoutes');

// Appliquer les rate limiters spécifiques
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/transactions/stats', heavyRequestLimiter);
app.use('/api/transactions', mutationLimiter);
app.use('/api/transactions-bancaires', mutationLimiter);
app.use('/api/categories', mutationLimiter);
app.use('/api/sous-categories', mutationLimiter);
app.use('/api/comptes', mutationLimiter);
app.use('/api/users', userRoutes);
app.use('/api/categories', categorieRoutes);
app.use('/api/sous-categories', sousCategorieRoutes);
app.use('/api/comptes', compteRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/transactions-bancaires', transactionBancaireRoutes);
app.use('/api/parametres', parametreRoutes);
app.use('/api/audit', auditRoutes);

// ====================================
// GESTION DES ERREURS
// ====================================

// Route non trouvée (404)
app.use(notFoundHandler);

// Gestionnaire d'erreurs global
app.use(errorHandler);

module.exports = app;
