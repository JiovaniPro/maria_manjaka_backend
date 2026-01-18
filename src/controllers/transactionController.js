const prisma = require('../config/database');
const { successResponse, errorResponse, notFoundResponse } = require('../utils/responses');
const logger = require('../utils/logger');
const {
    createTransactionWithBalance,
    updateTransactionWithBalance,
    deleteTransactionWithBalance
} = require('../services/transactionService');

/**
 * @desc    Obtenir toutes les transactions
 * @route   GET /api/transactions
 * @access  Private
 */
const getAllTransactions = async (req, res, next) => {
    try {
        const { categorieId, sousCategorieId, compteId, type, dateDebut, dateFin, limit = 50 } = req.query;

        // Vérifier le rôle de l'utilisateur
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        // Construire les filtres
        const where = {};
        
        // Si l'utilisateur est secrétaire, filtrer automatiquement par son compte secrétaire
        if (currentUser.role === 'SECRETAIRE' && currentUser.compteSecretaireId) {
            where.compteId = currentUser.compteSecretaireId;
        } else if (compteId) {
            // Pour les admins, utiliser le compteId fourni en paramètre
            where.compteId = parseInt(compteId);
        }
        
        if (categorieId) where.categorieId = parseInt(categorieId);
        if (sousCategorieId) where.sousCategorieId = parseInt(sousCategorieId);
        if (type) where.type = type;

        if (dateDebut || dateFin) {
            where.dateTransaction = {};
            if (dateDebut) where.dateTransaction.gte = new Date(dateDebut);
            if (dateFin) where.dateTransaction.lte = new Date(dateFin);
        }

        const transactions = await prisma.transaction.findMany({
            where,
            include: {
                categorie: true,
                sousCategorie: true,
                compte: true,
                user: {
                    select: { nom: true, email: true }
                }
            },
            orderBy: [
                { dateTransaction: 'desc' },
                { id: 'desc' } // En cas d'égalité de date, trier par ID décroissant (plus récent en premier)
            ],
            take: parseInt(limit)
        });

        return successResponse(res, transactions, 'Transactions récupérées avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir une transaction par ID
 * @route   GET /api/transactions/:id
 * @access  Private
 */
const getTransactionById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const transaction = await prisma.transaction.findUnique({
            where: { id: parseInt(id) },
            include: {
                categorie: true,
                sousCategorie: true,
                compte: true,
                user: {
                    select: { nom: true, email: true }
                }
            }
        });

        if (!transaction) {
            return notFoundResponse(res, 'Transaction');
        }

        return successResponse(res, transaction, 'Transaction récupérée avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Créer une nouvelle transaction
 * @route   POST /api/transactions
 * @access  Private
 */
const createTransaction = async (req, res, next) => {
    try {
        const { categorieId, sousCategorieId, compteId, dateTransaction, description, montant, type } = req.body;

        // Vérifier le rôle de l'utilisateur
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        // Si l'utilisateur est secrétaire, il ne peut faire que des dépenses
        if (currentUser.role === 'SECRETAIRE' && type !== 'DEPENSE') {
            return errorResponse(res, 'Les secrétaires ne peuvent créer que des dépenses', 403);
        }

        // Si l'utilisateur est secrétaire, vérifier qu'il utilise son propre compte
        if (currentUser.role === 'SECRETAIRE') {
            if (currentUser.compteSecretaireId !== parseInt(compteId)) {
                return errorResponse(res, 'Vous devez utiliser votre compte secrétaire', 403);
            }
        }

        // Validation
        if (!categorieId || !sousCategorieId || !compteId || !dateTransaction || !montant || !type) {
            return errorResponse(res, 'Tous les champs obligatoires doivent être remplis (catégorie, sous-catégorie, compte, date, montant, type)', 400);
        }

        // Vérifier que le montant est positif
        if (parseFloat(montant) <= 0) {
            return errorResponse(res, 'Le montant doit être positif', 400);
        }

        // Vérifier que la catégorie, sous-catégorie et le compte existent
        const [categorie, sousCategorie, compte] = await Promise.all([
            prisma.categorie.findUnique({ where: { id: parseInt(categorieId) } }),
            prisma.sousCategorie.findUnique({ where: { id: parseInt(sousCategorieId) } }),
            prisma.compte.findUnique({ where: { id: parseInt(compteId) } })
        ]);

        if (!categorie) {
            return notFoundResponse(res, 'Catégorie');
        }

        if (!sousCategorie) {
            return notFoundResponse(res, 'Sous-catégorie');
        }

        if (!compte) {
            return notFoundResponse(res, 'Compte');
        }

        // Vérifier que la sous-catégorie appartient à la catégorie
        if (sousCategorie.categorieId !== parseInt(categorieId)) {
            return errorResponse(
                res,
                'La sous-catégorie sélectionnée n\'appartient pas à la catégorie sélectionnée',
                400
            );
        }

        // Vérifier que le type de transaction correspond au type de catégorie
        // Exception : Fikambanana masina peut être utilisée pour les deux types (RECETTE et DEPENSE)
        // Une seule catégorie Fikambanana masina peut accepter les deux types de transactions
        const isFikambananaMasina = categorie.nom.toLowerCase().includes('fikambanana') && 
                                     categorie.nom.toLowerCase().includes('masina');
        
        if (!isFikambananaMasina && categorie.type !== type) {
            return errorResponse(
                res,
                `Le type de transaction (${type}) ne correspond pas au type de catégorie (${categorie.type})`,
                400
            );
        }
        
        // Pour Fikambanana masina, on accepte les deux types (RECETTE et DEPENSE) sans vérification
        // Les autres catégories Fikambanana (sans "masina") suivent la règle normale

        // Créer la transaction avec mise à jour du solde
        const transaction = await createTransactionWithBalance({
            categorieId: parseInt(categorieId),
            sousCategorieId: parseInt(sousCategorieId),
            compteId: parseInt(compteId),
            dateTransaction: new Date(dateTransaction),
            description: description || null,
            montant: parseFloat(montant),
            type
        }, req.user.id);

        return successResponse(res, transaction, 'Transaction créée avec succès', 201);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Mettre à jour une transaction
 * @route   PUT /api/transactions/:id
 * @access  Private
 */
const updateTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { categorieId, sousCategorieId, compteId, dateTransaction, description, montant, type } = req.body;

        // Récupérer la transaction existante pour vérifier les valeurs par défaut
        const existingTransaction = await prisma.transaction.findUnique({
            where: { id: parseInt(id) },
            include: { compte: true }
        });

        if (!existingTransaction) {
            return notFoundResponse(res, 'Transaction');
        }

        // Vérifier le rôle de l'utilisateur
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        // Si l'utilisateur est secrétaire, vérifier qu'il ne modifie que ses propres transactions
        if (currentUser.role === 'SECRETAIRE' && currentUser.compteSecretaireId) {
            if (existingTransaction.compteId !== currentUser.compteSecretaireId) {
                return errorResponse(res, 'Vous ne pouvez modifier que vos propres transactions', 403);
            }
            // Forcer le compteId à rester celui du secrétaire
            if (compteId && parseInt(compteId) !== currentUser.compteSecretaireId) {
                return errorResponse(res, 'Vous ne pouvez utiliser que votre compte secrétaire', 403);
            }
        }

        // Construire les données de mise à jour
        const updateData = {};
        const finalCategorieId = categorieId ? parseInt(categorieId) : existingTransaction.categorieId;
        const finalSousCategorieId = sousCategorieId ? parseInt(sousCategorieId) : existingTransaction.sousCategorieId;

        // La sous-catégorie est obligatoire
        if (!finalSousCategorieId) {
            return errorResponse(res, 'La sous-catégorie est obligatoire', 400);
        }

        if (categorieId) updateData.categorieId = parseInt(categorieId);
        
        // Vérifier que la sous-catégorie existe et appartient à la catégorie
        const sousCategorie = await prisma.sousCategorie.findUnique({
            where: { id: finalSousCategorieId }
        });
        if (!sousCategorie) {
            return notFoundResponse(res, 'Sous-catégorie');
        }
        if (sousCategorie.categorieId !== finalCategorieId) {
            return errorResponse(
                res,
                'La sous-catégorie sélectionnée n\'appartient pas à la catégorie sélectionnée',
                400
            );
        }
        
        // Vérifier le type de catégorie si la catégorie ou le type a changé
        const finalType = type || existingTransaction.type;
        if (categorieId || type) {
            const categorie = await prisma.categorie.findUnique({
                where: { id: finalCategorieId }
            });
            if (!categorie) {
                return notFoundResponse(res, 'Catégorie');
            }
            
            // Vérifier que le type de transaction correspond au type de catégorie
            // Exception : Fikambanana masina peut être utilisée pour les deux types (RECETTE et DEPENSE)
            // Une seule catégorie Fikambanana masina peut accepter les deux types de transactions
            const isFikambananaMasina = categorie.nom.toLowerCase().includes('fikambanana') && 
                                         categorie.nom.toLowerCase().includes('masina');
            
            if (!isFikambananaMasina && categorie.type !== finalType) {
                return errorResponse(
                    res,
                    `Le type de transaction (${finalType}) ne correspond pas au type de catégorie (${categorie.type})`,
                    400
                );
            }
            
            // Pour Fikambanana masina, on accepte les deux types (RECETTE et DEPENSE) sans vérification
            // Les autres catégories Fikambanana (sans "masina") suivent la règle normale
        }
        
        updateData.sousCategorieId = finalSousCategorieId;
        // Si secrétaire, forcer le compteId à son compte secrétaire
        if (currentUser.role === 'SECRETAIRE' && currentUser.compteSecretaireId) {
            updateData.compteId = currentUser.compteSecretaireId;
        } else if (compteId) {
            updateData.compteId = parseInt(compteId);
        }
        if (dateTransaction) updateData.dateTransaction = new Date(dateTransaction);
        if (description !== undefined) updateData.description = description || null;
        if (montant) {
            if (parseFloat(montant) <= 0) {
                return errorResponse(res, 'Le montant doit être positif', 400);
            }
            updateData.montant = parseFloat(montant);
        }
        if (type) updateData.type = type;

        // Mettre à jour avec recalcul du solde
        const transaction = await updateTransactionWithBalance(id, updateData, req.user.id);

        return successResponse(res, transaction, 'Transaction mise à jour avec succès');
    } catch (error) {
        if (error.message === 'Transaction non trouvée') {
            return notFoundResponse(res, 'Transaction');
        }
        next(error);
    }
};

/**
 * @desc    Supprimer une transaction
 * @route   DELETE /api/transactions/:id
 * @access  Private
 */
const deleteTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Récupérer la transaction existante pour vérifier les permissions
        const existingTransaction = await prisma.transaction.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingTransaction) {
            return notFoundResponse(res, 'Transaction');
        }

        // Vérifier le rôle de l'utilisateur
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        // Si l'utilisateur est secrétaire, vérifier qu'il ne supprime que ses propres transactions
        if (currentUser.role === 'SECRETAIRE' && currentUser.compteSecretaireId) {
            if (existingTransaction.compteId !== currentUser.compteSecretaireId) {
                return errorResponse(res, 'Vous ne pouvez supprimer que vos propres transactions', 403);
            }
        }

        // Supprimer avec restauration du solde
        await deleteTransactionWithBalance(id);

        return successResponse(res, null, 'Transaction supprimée avec succès');
    } catch (error) {
        if (error.message === 'Transaction non trouvée') {
            return notFoundResponse(res, 'Transaction');
        }
        next(error);
    }
};

/**
 * @desc    Obtenir les statistiques des transactions
 * @route   GET /api/transactions/stats
 * @access  Private
 */
const getTransactionStats = async (req, res, next) => {
    try {
        const { dateDebut, dateFin } = req.query;

        // Vérifier le rôle de l'utilisateur
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        const where = {};
        
        // Si l'utilisateur est secrétaire, filtrer automatiquement par son compte secrétaire
        if (currentUser.role === 'SECRETAIRE' && currentUser.compteSecretaireId) {
            where.compteId = currentUser.compteSecretaireId;
        }
        
        if (dateDebut || dateFin) {
            where.dateTransaction = {};
            if (dateDebut) where.dateTransaction.gte = new Date(dateDebut);
            if (dateFin) where.dateTransaction.lte = new Date(dateFin);
        }

        const [recettes, depenses] = await Promise.all([
            prisma.transaction.aggregate({
                where: { ...where, type: 'RECETTE' },
                _sum: { montant: true },
                _count: true
            }),
            prisma.transaction.aggregate({
                where: { ...where, type: 'DEPENSE' },
                _sum: { montant: true },
                _count: true
            })
        ]);

        const stats = {
            totalRecettes: parseFloat(recettes._sum.montant || 0),
            nombreRecettes: recettes._count,
            totalDepenses: Math.abs(parseFloat(depenses._sum.montant || 0)),
            nombreDepenses: depenses._count,
            soldeNet: parseFloat(recettes._sum.montant || 0) - Math.abs(parseFloat(depenses._sum.montant || 0))
        };

        return successResponse(res, stats, 'Statistiques récupérées avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir la récapitulation des transactions groupées par catégorie et sous-catégorie
 * @route   GET /api/transactions/recapitulation
 * @access  Private
 */
const getRecapitulation = async (req, res, next) => {
    try {
        const { dateDebut, dateFin } = req.query;

        if (!dateDebut || !dateFin) {
            return errorResponse(res, 'Les dates de début et de fin sont requises', 400);
        }

        // Vérifier le rôle de l'utilisateur
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        const where = {
            dateTransaction: {
                gte: new Date(dateDebut),
                lte: new Date(dateFin)
            }
        };
        
        // Si l'utilisateur est secrétaire, filtrer automatiquement par son compte secrétaire
        if (currentUser.role === 'SECRETAIRE' && currentUser.compteSecretaireId) {
            where.compteId = currentUser.compteSecretaireId;
        } else if (currentUser.role === 'ADMIN') {
            // Pour les admins, exclure les transactions des comptes secrétaires
            // car elles sont des RECETTES pour le secrétaire mais ne doivent pas apparaître dans la récap admin
            // On doit récupérer d'abord les IDs des comptes non-secrétaires
            const comptesAdmin = await prisma.compte.findMany({
                where: {
                    type: {
                        not: 'SECRETAIRE'
                    }
                },
                select: { id: true }
            });
            const compteIdsAdmin = comptesAdmin.map(c => c.id);
            where.compteId = {
                in: compteIdsAdmin
            };
        }

        // Récupérer toutes les transactions dans la période
        const transactions = await prisma.transaction.findMany({
            where,
            include: {
                categorie: true,
                sousCategorie: true,
                compte: true
            },
            orderBy: [
                { categorie: { nom: 'asc' } },
                { sousCategorie: { nom: 'asc' } },
                { dateTransaction: 'asc' }
            ]
        });

        // Grouper par catégorie puis par sous-catégorie
        const grouped = {};
        
        transactions.forEach(transaction => {
            const categorieId = transaction.categorieId;
            const categorieNom = transaction.categorie.nom;
            const sousCategorieId = transaction.sousCategorieId;
            const sousCategorieNom = transaction.sousCategorie.nom;
            const type = transaction.type;
            const montant = parseFloat(transaction.montant);

            // Initialiser la catégorie si elle n'existe pas
            if (!grouped[categorieId]) {
                grouped[categorieId] = {
                    id: categorieId,
                    nom: categorieNom,
                    type: transaction.categorie.type,
                    sousCategories: {},
                    totalRecettes: 0,
                    totalDepenses: 0
                };
            }

            // Initialiser la sous-catégorie si elle n'existe pas
            if (!grouped[categorieId].sousCategories[sousCategorieId]) {
                grouped[categorieId].sousCategories[sousCategorieId] = {
                    id: sousCategorieId,
                    nom: sousCategorieNom,
                    transactions: [],
                    totalRecettes: 0,
                    totalDepenses: 0
                };
            }

            // Ajouter la transaction
            grouped[categorieId].sousCategories[sousCategorieId].transactions.push({
                id: transaction.id,
                dateTransaction: transaction.dateTransaction,
                description: transaction.description,
                montant: montant,
                type: type,
                compte: transaction.compte.nom
            });

            // Mettre à jour les totaux
            if (type === 'RECETTE') {
                grouped[categorieId].sousCategories[sousCategorieId].totalRecettes += montant;
                grouped[categorieId].totalRecettes += montant;
            } else {
                grouped[categorieId].sousCategories[sousCategorieId].totalDepenses += montant;
                grouped[categorieId].totalDepenses += montant;
            }
        });

        // Convertir en tableau et calculer les totaux généraux
        const result = {
            dateDebut: dateDebut,
            dateFin: dateFin,
            categories: Object.values(grouped).map(categorie => ({
                ...categorie,
                sousCategories: Object.values(categorie.sousCategories),
                soldeNet: categorie.totalRecettes - categorie.totalDepenses
            })),
            totalGeneralRecettes: Object.values(grouped).reduce((sum, cat) => sum + cat.totalRecettes, 0),
            totalGeneralDepenses: Object.values(grouped).reduce((sum, cat) => sum + cat.totalDepenses, 0)
        };

        result.soldeNetGeneral = result.totalGeneralRecettes - result.totalGeneralDepenses;

        return successResponse(res, result, 'Récapitulation récupérée avec succès');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllTransactions,
    getTransactionById,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    getTransactionStats,
    getRecapitulation
};
