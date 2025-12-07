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

        // Construire les filtres
        const where = {};
        if (categorieId) where.categorieId = parseInt(categorieId);
        if (sousCategorieId) where.sousCategorieId = parseInt(sousCategorieId);
        if (compteId) where.compteId = parseInt(compteId);
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
        // Exception : Fikambanana peut être utilisée pour les deux types (RECETTE et DEPENSE)
        // MAIS on doit s'assurer que la sous-catégorie appartient bien à une catégorie Fikambanana du bon type
        const isFikambanana = categorie.nom.toLowerCase().includes('fikambanana');
        if (!isFikambanana && categorie.type !== type) {
            return errorResponse(
                res,
                `Le type de transaction (${type}) ne correspond pas au type de catégorie (${categorie.type})`,
                400
            );
        }
        
        // Pour Fikambanana, vérifier que la catégorie sélectionnée a bien le bon type
        // (car il peut y avoir deux catégories Fikambanana distinctes : une pour RECETTE, une pour DEPENSE)
        if (isFikambanana && categorie.type !== type) {
            return errorResponse(
                res,
                `Le type de catégorie (${categorie.type}) ne correspond pas au type de transaction (${type}). Veuillez sélectionner la catégorie Fikambanana appropriée.`,
                400
            );
        }

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
            where: { id: parseInt(id) }
        });

        if (!existingTransaction) {
            return notFoundResponse(res, 'Transaction');
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
            // Exception : Fikambanana peut être utilisée pour les deux types, mais on doit vérifier que la catégorie a le bon type
            const isFikambanana = categorie.nom.toLowerCase().includes('fikambanana');
            if (!isFikambanana && categorie.type !== finalType) {
                return errorResponse(
                    res,
                    `Le type de transaction (${finalType}) ne correspond pas au type de catégorie (${categorie.type})`,
                    400
                );
            }
            
            // Pour Fikambanana, vérifier que la catégorie sélectionnée a bien le bon type
            if (isFikambanana && categorie.type !== finalType) {
                return errorResponse(
                    res,
                    `Le type de catégorie (${categorie.type}) ne correspond pas au type de transaction (${finalType}). Veuillez sélectionner la catégorie Fikambanana appropriée.`,
                    400
                );
            }
        }
        
        updateData.sousCategorieId = finalSousCategorieId;
        if (compteId) updateData.compteId = parseInt(compteId);
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

        const where = {};
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

module.exports = {
    getAllTransactions,
    getTransactionById,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    getTransactionStats
};
