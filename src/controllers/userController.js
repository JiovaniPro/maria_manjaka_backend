const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { successResponse, errorResponse, notFoundResponse } = require('../utils/responses');
const logger = require('../utils/logger');

/**
 * @desc    Obtenir tous les utilisateurs
 * @route   GET /api/users
 * @access  Private
 */
const getAllUsers = async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                nom: true,
                role: true,
                compteSecretaireId: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return successResponse(res, users, 'Utilisateurs récupérés avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir un utilisateur par ID
 * @route   GET /api/users/:id
 * @access  Private
 */
const getUserById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                email: true,
                nom: true,
                role: true,
                compteSecretaireId: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!user) {
            return notFoundResponse(res, 'Utilisateur');
        }

        return successResponse(res, user, 'Utilisateur récupéré avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Créer un nouvel utilisateur
 * @route   POST /api/users
 * @access  Private
 */
const createUser = async (req, res, next) => {
    try {
        const { email, motDePasse, nom } = req.body;

        // Validation simple
        if (!email || !motDePasse || !nom) {
            return errorResponse(res, 'Tous les champs sont requis', 400);
        }

        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(motDePasse, 10);

        const user = await prisma.user.create({
            data: {
                email,
                motDePasse: hashedPassword,
                nom
            },
            select: {
                id: true,
                email: true,
                nom: true,
                createdAt: true
            }
        });

        logger.info(`User created: ${user.email} by user ${req.user.id}`);

        return successResponse(res, user, 'Utilisateur créé avec succès', 201);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Mettre à jour un utilisateur
 * @route   PUT /api/users/:id
 * @access  Private
 */
const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { email, nom, motDePasse } = req.body;

        // Préparer les données à mettre à jour
        const updateData = {};
        if (email) updateData.email = email;
        if (nom) updateData.nom = nom;
        if (motDePasse) {
            updateData.motDePasse = await bcrypt.hash(motDePasse, 10);
        }

        const user = await prisma.user.update({
            where: { id: parseInt(id) },
            data: updateData,
            select: {
                id: true,
                email: true,
                nom: true,
                updatedAt: true
            }
        });

        logger.info(`User updated: ID ${id} by user ${req.user.id}`);

        return successResponse(res, user, 'Utilisateur mis à jour avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Supprimer un utilisateur
 * @route   DELETE /api/users/:id
 * @access  Private
 */
const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.user.delete({
            where: { id: parseInt(id) }
        });

        logger.info(`User deleted: ID ${id} by user ${req.user.id}`);

        return successResponse(res, null, 'Utilisateur supprimé avec succès');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
};
