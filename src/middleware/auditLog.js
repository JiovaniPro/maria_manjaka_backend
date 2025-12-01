const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Middleware d'audit automatique
 * Enregistre toutes les actions CREATE, UPDATE, DELETE dans la table audit_log
 */
const auditMiddleware = (action) => {
    return async (req, res, next) => {
        // Stocker la méthode originale res.json pour intercepter la réponse
        const originalJson = res.json.bind(res);

        res.json = async function (data) {
            try {
                // Vérifier si l'utilisateur est authentifié
                if (req.user && data.success && data.data) {
                    const tableName = req.baseUrl.split('/').pop(); // Extraire le nom de la table depuis l'URL
                    const recordData = data.data;

                    // Déterminer l'action et l'ID de l'enregistrement
                    let auditAction = action;
                    let recordId = null;

                    if (req.method === 'POST') {
                        auditAction = 'CREATE';
                        recordId = recordData.id;
                    } else if (req.method === 'PUT' || req.method === 'PATCH') {
                        auditAction = 'UPDATE';
                        recordId = req.params.id || recordData.id;
                    } else if (req.method === 'DELETE') {
                        auditAction = 'DELETE';
                        recordId = req.params.id;
                    }

                    // Créer l'audit log (de manière asynchrone, sans bloquer la réponse)
                    if (auditAction && recordId) {
                        prisma.auditLog.create({
                            data: {
                                userId: req.user.id,
                                action: auditAction,
                                tableName: tableName.toUpperCase(),
                                recordId: parseInt(recordId),
                                oldValue: req.body.oldValue || null,
                                newValue: recordData
                            }
                        }).then(() => {
                            logger.info(`Audit log created: ${auditAction} on ${tableName} (ID: ${recordId}) by user ${req.user.id}`);
                        }).catch((error) => {
                            logger.error(`Failed to create audit log: ${error.message}`);
                        });
                    }
                }
            } catch (error) {
                logger.error(`Audit middleware error: ${error.message}`);
            }

            // Envoyer la réponse originale
            return originalJson(data);
        };

        next();
    };
};

module.exports = { auditMiddleware };
