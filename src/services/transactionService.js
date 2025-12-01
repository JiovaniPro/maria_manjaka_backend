const prisma = require('../config/database');
const { successResponse, errorResponse, notFoundResponse } = require('../utils/responses');
const logger = require('../utils/logger');

/**
 * Service pour gérer la logique métier des transactions
 * Mise à jour automatique des soldes
 */

/**
 * Créer une transaction et mettre à jour le solde du compte
 */
const createTransactionWithBalance = async (transactionData, userId) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Créer la transaction
        const transaction = await tx.transaction.create({
            data: {
                ...transactionData,
                createdBy: userId
            },
            include: {
                categorie: true,
                compte: true,
                user: {
                    select: { nom: true, email: true }
                }
            }
        });

        // 2. Mettre à jour le solde du compte
        // Les recettes ajoutent au solde (montant positif)
        // Les dépenses retirent du solde (montant négatif ou positif à soustraire)
        const compte = await tx.compte.findUnique({
            where: { id: transactionData.compteId }
        });

        const montantAjouter = transactionData.type === 'RECETTE'
            ? Math.abs(parseFloat(transactionData.montant))
            : -Math.abs(parseFloat(transactionData.montant));

        const nouveauSolde = parseFloat(compte.soldeActuel) + montantAjouter;

        await tx.compte.update({
            where: { id: transactionData.compteId },
            data: { soldeActuel: nouveauSolde }
        });

        logger.info(`Transaction created: ${transaction.type} ${transaction.montant} - Nouveau solde: ${nouveauSolde}`);

        return transaction;
    });
};

/**
 * Mettre à jour une transaction et recalculer les soldes
 */
const updateTransactionWithBalance = async (id, updateData, userId) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Récupérer l'ancienne transaction
        const oldTransaction = await tx.transaction.findUnique({
            where: { id: parseInt(id) }
        });

        if (!oldTransaction) {
            throw new Error('Transaction non trouvée');
        }

        // 2. Annuler l'impact de l'ancienne transaction sur l'ancien compte
        const ancienCompte = await tx.compte.findUnique({
            where: { id: oldTransaction.compteId }
        });

        const montantAnnuler = oldTransaction.type === 'RECETTE'
            ? -Math.abs(parseFloat(oldTransaction.montant))
            : Math.abs(parseFloat(oldTransaction.montant));

        const soldeAncienCompteApresAnnulation = parseFloat(ancienCompte.soldeActuel) + montantAnnuler;

        // 3. Mettre à jour la transaction
        const updatedTransaction = await tx.transaction.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                categorie: true,
                compte: true
            }
        });

        // 4. Appliquer le nouvel impact
        const nouveauMontant = updateData.montant || oldTransaction.montant;
        const nouveauType = updateData.type || oldTransaction.type;
        const nouveauCompteId = updateData.compteId || oldTransaction.compteId;

        const montantAjouter = nouveauType === 'RECETTE'
            ? Math.abs(parseFloat(nouveauMontant))
            : -Math.abs(parseFloat(nouveauMontant));

        // Si le compte a changé, restaurer l'ancien compte et mettre à jour le nouveau
        if (nouveauCompteId !== oldTransaction.compteId) {
            // Restaurer le solde de l'ancien compte
            await tx.compte.update({
                where: { id: oldTransaction.compteId },
                data: { soldeActuel: soldeAncienCompteApresAnnulation }
            });

            // Appliquer l'impact sur le nouveau compte
            const nouveauCompte = await tx.compte.findUnique({
                where: { id: nouveauCompteId }
            });
            const nouveauSolde = parseFloat(nouveauCompte.soldeActuel) + montantAjouter;

            await tx.compte.update({
                where: { id: nouveauCompteId },
                data: { soldeActuel: nouveauSolde }
            });

            logger.info(`Transaction updated: ID ${id} - Compte changé. Ancien solde: ${soldeAncienCompteApresAnnulation}, Nouveau solde: ${nouveauSolde}`);
        } else {
            // Même compte, appliquer directement
            const nouveauSolde = soldeAncienCompteApresAnnulation + montantAjouter;

            await tx.compte.update({
                where: { id: nouveauCompteId },
                data: { soldeActuel: nouveauSolde }
            });

            logger.info(`Transaction updated: ID ${id} - Nouveau solde: ${nouveauSolde}`);
        }

        logger.info(`Transaction updated: ID ${id} - Nouveau solde: ${nouveauSolde}`);

        return updatedTransaction;
    });
};

/**
 * Supprimer une transaction et restaurer le solde
 */
const deleteTransactionWithBalance = async (id) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Récupérer la transaction
        const transaction = await tx.transaction.findUnique({
            where: { id: parseInt(id) }
        });

        if (!transaction) {
            throw new Error('Transaction non trouvée');
        }

        // 2. Restaurer le solde
        const compte = await tx.compte.findUnique({
            where: { id: transaction.compteId }
        });

        const montantRestaurer = transaction.type === 'RECETTE'
            ? -Math.abs(parseFloat(transaction.montant))
            : Math.abs(parseFloat(transaction.montant));

        const nouveauSolde = parseFloat(compte.soldeActuel) + montantRestaurer;

        await tx.compte.update({
            where: { id: transaction.compteId },
            data: { soldeActuel: nouveauSolde }
        });

        // 3. Supprimer la transaction
        await tx.transaction.delete({
            where: { id: parseInt(id) }
        });

        logger.info(`Transaction deleted: ID ${id} - Solde restauré: ${nouveauSolde}`);

        return transaction;
    });
};

module.exports = {
    createTransactionWithBalance,
    updateTransactionWithBalance,
    deleteTransactionWithBalance
};
