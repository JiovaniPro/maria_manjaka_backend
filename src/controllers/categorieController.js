const prisma = require('../config/database');
const { successResponse, errorResponse, notFoundResponse } = require('../utils/responses');
const logger = require('../utils/logger');

/**
 * @desc    Obtenir toutes les catégories
 * @route   GET /api/categories
 * @access  Private
 */
const getAllCategories = async (req, res, next) => {
    try {
        const { type, statut } = req.query;

        // Construire les filtres
        const where = {};
        if (type) where.type = type;
        if (statut) where.statut = statut;

        const categories = await prisma.categorie.findMany({
            where,
            orderBy: { nom: 'asc' }
        });

        return successResponse(res, categories, 'Catégories récupérées avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir une catégorie par ID
 * @route   GET /api/categories/:id
 * @access  Private
 */
const getCategoryById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const category = await prisma.categorie.findUnique({
            where: { id: parseInt(id) },
            include: {
                transactions: {
                    take: 10,
                    orderBy: { dateTransaction: 'desc' }
                }
            }
        });

        if (!category) {
            return notFoundResponse(res, 'Catégorie');
        }

        return successResponse(res, category, 'Catégorie récupérée avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Créer une nouvelle catégorie
 * @route   POST /api/categories
 * @access  Private
 */
const createCategory = async (req, res, next) => {
    try {
        const { nom, codeBudgetaire, type, statut } = req.body;

        if (!nom || !codeBudgetaire || !type) {
            return errorResponse(res, 'Le nom, code budgétaire et type sont requis', 400);
        }

        const category = await prisma.categorie.create({
            data: {
                nom,
                codeBudgetaire,
                type,
                statut: statut || 'ACTIF'
            }
        });

        logger.info(`Category created: ${category.nom} by user ${req.user.id}`);

        return successResponse(res, category, 'Catégorie créée avec succès', 201);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Mettre à jour une catégorie
 * @route   PUT /api/categories/:id
 * @access  Private
 */
const updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nom, codeBudgetaire, type, statut } = req.body;

        // Vérifier que la catégorie existe
        const existingCategory = await prisma.categorie.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingCategory) {
            return notFoundResponse(res, 'Catégorie');
        }

        // Si le code budgétaire est modifié, vérifier qu'il n'existe pas déjà (sauf pour cette catégorie)
        if (codeBudgetaire && codeBudgetaire !== existingCategory.codeBudgetaire) {
            const duplicate = await prisma.categorie.findFirst({
                where: {
                    codeBudgetaire: codeBudgetaire,
                    id: { not: parseInt(id) }
                }
            });

            if (duplicate) {
                return errorResponse(
                    res,
                    `Le code budgétaire "${codeBudgetaire}" est déjà utilisé par une autre catégorie`,
                    409
                );
            }
        }

        const updateData = {};
        if (nom) updateData.nom = nom;
        if (codeBudgetaire) updateData.codeBudgetaire = codeBudgetaire;
        if (type) updateData.type = type;
        if (statut) updateData.statut = statut;

        const category = await prisma.categorie.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        logger.info(`Category updated: ID ${id} by user ${req.user.id}`);

        return successResponse(res, category, 'Catégorie mise à jour avec succès');
    } catch (error) {
        // Gérer les erreurs Prisma (comme les contraintes d'unicité)
        if (error.code === 'P2002') {
            return errorResponse(
                res,
                'Ce code budgétaire est déjà utilisé par une autre catégorie',
                409
            );
        }
        next(error);
    }
};

/**
 * @desc    Supprimer une catégorie
 * @route   DELETE /api/categories/:id
 * @access  Private
 */
const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Vérifier s'il y a des transactions associées
        const transactionCount = await prisma.transaction.count({
            where: { categorieId: parseInt(id) }
        });

        if (transactionCount > 0) {
            return errorResponse(
                res,
                'Impossible de supprimer cette catégorie car elle est utilisée dans des transactions',
                400
            );
        }

        await prisma.categorie.delete({
            where: { id: parseInt(id) }
        });

        logger.info(`Category deleted: ID ${id} by user ${req.user.id}`);

        return successResponse(res, null, 'Catégorie supprimée avec succès');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
};
