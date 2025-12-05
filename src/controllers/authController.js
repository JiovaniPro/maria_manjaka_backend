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

/**
 * @desc    Changer le mot de passe de connexion
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
    try {
        const { ancienMotDePasse, nouveauMotDePasse } = req.body;

        // Validation
        if (!ancienMotDePasse || !nouveauMotDePasse) {
            return validationErrorResponse(res, [
                { field: 'ancienMotDePasse', message: 'L\'ancien mot de passe est requis' },
                { field: 'nouveauMotDePasse', message: 'Le nouveau mot de passe est requis' }
            ]);
        }

        if (nouveauMotDePasse.length < 6) {
            return errorResponse(res, 'Le nouveau mot de passe doit contenir au moins 6 caractères', 400);
        }

        // Récupérer l'utilisateur
        const user = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (!user) {
            return errorResponse(res, 'Utilisateur non trouvé', 404);
        }

        // Vérifier l'ancien mot de passe
        const isOldPasswordValid = await bcrypt.compare(ancienMotDePasse, user.motDePasse);

        if (!isOldPasswordValid) {
            return errorResponse(res, 'Ancien mot de passe incorrect', 400);
        }

        // Hasher le nouveau mot de passe
        const hashedNewPassword = await bcrypt.hash(nouveauMotDePasse, 10);

        // Mettre à jour le mot de passe
        await prisma.user.update({
            where: { id: req.user.id },
            data: { motDePasse: hashedNewPassword }
        });

        logger.info(`Password changed for user: ${user.email}`);

        return successResponse(res, null, 'Mot de passe changé avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Changer le mot de passe admin (pour voir les soldes et modifier les transactions)
 * @route   PUT /api/auth/change-admin-password
 * @access  Private
 */
const changeAdminPassword = async (req, res, next) => {
    try {
        const { ancienMotDePasse, nouveauMotDePasse } = req.body;

        // Validation
        if (!ancienMotDePasse || !nouveauMotDePasse) {
            return validationErrorResponse(res, [
                { field: 'ancienMotDePasse', message: 'L\'ancien mot de passe est requis' },
                { field: 'nouveauMotDePasse', message: 'Le nouveau mot de passe est requis' }
            ]);
        }

        // Récupérer le mot de passe admin actuel depuis les paramètres
        const parametreAdminPassword = await prisma.parametre.findUnique({
            where: { cle: 'ADMIN_PASSWORD' }
        });

        const currentAdminPassword = parametreAdminPassword ? parametreAdminPassword.valeur : '1234';

        // Vérifier l'ancien mot de passe
        if (ancienMotDePasse !== currentAdminPassword) {
            return errorResponse(res, 'Ancien mot de passe admin incorrect', 400);
        }

        // Mettre à jour ou créer le paramètre
        await prisma.parametre.upsert({
            where: { cle: 'ADMIN_PASSWORD' },
            update: { valeur: nouveauMotDePasse },
            create: {
                cle: 'ADMIN_PASSWORD',
                valeur: nouveauMotDePasse,
                description: 'Mot de passe pour voir les soldes en banque et modifier les transactions'
            }
        });

        logger.info(`Admin password changed by user: ${req.user.email}`);

        return successResponse(res, null, 'Mot de passe admin changé avec succès');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    login,
    getMe,
    logout,
    changePassword,
    changeAdminPassword
};
