const prisma = require('../config/database');
const { successResponse, errorResponse, notFoundResponse } = require('../utils/responses');
const logger = require('../utils/logger');

/**
 * @desc    Obtenir tous les paramètres
 * @route   GET /api/parametres
 * @access  Private
 */
const getAllParametres = async (req, res, next) => {
    try {
        const parametres = await prisma.parametre.findMany({
            orderBy: { cle: 'asc' }
        });

        return successResponse(res, parametres, 'Paramètres récupérés avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir un paramètre par clé
 * @route   GET /api/parametres/:cle
 * @access  Private
 */
const getParametreByCle = async (req, res, next) => {
    try {
        const { cle } = req.params;

        const parametre = await prisma.parametre.findUnique({
            where: { cle }
        });

        if (!parametre) {
            return notFoundResponse(res, 'Paramètre');
        }

        return successResponse(res, parametre, 'Paramètre récupéré avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Créer ou mettre à jour un paramètre
 * @route   POST /api/parametres
 * @access  Private
 */
const upsertParametre = async (req, res, next) => {
    try {
        const { cle, valeur, description } = req.body;

        if (!cle || !valeur) {
            return errorResponse(res, 'La clé et la valeur sont requises', 400);
        }

        const parametre = await prisma.parametre.upsert({
            where: { cle },
            update: {
                valeur,
                description: description || null
            },
            create: {
                cle,
                valeur,
                description: description || null
            }
        });

        logger.info(`Paramètre upsert: ${cle} by user ${req.user.id}`);

        return successResponse(res, parametre, 'Paramètre enregistré avec succès', 201);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Mettre à jour un paramètre
 * @route   PUT /api/parametres/:cle
 * @access  Private
 */
const updateParametre = async (req, res, next) => {
    try {
        const { cle } = req.params;
        const { valeur, description } = req.body;

        const updateData = {};
        if (valeur !== undefined) updateData.valeur = valeur;
        if (description !== undefined) updateData.description = description;

        const parametre = await prisma.parametre.update({
            where: { cle },
            data: updateData
        });

        logger.info(`Paramètre updated: ${cle} by user ${req.user.id}`);

        return successResponse(res, parametre, 'Paramètre mis à jour avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Supprimer un paramètre
 * @route   DELETE /api/parametres/:cle
 * @access  Private
 */
const deleteParametre = async (req, res, next) => {
    try {
        const { cle } = req.params;

        await prisma.parametre.delete({
            where: { cle }
        });

        logger.info(`Paramètre deleted: ${cle} by user ${req.user.id}`);

        return successResponse(res, null, 'Paramètre supprimé avec succès');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllParametres,
    getParametreByCle,
    upsertParametre,
    updateParametre,
    deleteParametre
};
