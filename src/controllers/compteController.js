const prisma = require('../config/database');
const { successResponse, errorResponse, notFoundResponse } = require('../utils/responses');
const logger = require('../utils/logger');

/**
 * @desc    Obtenir tous les comptes
 * @route   GET /api/comptes
 * @access  Private
 */
const getAllComptes = async (req, res, next) => {
    try {
        const { type } = req.query;

        const where = {};
        if (type) where.type = type;

        const comptes = await prisma.compte.findMany({
            where,
            orderBy: { nom: 'asc' }
        });

        return successResponse(res, comptes, 'Comptes récupérés avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir un compte par ID
 * @route   GET /api/comptes/:id
 * @access  Private
 */
const getCompteById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const compte = await prisma.compte.findUnique({
            where: { id: parseInt(id) }
        });

        if (!compte) {
            return notFoundResponse(res, 'Compte');
        }

        return successResponse(res, compte, 'Compte récupéré avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir le solde d'un compte
 * @route   GET /api/comptes/:id/solde
 * @access  Private
 */
const getCompteSolde = async (req, res, next) => {
    try {
        const { id } = req.params;

        const compte = await prisma.compte.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                nom: true,
                type: true,
                soldeActuel: true,
                updatedAt: true
            }
        });

        if (!compte) {
            return notFoundResponse(res, 'Compte');
        }

        return successResponse(res, compte, 'Solde récupéré avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir les mouvements d'un compte
 * @route   GET /api/comptes/:id/mouvements
 * @access  Private
 */
const getCompteMouvements = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { limit = 50 } = req.query;

        const [transactions, transactionsBancaires] = await Promise.all([
            prisma.transaction.findMany({
                where: { compteId: parseInt(id) },
                include: {
                    categorie: true,
                    user: {
                        select: { nom: true, email: true }
                    }
                },
                orderBy: { dateTransaction: 'desc' },
                take: parseInt(limit)
            }),
            prisma.transactionBancaire.findMany({
                where: { compteId: parseInt(id) },
                orderBy: { dateOperation: 'desc' },
                take: parseInt(limit)
            })
        ]);

        return successResponse(res, {
            transactions,
            transactionsBancaires
        }, 'Mouvements récupérés avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Créer un nouveau compte
 * @route   POST /api/comptes
 * @access  Private
 */
const createCompte = async (req, res, next) => {
    try {
        const { nom, type, soldeActuel } = req.body;

        if (!nom || !type) {
            return errorResponse(res, 'Le nom et le type sont requis', 400);
        }

        const compte = await prisma.compte.create({
            data: {
                nom,
                type,
                soldeActuel: soldeActuel || 0
            }
        });

        logger.info(`Compte created: ${compte.nom} by user ${req.user.id}`);

        return successResponse(res, compte, 'Compte créé avec succès', 201);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Mettre à jour un compte
 * @route   PUT /api/comptes/:id
 * @access  Private
 */
const updateCompte = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nom, type } = req.body;

        const updateData = {};
        if (nom) updateData.nom = nom;
        if (type) updateData.type = type;
        // Note: soldeActuel ne devrait pas être modifié manuellement, 
        // il est mis à jour automatiquement par les transactions

        const compte = await prisma.compte.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        logger.info(`Compte updated: ID ${id} by user ${req.user.id}`);

        return successResponse(res, compte, 'Compte mis à jour avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Supprimer un compte
 * @route   DELETE /api/comptes/:id
 * @access  Private
 */
const deleteCompte = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Vérifier les transactions associées
        const transactionCount = await prisma.transaction.count({
            where: { compteId: parseInt(id) }
        });

        if (transactionCount > 0) {
            return errorResponse(
                res,
                'Impossible de supprimer ce compte car il contient des transactions',
                400
            );
        }

        await prisma.compte.delete({
            where: { id: parseInt(id) }
        });

        logger.info(`Compte deleted: ID ${id} by user ${req.user.id}`);

        return successResponse(res, null, 'Compte supprimé avec succès');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllComptes,
    getCompteById,
    getCompteSolde,
    getCompteMouvements,
    createCompte,
    updateCompte,
    deleteCompte
};
