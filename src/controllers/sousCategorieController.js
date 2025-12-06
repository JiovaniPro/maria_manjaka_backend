const prisma = require('../config/database');
const { successResponse, errorResponse, notFoundResponse } = require('../utils/responses');
const logger = require('../utils/logger');

/**
 * @desc    Obtenir toutes les sous-catégories d'une catégorie
 * @route   GET /api/sous-categories?categorieId=:id
 * @access  Private
 */
const getAllSousCategories = async (req, res, next) => {
    try {
        const { categorieId, statut } = req.query;

        const where = {};
        if (categorieId) where.categorieId = parseInt(categorieId);
        if (statut) where.statut = statut;

        const sousCategories = await prisma.sousCategorie.findMany({
            where,
            include: {
                categorie: {
                    select: {
                        id: true,
                        nom: true,
                        type: true
                    }
                },
                _count: {
                    select: {
                        transactions: true
                    }
                }
            },
            orderBy: { nom: 'asc' }
        });

        return successResponse(res, sousCategories, 'Sous-catégories récupérées avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir une sous-catégorie par ID
 * @route   GET /api/sous-categories/:id
 * @access  Private
 */
const getSousCategorieById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const sousCategorie = await prisma.sousCategorie.findUnique({
            where: { id: parseInt(id) },
            include: {
                categorie: true,
                transactions: {
                    take: 10,
                    orderBy: { dateTransaction: 'desc' }
                }
            }
        });

        if (!sousCategorie) {
            return notFoundResponse(res, 'Sous-catégorie');
        }

        return successResponse(res, sousCategorie, 'Sous-catégorie récupérée avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Créer une nouvelle sous-catégorie
 * @route   POST /api/sous-categories
 * @access  Private
 */
const createSousCategorie = async (req, res, next) => {
    try {
        const { nom, categorieId, statut } = req.body;

        if (!nom || !categorieId) {
            return errorResponse(res, 'Le nom et la catégorie sont requis', 400);
        }

        // Vérifier que la catégorie existe
        const categorie = await prisma.categorie.findUnique({
            where: { id: parseInt(categorieId) }
        });

        if (!categorie) {
            return notFoundResponse(res, 'Catégorie');
        }

        const sousCategorie = await prisma.sousCategorie.create({
            data: {
                nom,
                categorieId: parseInt(categorieId),
                statut: statut || 'ACTIF'
            },
            include: {
                categorie: {
                    select: {
                        id: true,
                        nom: true,
                        type: true
                    }
                }
            }
        });

        logger.info(`Sous-catégorie créée: ${sousCategorie.nom} pour la catégorie ${categorie.nom} par l'utilisateur ${req.user.id}`);

        return successResponse(res, sousCategorie, 'Sous-catégorie créée avec succès', 201);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Mettre à jour une sous-catégorie
 * @route   PUT /api/sous-categories/:id
 * @access  Private
 */
const updateSousCategorie = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nom, statut } = req.body;

        // Vérifier que la sous-catégorie existe
        const existingSousCategorie = await prisma.sousCategorie.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingSousCategorie) {
            return notFoundResponse(res, 'Sous-catégorie');
        }

        const updateData = {};
        if (nom) updateData.nom = nom;
        if (statut) updateData.statut = statut;

        const sousCategorie = await prisma.sousCategorie.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                categorie: {
                    select: {
                        id: true,
                        nom: true,
                        type: true
                    }
                }
            }
        });

        logger.info(`Sous-catégorie mise à jour: ID ${id} par l'utilisateur ${req.user.id}`);

        return successResponse(res, sousCategorie, 'Sous-catégorie mise à jour avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Supprimer une sous-catégorie
 * @route   DELETE /api/sous-categories/:id
 * @access  Private
 */
const deleteSousCategorie = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Vérifier s'il y a des transactions associées
        const transactionCount = await prisma.transaction.count({
            where: { sousCategorieId: parseInt(id) }
        });

        if (transactionCount > 0) {
            return errorResponse(
                res,
                'Impossible de supprimer cette sous-catégorie car elle est utilisée dans des transactions',
                400
            );
        }

        await prisma.sousCategorie.delete({
            where: { id: parseInt(id) }
        });

        logger.info(`Sous-catégorie supprimée: ID ${id} par l'utilisateur ${req.user.id}`);

        return successResponse(res, null, 'Sous-catégorie supprimée avec succès');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllSousCategories,
    getSousCategorieById,
    createSousCategorie,
    updateSousCategorie,
    deleteSousCategorie
};

