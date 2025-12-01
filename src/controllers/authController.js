const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/responses');
const logger = require('../utils/logger');

/**
 * @desc    Connexion d'un utilisateur
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
    try {
        const { email, motDePasse } = req.body;

        // Validation
        if (!email || !motDePasse) {
            return validationErrorResponse(res, [
                { field: 'email', message: 'L\'email est requis' },
                { field: 'motDePasse', message: 'Le mot de passe est requis' }
            ]);
        }

        // Trouver l'utilisateur
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return errorResponse(res, 'Email ou mot de passe incorrect', 401);
        }

        // Vérifier le mot de passe
        const isPasswordValid = await bcrypt.compare(motDePasse, user.motDePasse);

        if (!isPasswordValid) {
            return errorResponse(res, 'Email ou mot de passe incorrect', 401);
        }

        // Générer le token JWT
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                nom: user.nom
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        logger.info(`User logged in: ${user.email}`);

        // Retourner le token et les infos utilisateur (sans le mot de passe)
        return successResponse(res, {
            token,
            user: {
                id: user.id,
                email: user.email,
                nom: user.nom,
                createdAt: user.createdAt
            }
        }, 'Connexion réussie');

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir les informations de l'utilisateur connecté
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                nom: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!user) {
            return errorResponse(res, 'Utilisateur non trouvé', 404);
        }

        return successResponse(res, user, 'Utilisateur récupéré avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Déconnexion (côté client principalement)
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res, next) => {
    try {
        logger.info(`User logged out: ${req.user.email}`);
        return successResponse(res, null, 'Déconnexion réussie');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    login,
    getMe,
    logout
};
