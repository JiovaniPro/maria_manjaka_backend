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
                sousCategorie: true,
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
 * Extraire le numéro de chèque d'une description
 */
const extractChequeNumber = (description) => {
    if (!description) return null;
    const match = description.match(/CHQ-([\w-]+)/);
    return match ? match[1] : null;
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

        // 2. Vérifier si c'est une transaction bancaire (dépense avec chèque)
        const oldChequeNumber = extractChequeNumber(oldTransaction.description);
        const newDescription = updateData.description !== undefined ? updateData.description : oldTransaction.description;
        const newChequeNumber = extractChequeNumber(newDescription);
        const nouveauMontant = updateData.montant ? parseFloat(updateData.montant) : parseFloat(oldTransaction.montant);
        const nouveauType = updateData.type || oldTransaction.type;
        const nouveauCompteId = updateData.compteId || oldTransaction.compteId;
        const oldMontant = parseFloat(oldTransaction.montant);

        // 3. Vérifier si c'est une transaction bancaire (dépense avec chèque)
        const isOldTransactionBancaire = oldChequeNumber && oldTransaction.type === 'DEPENSE';
        const isNewTransactionBancaire = newChequeNumber && nouveauType === 'DEPENSE';

        // 4. Si c'est une dépense bancaire (avec chèque), gérer la transaction bancaire associée
        if (isOldTransactionBancaire || isNewTransactionBancaire) {
            // Trouver le compte caisse
            const compteCaisse = await tx.compte.findFirst({
                where: { type: 'CAISSE' }
            });

            if (!compteCaisse) {
                throw new Error('Aucun compte de caisse trouvé');
            }

            let compteBanque = null;
            let transactionBancaire = null;

            if (isOldTransactionBancaire) {
                // Trouver la transaction bancaire associée
                transactionBancaire = await tx.transactionBancaire.findFirst({
                    where: { numeroCheque: oldChequeNumber },
                    include: { compte: true }
                });

                if (transactionBancaire) {
                    compteBanque = transactionBancaire.compte;
                }
            }

            // Si c'est une transaction bancaire, on ne doit PAS modifier la caisse directement
            // car la transaction bancaire gère déjà le transfert banque -> caisse
            // On doit seulement gérer la différence de montant pour la banque

            if (transactionBancaire && compteBanque) {
                // Calculer la différence de montant
                const differenceMontant = oldMontant - nouveauMontant;

                // Annuler l'ancienne transaction bancaire (rembourser la banque, débiter la caisse)
                // Annuler RETRAIT = Créditer Banque, Débiter Caisse
                await tx.compte.update({
                    where: { id: compteBanque.id },
                    data: { soldeActuel: { increment: oldMontant } }
                });
                await tx.compte.update({
                    where: { id: compteCaisse.id },
                    data: { soldeActuel: { decrement: oldMontant } }
                });

                // Si le numéro de chèque change, supprimer l'ancienne transaction bancaire et créer une nouvelle
                if (newChequeNumber && newChequeNumber !== oldChequeNumber) {
                    // Supprimer l'ancienne transaction bancaire
                    await tx.transactionBancaire.delete({
                        where: { id: transactionBancaire.id }
                    });

                    // Créer une nouvelle transaction bancaire avec le nouveau numéro de chèque
                    await tx.transactionBancaire.create({
                        data: {
                            compteId: compteBanque.id,
                            dateOperation: updateData.dateTransaction ? new Date(updateData.dateTransaction) : transactionBancaire.dateOperation,
                            description: newDescription,
                            montant: nouveauMontant,
                            type: 'RETRAIT',
                            numeroCheque: newChequeNumber
                        }
                    });

                    logger.info(`Transaction bancaire recréée avec nouveau numéro de chèque: ${oldChequeNumber} -> ${newChequeNumber}`);
                } else {
                    // Mettre à jour la transaction bancaire existante
                    await tx.transactionBancaire.update({
                        where: { id: transactionBancaire.id },
                        data: {
                            montant: nouveauMontant,
                            description: newDescription,
                            dateOperation: updateData.dateTransaction ? new Date(updateData.dateTransaction) : transactionBancaire.dateOperation,
                            numeroCheque: newChequeNumber || oldChequeNumber
                        }
                    });
                }

                // Appliquer la nouvelle transaction bancaire (débiter la banque, créditer la caisse)
                // Nouveau RETRAIT = Débiter Banque, Créditer Caisse
                await tx.compte.update({
                    where: { id: compteBanque.id },
                    data: { soldeActuel: { decrement: nouveauMontant } }
                });
                await tx.compte.update({
                    where: { id: compteCaisse.id },
                    data: { soldeActuel: { increment: nouveauMontant } }
                });

                logger.info(`Transaction bancaire associée mise à jour: Montant: ${oldMontant} -> ${nouveauMontant}, Différence: ${differenceMontant}`);

                // IMPORTANT: Pour les transactions bancaires, la transaction normale a aussi affecté la caisse lors de la création
                // On doit annuler cet impact et appliquer le nouvel impact, mais en tenant compte que
                // la transaction bancaire a déjà géré le transfert banque -> caisse
                // 
                // Lors de la création :
                // - Transaction bancaire : Banque -100.000, Caisse +100.000
                // - Transaction normale : Caisse -100.000 (dépense)
                // Résultat net : Banque -100.000, Caisse 0
                //
                // Lors de la modification de 100.000 à 10.000 :
                // - Annuler transaction bancaire : Banque +100.000, Caisse -100.000
                // - Appliquer nouvelle transaction bancaire : Banque -10.000, Caisse +10.000
                // - Annuler transaction normale : Caisse +100.000 (annuler la dépense)
                // - Appliquer nouvelle transaction normale : Caisse -10.000 (nouvelle dépense)
                // Résultat net : Banque +90.000, Caisse 0

                // 5. Annuler l'impact de l'ancienne transaction normale sur la caisse
                // Pour les transactions bancaires, le compte de la transaction normale est toujours la caisse
                // On annule l'impact de l'ancienne transaction normale
                const montantAnnuler = oldTransaction.type === 'RECETTE'
                    ? -Math.abs(oldMontant)
                    : Math.abs(oldMontant);

                // 6. Mettre à jour la transaction
                const updatedTransaction = await tx.transaction.update({
                    where: { id: parseInt(id) },
                    data: updateData,
                    include: {
                        categorie: true,
                        compte: true
                    }
                });

                // 7. Appliquer le nouvel impact de la transaction normale sur la caisse
                // Récupérer le solde actuel de la caisse après les modifications de la transaction bancaire
                const compteCaisseActuel = await tx.compte.findUnique({
                    where: { id: compteCaisse.id }
                });

                const montantAjouter = nouveauType === 'RECETTE'
                    ? Math.abs(nouveauMontant)
                    : -Math.abs(nouveauMontant);

                // Mettre à jour le solde de la caisse en tenant compte de l'annulation et du nouvel impact
                // montantAnnuler annule l'impact de l'ancienne transaction normale
                // montantAjouter applique l'impact de la nouvelle transaction normale
                const soldeCaisseActuel = parseFloat(compteCaisseActuel.soldeActuel);
                const nouveauSoldeCaisse = soldeCaisseActuel + montantAnnuler + montantAjouter;

                await tx.compte.update({
                    where: { id: compteCaisse.id },
                    data: { soldeActuel: nouveauSoldeCaisse }
                });

                logger.info(`Transaction bancaire mise à jour: Caisse ajustée. Ancien impact: ${montantAnnuler}, Nouvel impact: ${montantAjouter}, Nouveau solde caisse: ${nouveauSoldeCaisse}`);

                return updatedTransaction;
            }
        }

        // 7. Si ce n'est PAS une transaction bancaire, gérer normalement la transaction
        // Annuler l'impact de l'ancienne transaction sur l'ancien compte
        const ancienCompte = await tx.compte.findUnique({
            where: { id: oldTransaction.compteId }
        });

        const montantAnnuler = oldTransaction.type === 'RECETTE'
            ? -Math.abs(oldMontant)
            : Math.abs(oldMontant);

        const soldeAncienCompteApresAnnulation = parseFloat(ancienCompte.soldeActuel) + montantAnnuler;

        // 8. Mettre à jour la transaction
        const updatedTransaction = await tx.transaction.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                categorie: true,
                compte: true
            }
        });

        // 9. Appliquer le nouvel impact sur le compte
        const montantAjouter = nouveauType === 'RECETTE'
            ? Math.abs(nouveauMontant)
            : -Math.abs(nouveauMontant);

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
