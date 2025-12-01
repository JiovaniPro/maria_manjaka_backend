const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

// Créer une instance unique de Prisma Client
const prisma = new PrismaClient({
    log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'query', emit: 'event' }
    ],
});

// Logger les événements Prisma
prisma.$on('warn', (e) => {
    logger.warn(`Prisma Warning: ${e.message}`);
});

prisma.$on('error', (e) => {
    logger.error(`Prisma Error: ${e.message}`);
});

prisma.$on('info', (e) => {
    logger.info(`Prisma Info: ${e.message}`);
});

prisma.$on('query', (e) => {
    if (process.env.NODE_ENV === 'development') {
        logger.debug(`Query: ${e.query} - Duration: ${e.duration}ms`);
    }
});

// Gestion de la fermeture propre
process.on('beforeExit', async () => {
    await prisma.$disconnect();
    logger.info('Prisma déconnecté');
});

module.exports = prisma;
