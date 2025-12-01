const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Début du seeding...');

    // Créer un utilisateur administrateur par défaut
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@mariamanjaka.com' },
        update: {},
        create: {
            email: 'admin@mariamanjaka.com',
            motDePasse: hashedPassword,
            nom: 'Administrateur'
        }
    });

    console.log('✅ Utilisateur créé:', admin.email);

    // Créer des comptes par défaut
    const caisse = await prisma.compte.upsert({
        where: { nom: 'Caisse Principale' },
        update: {},
        create: {
            nom: 'Caisse Principale',
            type: 'CAISSE',
            soldeActuel: 0
        }
    });

    const banque = await prisma.compte.upsert({
        where: { nom: 'Compte Bancaire BNI' },
        update: {},
        create: {
            nom: 'Compte Bancaire BNI',
            type: 'BANQUE',
            soldeActuel: 0
        }
    });

    console.log('✅ Comptes créés:', caisse.nom, ',', banque.nom);

    // Créer des catégories de recettes
    const categoriesRecettes = [
        { nom: 'Offrandes Culte', codeBudgetaire: 'REC-001' },
        { nom: 'Dîmes', codeBudgetaire: 'REC-002' },
        { nom: 'Dons', codeBudgetaire: 'REC-003' },
        { nom: 'Collectes Spéciales', codeBudgetaire: 'REC-004' }
    ];

    for (const cat of categoriesRecettes) {
        await prisma.categorie.upsert({
            where: { codeBudgetaire: cat.codeBudgetaire },
            update: {},
            create: {
                nom: cat.nom,
                codeBudgetaire: cat.codeBudgetaire,
                type: 'RECETTE',
                statut: 'ACTIF'
            }
        });
    }

    console.log('✅ Catégories de recettes créées');

    // Créer des catégories de dépenses
    const categoriesDepenses = [
        { nom: 'Salaires', codeBudgetaire: 'DEP-001' },
        { nom: 'Électricité', codeBudgetaire: 'DEP-002' },
        { nom: 'Eau', codeBudgetaire: 'DEP-003' },
        { nom: 'Fournitures', codeBudgetaire: 'DEP-004' },
        { nom: 'Entretien Bâtiment', codeBudgetaire: 'DEP-005' },
        { nom: 'Missions', codeBudgetaire: 'DEP-006' }
    ];

    for (const cat of categoriesDepenses) {
        await prisma.categorie.upsert({
            where: { codeBudgetaire: cat.codeBudgetaire },
            update: {},
            create: {
                nom: cat.nom,
                codeBudgetaire: cat.codeBudgetaire,
                type: 'DEPENSE',
                statut: 'ACTIF'
            }
        });
    }

    console.log('✅ Catégories de dépenses créées');

    // Créer des paramètres système
    await prisma.parametre.upsert({
        where: { cle: 'nom_eglise' },
        update: {},
        create: {
            cle: 'nom_eglise',
            valeur: 'Église Maria Manjaka',
            description: 'Nom de l\'église'
        }
    });

    await prisma.parametre.upsert({
        where: { cle: 'devise' },
        update: {},
        create: {
            cle: 'devise',
            valeur: 'Ar',
            description: 'Devise utilisée (Ariary)'
        }
    });

    await prisma.parametre.upsert({
        where: { cle: 'mot_de_passe_securite' },
        update: {},
        create: {
            cle: 'mot_de_passe_securite',
            valeur: await bcrypt.hash('1234', 10),
            description: 'Mot de passe pour afficher les soldes sensibles'
        }
    });

    console.log('✅ Paramètres système créés');

    console.log('🎉 Seeding terminé avec succès!');
}

main()
    .catch((e) => {
        console.error('❌ Erreur lors du seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
