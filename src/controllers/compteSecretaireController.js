const prisma = require('../config/database');
const { successResponse, errorResponse, notFoundResponse } = require('../utils/responses');
const logger = require('../utils/logger');

/**
 * @desc    Créer un compte secrétaire et un utilisateur secrétaire associé
 * @route   POST /api/comptes-secretaires
 * @access  Private (Admin seulement)
 */
const createCompteSecretaire = async (req, res, next) => {
    try {
        const { email, motDePasse, nom, nomCompte } = req.body;

        // Vérifier que l'utilisateur est admin
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (currentUser.role !== 'ADMIN') {
            return errorResponse(res, 'Seuls les administrateurs peuvent créer des comptes secrétaires', 403);
        }

        // Validation
        if (!email || !motDePasse || !nom || !nomCompte) {
            return errorResponse(res, 'Tous les champs sont requis (email, motDePasse, nom, nomCompte)', 400);
        }

        // Vérifier si l'email existe déjà
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return errorResponse(res, 'Cet email est déjà utilisé', 400);
        }

        // Vérifier si le nom de compte existe déjà
        const existingCompte = await prisma.compte.findUnique({
            where: { nom: nomCompte }
        });

        if (existingCompte) {
            return errorResponse(res, 'Ce nom de compte existe déjà', 400);
        }

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(motDePasse, 10);

        // Créer le compte secrétaire et l'utilisateur en transaction
        const result = await prisma.$transaction(async (tx) => {
            // Créer le compte secrétaire
            const compte = await tx.compte.create({
                data: {
                    nom: nomCompte,
                    type: 'SECRETAIRE',
                    soldeActuel: 0
                }
            });

            // Créer l'utilisateur secrétaire
            const user = await tx.user.create({
                data: {
                    email,
                    motDePasse: hashedPassword,
                    nom,
                    role: 'SECRETAIRE',
                    compteSecretaireId: compte.id
                },
                select: {
                    id: true,
                    email: true,
                    nom: true,
                    role: true,
                    compteSecretaireId: true
                }
            });

            return { compte, user };
        });

        logger.info(`Compte secrétaire créé: ${nomCompte} par admin ${req.user.id}`);

        return successResponse(res, result, 'Compte secrétaire créé avec succès', 201);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir tous les comptes secrétaires
 * @route   GET /api/comptes-secretaires
 * @access  Private
 */
const getAllComptesSecretaires = async (req, res, next) => {
    try {
        const comptes = await prisma.compte.findMany({
            where: { type: 'SECRETAIRE' },
            include: {
                usersSecretaires: {
                    select: {
                        id: true,
                        email: true,
                        nom: true,
                        role: true
                    }
                }
            },
            orderBy: { nom: 'asc' }
        });

        return successResponse(res, comptes, 'Comptes secrétaires récupérés avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Alimenter le compte secrétaire (Admin -> Secrétaire)
 * @route   POST /api/comptes-secretaires/:id/alimenter
 * @access  Private (Admin seulement)
 */
const alimenterCompteSecretaire = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { montant, compteSourceId, description } = req.body;

        // Vérifier que l'utilisateur est admin
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (currentUser.role !== 'ADMIN') {
            return errorResponse(res, 'Seuls les administrateurs peuvent alimenter les comptes secrétaires', 403);
        }

        // Validation
        if (!montant || montant <= 0) {
            return errorResponse(res, 'Le montant doit être positif', 400);
        }

        if (!compteSourceId) {
            return errorResponse(res, 'Le compte source est requis', 400);
        }

        // Vérifier que le compte secrétaire existe
        const compteSecretaire = await prisma.compte.findUnique({
            where: { id: parseInt(id) }
        });

        if (!compteSecretaire || compteSecretaire.type !== 'SECRETAIRE') {
            return notFoundResponse(res, 'Compte secrétaire');
        }

        // Vérifier que le compte source existe
        const compteSource = await prisma.compte.findUnique({
            where: { id: parseInt(compteSourceId) }
        });

        if (!compteSource) {
            return notFoundResponse(res, 'Compte source');
        }

        // Vérifier que le compte source a suffisamment de fonds
        if (parseFloat(compteSource.soldeActuel) < parseFloat(montant)) {
            return errorResponse(res, 'Solde insuffisant dans le compte source', 400);
        }

        const montantNum = parseFloat(montant);

        // Effectuer le transfert en transaction - SIMPLE ET DIRECT
        await prisma.$transaction(async (tx) => {
            // 1. Diminuer le solde du compte source (caisse ou banque)
            const nouveauSoldeSource = parseFloat(compteSource.soldeActuel) - montantNum;
            await tx.compte.update({
                where: { id: parseInt(compteSourceId) },
                data: { soldeActuel: nouveauSoldeSource }
            });

            // 2. Augmenter le solde du compte secrétaire
            const nouveauSoldeSecretaire = parseFloat(compteSecretaire.soldeActuel) + montantNum;
            await tx.compte.update({
                where: { id: parseInt(id) },
                data: { soldeActuel: nouveauSoldeSecretaire }
            });

            // 3. Trouver ou créer les catégories pour tracer les transactions
            // Chercher d'abord une catégorie DEPENSE existante
            let categorieDepense = await tx.categorie.findFirst({
                where: { type: 'DEPENSE', statut: 'ACTIF' }
            });

            // Si pas de catégorie DEPENSE, créer une catégorie par défaut
            if (!categorieDepense) {
                // Générer un code unique court (max 20 caractères)
                const timestamp = Date.now().toString().slice(-8); // Derniers 8 chiffres
                categorieDepense = await tx.categorie.create({
                    data: {
                        nom: 'Alimentation compte secrétaire',
                        codeBudgetaire: `ALIM-SEC-${timestamp}`,
                        type: 'DEPENSE',
                        statut: 'ACTIF'
                    }
                });
            }

            // Chercher une sous-catégorie pour la catégorie DEPENSE
            let sousCategorieDepense = await tx.sousCategorie.findFirst({
                where: { categorieId: categorieDepense.id, statut: 'ACTIF' }
            });

            // Si pas de sous-catégorie, créer une sous-catégorie par défaut
            if (!sousCategorieDepense) {
                sousCategorieDepense = await tx.sousCategorie.create({
                    data: {
                        nom: 'Alimentation secrétaire',
                        categorieId: categorieDepense.id,
                        statut: 'ACTIF'
                    }
                });
            }

            // Chercher d'abord une catégorie RECETTE existante
            let categorieRecette = await tx.categorie.findFirst({
                where: { type: 'RECETTE', statut: 'ACTIF' }
            });

            // Si pas de catégorie RECETTE, créer une catégorie par défaut
            if (!categorieRecette) {
                // Générer un code unique court (max 20 caractères)
                const timestamp = Date.now().toString().slice(-8); // Derniers 8 chiffres
                categorieRecette = await tx.categorie.create({
                    data: {
                        nom: 'Alimentation compte secrétaire',
                        codeBudgetaire: `ALIM-REC-${timestamp}`,
                        type: 'RECETTE',
                        statut: 'ACTIF'
                    }
                });
            }

            // Chercher une sous-catégorie pour la catégorie RECETTE
            let sousCategorieRecette = await tx.sousCategorie.findFirst({
                where: { categorieId: categorieRecette.id, statut: 'ACTIF' }
            });

            // Si pas de sous-catégorie, créer une sous-catégorie par défaut
            if (!sousCategorieRecette) {
                sousCategorieRecette = await tx.sousCategorie.create({
                    data: {
                        nom: 'Alimentation secrétaire',
                        categorieId: categorieRecette.id,
                        statut: 'ACTIF'
                    }
                });
            }

            // 4. Créer la transaction de dépense pour le compte source (pour tracer)
            await tx.transaction.create({
                data: {
                    categorieId: categorieDepense.id,
                    sousCategorieId: sousCategorieDepense.id,
                    compteId: parseInt(compteSourceId),
                    dateTransaction: new Date(),
                    description: description || `Alimentation du compte secrétaire ${compteSecretaire.nom}`,
                    montant: montantNum,
                    type: 'DEPENSE',
                    createdBy: req.user.id
                }
            });

            // 5. Créer la transaction de recette pour le compte secrétaire (pour tracer)
            await tx.transaction.create({
                data: {
                    categorieId: categorieRecette.id,
                    sousCategorieId: sousCategorieRecette.id,
                    compteId: parseInt(id),
                    dateTransaction: new Date(),
                    description: description || `Alimentation depuis ${compteSource.nom}`,
                    montant: montantNum,
                    type: 'RECETTE',
                    createdBy: req.user.id
                }
            });

            logger.info(`Alimentation: ${compteSource.nom} (${compteSourceId}) -${montantNum} → ${compteSecretaire.nom} (${id}) +${montantNum}`);
        });

        logger.info(`Compte secrétaire ${id} alimenté de ${montant} par admin ${req.user.id}`);

        return successResponse(res, null, 'Compte secrétaire alimenté avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Transférer le reste au compte admin (Secrétaire -> Admin)
 * @route   POST /api/comptes-secretaires/:id/transferer-reste
 * @access  Private (Secrétaire seulement)
 */
const transfererReste = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { compteDestinationId, description } = req.body;

        // Vérifier que l'utilisateur est secrétaire et possède ce compte
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { compteSecretaire: true }
        });

        if (currentUser.role !== 'SECRETAIRE') {
            return errorResponse(res, 'Seuls les secrétaires peuvent transférer le reste', 403);
        }

        if (currentUser.compteSecretaireId !== parseInt(id)) {
            return errorResponse(res, 'Vous ne pouvez transférer que depuis votre propre compte', 403);
        }

        // Vérifier que le compte secrétaire existe
        const compteSecretaire = await prisma.compte.findUnique({
            where: { id: parseInt(id) }
        });

        if (!compteSecretaire || compteSecretaire.type !== 'SECRETAIRE') {
            return notFoundResponse(res, 'Compte secrétaire');
        }

        // Vérifier que le compte destination existe
        const compteDestination = await prisma.compte.findUnique({
            where: { id: parseInt(compteDestinationId) }
        });

        if (!compteDestination) {
            return notFoundResponse(res, 'Compte destination');
        }

        const soldeActuel = parseFloat(compteSecretaire.soldeActuel);

        if (soldeActuel <= 0) {
            return errorResponse(res, 'Aucun solde à transférer', 400);
        }

        // Effectuer le transfert en transaction
        await prisma.$transaction(async (tx) => {
            // Débiter le compte secrétaire (mettre à zéro)
            await tx.compte.update({
                where: { id: parseInt(id) },
                data: {
                    soldeActuel: 0
                }
            });

            // Créditer le compte destination
            await tx.compte.update({
                where: { id: parseInt(compteDestinationId) },
                data: {
                    soldeActuel: { increment: soldeActuel }
                }
            });

            // Créer une transaction de dépense pour le compte secrétaire
            const categoriesDepense = await tx.categorie.findMany({
                where: { type: 'DEPENSE', statut: 'ACTIF' },
                take: 1
            });

            if (categoriesDepense.length > 0) {
                const sousCategories = await tx.sousCategorie.findMany({
                    where: { categorieId: categoriesDepense[0].id, statut: 'ACTIF' },
                    take: 1
                });

                if (sousCategories.length > 0) {
                    await tx.transaction.create({
                        data: {
                            categorieId: categoriesDepense[0].id,
                            sousCategorieId: sousCategories[0].id,
                            compteId: parseInt(id),
                            dateTransaction: new Date(),
                            description: description || `Transfert du reste vers ${compteDestination.nom}`,
                            montant: soldeActuel,
                            type: 'DEPENSE',
                            createdBy: req.user.id
                        }
                    });
                }
            }
        });

        logger.info(`Reste de ${soldeActuel} transféré du compte secrétaire ${id} vers ${compteDestinationId} par secrétaire ${req.user.id}`);

        return successResponse(res, { montantTransfere: soldeActuel }, 'Reste transféré avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir le compte secrétaire de l'utilisateur connecté
 * @route   GET /api/comptes-secretaires/mon-compte
 * @access  Private (Secrétaire seulement)
 */
const getMonCompteSecretaire = async (req, res, next) => {
    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                compteSecretaire: true
            }
        });

        if (currentUser.role !== 'SECRETAIRE' || !currentUser.compteSecretaire) {
            return errorResponse(res, 'Aucun compte secrétaire associé', 404);
        }

        return successResponse(res, currentUser.compteSecretaire, 'Compte secrétaire récupéré avec succès');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createCompteSecretaire,
    getAllComptesSecretaires,
    alimenterCompteSecretaire,
    transfererReste,
    getMonCompteSecretaire
};
