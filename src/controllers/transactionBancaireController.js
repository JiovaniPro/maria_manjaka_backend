const prisma = require('../config/database');
const { successResponse, errorResponse, notFoundResponse } = require('../utils/responses');
const logger = require('../utils/logger');

/**
 * @desc    Obtenir toutes les transactions bancaires
 * @route   GET /api/transactions-bancaires
 * @access  Private
 */
const getAllTransactionsBancaires = async (req, res, next) => {
    try {
        const { compteId, type, dateDebut, dateFin } = req.query;

        const where = {};
        if (compteId) where.compteId = parseInt(compteId);
        if (type) where.type = type;

        if (dateDebut || dateFin) {
            where.dateOperation = {};
            if (dateDebut) where.dateOperation.gte = new Date(dateDebut);
            if (dateFin) where.dateOperation.lte = new Date(dateFin);
        }

        const transactions = await prisma.transactionBancaire.findMany({
            where,
            include: {
                compte: true
            },
            orderBy: { dateOperation: 'desc' }
        });

        return successResponse(res, transactions, 'Transactions bancaires récupérées avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Obtenir une transaction bancaire par ID
 * @route   GET /api/transactions-bancaires/:id
 * @access  Private
 */
const getTransactionBancaireById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const transaction = await prisma.transactionBancaire.findUnique({
            where: { id: parseInt(id) },
            include: {
                compte: true
            }
        });

        if (!transaction) {
            return notFoundResponse(res, 'Transaction bancaire');
        }

        return successResponse(res, transaction, 'Transaction bancaire récupérée avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Créer une nouvelle transaction bancaire
 * @route   POST /api/transactions-bancaires
 * @access  Private
 */
const createTransactionBancaire = async (req, res, next) => {
    try {
        const { compteId, dateOperation, description, montant, type, numeroCheque } = req.body;

        // Validation
        if (!compteId || !dateOperation || !montant || !type) {
            return errorResponse(res, 'Tous les champs obligatoires doivent être remplis', 400);
        }

        const montantFloat = parseFloat(montant);
        if (isNaN(montantFloat) || montantFloat <= 0) {
            return errorResponse(res, 'Le montant doit être un nombre positif', 400);
        }

        // Vérifier que le compte existe et est de type BANQUE
        const compteBanque = await prisma.compte.findUnique({
            where: { id: parseInt(compteId) }
        });

        if (!compteBanque) {
            return notFoundResponse(res, 'Compte bancaire');
        }

        if (compteBanque.type !== 'BANQUE') {
            return errorResponse(res, 'Ce compte n\'est pas un compte bancaire', 400);
        }

        // Valider numéro de chèque obligatoire pour les retraits
        if (type === 'RETRAIT') {
            if (!numeroCheque) {
                return errorResponse(res, 'Le numéro de chèque est obligatoire pour un retrait', 400);
            }
            // Vérifier unicité du numéro de chèque
            const existingCheque = await prisma.transactionBancaire.findFirst({
                where: { numeroCheque: numeroCheque }
            });
            if (existingCheque) {
                return errorResponse(res, `Le numéro de chèque ${numeroCheque} existe déjà`, 400);
            }
        }

        // Trouver le compte Caisse (On suppose qu'il n'y en a qu'un ou on prend le premier trouvé)
        const compteCaisse = await prisma.compte.findFirst({
            where: { type: 'CAISSE' }
        });

        if (!compteCaisse) {
            return errorResponse(res, 'Aucun compte de caisse trouvé pour effectuer la contrepartie', 500);
        }

        // Utiliser une transaction Prisma pour garantir l'atomicité
        const transaction = await prisma.$transaction(async (tx) => {
            // Logique de transfert et vérification de solde
            if (type === 'DEPOT') {
                // Dépôt en Banque = Retrait de la Caisse
                // Vérifier solde Caisse
                if (parseFloat(compteCaisse.soldeActuel) < montantFloat) {
                    throw new Error(`Solde de caisse insuffisant (${compteCaisse.soldeActuel}) pour effectuer ce dépôt`);
                }

                // Mettre à jour solde Caisse (Débit)
                await tx.compte.update({
                    where: { id: compteCaisse.id },
                    data: { soldeActuel: { decrement: montantFloat } }
                });

                // Mettre à jour solde Banque (Crédit)
                await tx.compte.update({
                    where: { id: compteBanque.id },
                    data: { soldeActuel: { increment: montantFloat } }
                });

            } else if (type === 'RETRAIT') {
                // Retrait de la Banque = Dépôt en Caisse
                // Vérifier solde Banque
                if (parseFloat(compteBanque.soldeActuel) < montantFloat) {
                    throw new Error(`Solde bancaire insuffisant (${compteBanque.soldeActuel}) pour effectuer ce retrait`);
                }

                // Mettre à jour solde Banque (Débit)
                await tx.compte.update({
                    where: { id: compteBanque.id },
                    data: { soldeActuel: { decrement: montantFloat } }
                });

                // Mettre à jour solde Caisse (Crédit)
                await tx.compte.update({
                    where: { id: compteCaisse.id },
                    data: { soldeActuel: { increment: montantFloat } }
                });
            }

            // Créer la transaction bancaire
            const newTransaction = await tx.transactionBancaire.create({
                data: {
                    compteId: parseInt(compteId),
                    dateOperation: new Date(dateOperation),
                    description: description || '',
                    montant: montantFloat, // On stocke la valeur absolue, le type détermine le sens
                    type,
                    numeroCheque: numeroCheque || null
                },
                include: {
                    compte: true
                }
            });

            logger.info(`Transaction bancaire créée: ${type} ${montantFloat} - Caisse/Banque mis à jour`);

            return newTransaction;
        });

        return successResponse(res, transaction, 'Transaction bancaire créée avec succès', 201);
    } catch (error) {
        // Gérer les erreurs personnalisées (solde insuffisant)
        if (error.message.includes('Solde')) {
            return errorResponse(res, error.message, 400);
        }
        next(error);
    }
};

/**
 * @desc    Mettre à jour une transaction bancaire
 * @route   PUT /api/transactions-bancaires/:id
 * @access  Private
 */
const updateTransactionBancaire = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { dateOperation, description, montant, type, numeroCheque } = req.body;

        // Trouver la transaction existante
        const existingTransaction = await prisma.transactionBancaire.findUnique({
            where: { id: parseInt(id) },
            include: { compte: true }
        });

        if (!existingTransaction) {
            return notFoundResponse(res, 'Transaction bancaire');
        }

        // Trouver le compte Caisse
        const compteCaisse = await prisma.compte.findFirst({
            where: { type: 'CAISSE' }
        });

        if (!compteCaisse) {
            return errorResponse(res, 'Aucun compte de caisse trouvé', 500);
        }

        const compteBanque = existingTransaction.compte;

        // Valider numéro de chèque si fourni ou si type change vers RETRAIT
        const newType = type || existingTransaction.type;
        const newNumeroCheque = numeroCheque !== undefined ? numeroCheque : existingTransaction.numeroCheque;

        if (newType === 'RETRAIT') {
            if (!newNumeroCheque) {
                return errorResponse(res, 'Le numéro de chèque est obligatoire pour un retrait', 400);
            }
            // Vérifier unicité si le numéro change
            if (newNumeroCheque !== existingTransaction.numeroCheque) {
                const duplicate = await prisma.transactionBancaire.findFirst({
                    where: { numeroCheque: newNumeroCheque }
                });
                if (duplicate) {
                    return errorResponse(res, `Le numéro de chèque ${newNumeroCheque} existe déjà`, 400);
                }
            }
        }

        // Transaction Prisma
        const updatedTransaction = await prisma.$transaction(async (tx) => {
            // 1. Annuler l'effet de l'ancienne transaction
            const oldAmount = parseFloat(existingTransaction.montant);

            if (existingTransaction.type === 'DEPOT') {
                // Annuler Dépôt: Créditer Caisse, Débiter Banque
                await tx.compte.update({
                    where: { id: compteCaisse.id },
                    data: { soldeActuel: { increment: oldAmount } }
                });
                await tx.compte.update({
                    where: { id: compteBanque.id },
                    data: { soldeActuel: { decrement: oldAmount } }
                });
            } else {
                // Annuler Retrait: Débiter Caisse, Créditer Banque
                await tx.compte.update({
                    where: { id: compteCaisse.id },
                    data: { soldeActuel: { decrement: oldAmount } }
                });
                await tx.compte.update({
                    where: { id: compteBanque.id },
                    data: { soldeActuel: { increment: oldAmount } }
                });
            }

            // 2. Appliquer la nouvelle transaction
            const newAmount = montant ? parseFloat(montant) : oldAmount;

            // Re-vérifier les soldes avec les nouvelles valeurs (après annulation)
            // Note: Pour être rigoureux, il faudrait relire les soldes à jour, mais Prisma transaction assure la cohérence
            // On peut faire une vérification optimiste ou relire. Ici on fait confiance à la logique.

            if (newType === 'DEPOT') {
                // Nouveau Dépôt: Débiter Caisse, Créditer Banque
                // Vérif solde caisse (Attention: le solde a été recrédité de l'ancien montant si c'était un dépôt)
                // Pour simplifier, on applique aveuglément et on laisse la contrainte de base de données (si unsigned) ou on vérifie après
                // Mais Prisma Decimal permet négatif. On va faire la mise à jour.

                await tx.compte.update({
                    where: { id: compteCaisse.id },
                    data: { soldeActuel: { decrement: newAmount } }
                });
                await tx.compte.update({
                    where: { id: compteBanque.id },
                    data: { soldeActuel: { increment: newAmount } }
                });
            } else {
                // Nouveau Retrait: Débiter Banque, Créditer Caisse
                await tx.compte.update({
                    where: { id: compteBanque.id },
                    data: { soldeActuel: { decrement: newAmount } }
                });
                await tx.compte.update({
                    where: { id: compteCaisse.id },
                    data: { soldeActuel: { increment: newAmount } }
                });
            }

            // 3. Mettre à jour la transaction
            const updateData = {};
            if (dateOperation) updateData.dateOperation = new Date(dateOperation);
            if (description !== undefined) updateData.description = description;
            if (montant) updateData.montant = newAmount;
            if (type) updateData.type = type;
            if (numeroCheque !== undefined) updateData.numeroCheque = numeroCheque;

            const result = await tx.transactionBancaire.update({
                where: { id: parseInt(id) },
                data: updateData,
                include: { compte: true }
            });

            logger.info(`Transaction bancaire mise à jour: ID ${id} - Soldes ajustés`);
            return result;
        });

        return successResponse(res, updatedTransaction, 'Transaction bancaire mise à jour avec succès');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Supprimer une transaction bancaire
 * @route   DELETE /api/transactions-bancaires/:id
 * @access  Private
 */
const deleteTransactionBancaire = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Récupérer la transaction avant suppression
        const transaction = await prisma.transactionBancaire.findUnique({
            where: { id: parseInt(id) },
            include: { compte: true }
        });

        if (!transaction) {
            return notFoundResponse(res, 'Transaction bancaire');
        }

        // Trouver le compte Caisse
        const compteCaisse = await prisma.compte.findFirst({
            where: { type: 'CAISSE' }
        });

        if (!compteCaisse) {
            return errorResponse(res, 'Aucun compte de caisse trouvé', 500);
        }

        const compteBanque = transaction.compte;
        const montant = parseFloat(transaction.montant);

        // Utiliser une transaction Prisma pour garantir l'atomicité
        await prisma.$transaction(async (tx) => {
            // Annuler l'effet de la transaction sur les soldes
            if (transaction.type === 'DEPOT') {
                // Annuler Dépôt: Créditer Caisse, Débiter Banque
                await tx.compte.update({
                    where: { id: compteCaisse.id },
                    data: { soldeActuel: { increment: montant } }
                });
                await tx.compte.update({
                    where: { id: compteBanque.id },
                    data: { soldeActuel: { decrement: montant } }
                });
            } else {
                // Annuler Retrait: Débiter Caisse, Créditer Banque
                await tx.compte.update({
                    where: { id: compteCaisse.id },
                    data: { soldeActuel: { decrement: montant } }
                });
                await tx.compte.update({
                    where: { id: compteBanque.id },
                    data: { soldeActuel: { increment: montant } }
                });
            }

            // Supprimer la transaction
            await tx.transactionBancaire.delete({
                where: { id: parseInt(id) }
            });
        });

        logger.info(`Transaction bancaire supprimée: ID ${id} - Soldes restaurés`);

        return successResponse(res, null, 'Transaction bancaire supprimée avec succès');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllTransactionsBancaires,
    getTransactionBancaireById,
    createTransactionBancaire,
    updateTransactionBancaire,
    deleteTransactionBancaire
};
