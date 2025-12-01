const prisma = require('../config/database');
const { successResponse } = require('../utils/responses');

/**
 * @desc    Obtenir les logs d'audit
 * @route   GET /api/audit
 * @access  Private
 */
const getAuditLogs = async (req, res, next) => {
    try {
        const { userId, tableName, action, dateDebut, dateFin, limit = 100 } = req.query;

        // Construire les filtres
        const where = {};
        if (userId) where.userId = parseInt(userId);
        if (tableName) where.tableName = tableName.toUpperCase();
        if (action) where.action = action;

        if (dateDebut || dateFin) {
            where.createdAt = {};
            if (dateDebut) where.createdAt.gte = new Date(dateDebut);
            if (dateFin) where.createdAt.lte = new Date(dateFin);
        }

        const logs = await prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: { nom: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit)
        });

        return successResponse(res, logs, 'Logs d\'audit récupérés avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir les logs d'audit pour une table spécifique
 * @route   GET /api/audit/table/:tableName
 * @access  Private
 */
const getAuditLogsByTable = async (req, res, next) => {
    try {
        const { tableName } = req.params;
        const { recordId, limit = 50 } = req.query;

        const where = { tableName: tableName.toUpperCase() };
        if (recordId) where.recordId = parseInt(recordId);

        const logs = await prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: { nom: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit)
        });

        return successResponse(res, logs, `Logs d'audit pour ${tableName} récupérés avec succès`);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir les logs d'audit pour un utilisateur
 * @route   GET /api/audit/user/:userId
 * @access  Private
 */
const getAuditLogsByUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { limit = 50 } = req.query;

        const logs = await prisma.auditLog.findMany({
            where: { userId: parseInt(userId) },
            include: {
                user: {
                    select: { nom: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit)
        });

        return successResponse(res, logs, 'Logs d\'audit de l\'utilisateur récupérés avec succès');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAuditLogs,
    getAuditLogsByTable,
    getAuditLogsByUser
};
