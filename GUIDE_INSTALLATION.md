# 📖 Guide d'Installation Pas à Pas - Backend Gestion Maria Manjaka

Ce guide vous accompagne étape par étape pour installer et configurer le backend.

## ✅ Étape 1: Installation PostgreSQL (en cours)

Vous avez téléchargé PostgreSQL 16.11. Suivez ces étapes pour l'installer :

### Installation de PostgreSQL

1. **Exécutez l'installateur** PostgreSQL que vous venez de télécharger

2. **Configuration lors de l'installation** :
   - **Installation Directory**: Laissez par défaut (`C:\Program Files\PostgreSQL\16`)
   - **Composants à installer**: 
     - ✅ PostgreSQL Server (requis)
     - ✅ pgAdmin 4 (interface graphique recommandée)
     - ✅ Command Line Tools (requis)
     - ❌ Stack Builder (optionnel)
   
   - **Data Directory**: Laissez par défaut (`C:\Program Files\PostgreSQL\16\data`)
   
   - **Mot de passe superutilisateur (postgres)**: 
     - **IMPORTANT**: Choisissez un mot de passe et **NOTEZ-LE PRÉCIEUSEMENT**
     - Exemple: `postgres2024` (utilisez un mot de passe plus fort en production)
   
   - **Port**: Laissez **5432** (port par défaut)
   
   - **Locale**: Sélectionnez `French, France` ou laissez par défaut

3. **Terminez l'installation** et décochez "Launch Stack Builder" si proposé

### Vérification de l'installation

Ouvrez PowerShell et testez :

```powershell
psql --version
```

Vous devriez voir : `psql (PostgreSQL) 16.x`

---

## ✅ Étape 2: Configuration de PostgreSQL

### Créer la base de données

1. **Ouvrez PowerShell en tant qu'administrateur**

2. **Connectez-vous à PostgreSQL** (utilisez le mot de passe que vous avez défini) :

```powershell
psql -U postgres
```

3. **Créez la base de données et l'utilisateur** :

```sql
-- Créer la base de données
CREATE DATABASE gestion_maria_manjaka;

-- Créer un utilisateur dédié
CREATE USER maria_admin WITH PASSWORD 'VotreMotDePasseSecurise123';

-- Donner tous les privilèges
GRANT ALL PRIVILEGES ON DATABASE gestion_maria_manjaka TO maria_admin;

-- Quitter psql
\q
```

**✍️ NOTEZ CES INFORMATIONS** :
- Base de données : `gestion_maria_manjaka`
- Utilisateur : `maria_admin`
- Mot de passe : `VotreMotDePasseSecurise123` (celui que vous avez choisi)

---

## ✅ Étape 3: Installation des dépendances Node.js

1. **Ouvrez PowerShell** et naviguez vers le dossier Backend :

```powershell
cd "C:\Users\WINDOWS 11\Desktop\Gestion Maria Manjaka\Backend"
```

2. **Installez les dépendances** :

```powershell
npm install
```

⏳ Cela prendra quelques minutes...

---

## ✅ Étape 4: Configuration des variables d'environnement

1. **Créez le fichier `.env`** en copiant `.env.example` :

```powershell
copy .env.example .env
```

2. **Modifiez le fichier `.env`** avec vos informations :

Ouvrez `Backend\.env` avec un éditeur de texte et modifiez ces lignes :

```env
# Remplacez "VotreMotDePasse" par le mot de passe de maria_admin
DATABASE_URL="postgresql://maria_admin:VotreMotDePasseSecurise123@localhost:5432/gestion_maria_manjaka"

# Générez une clé JWT sécurisée (gardez celle-ci pour le dev)
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**💡 Conseil** : Pour générer une clé JWT vraiment sécurisée en production :
```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## ✅ Étape 5: Initialisation de Prisma et de la base de données

1. **Générez le client Prisma** :

```powershell
npm run generate
```

2. **Créez les tables dans la base de données** (migration) :

```powershell
npm run migrate
```

Nommez la migration : `init` quand demandé

3. **Remplissez la base avec des données initiales** :

```powershell
npm run seed
```

Vous devriez voir :
```
✅ Utilisateur créé: admin@mariamanjaka.com
✅ Comptes créés: Caisse Principale , Compte Bancaire BNI
✅ Catégories de recettes créées
✅ Catégories de dépenses créées
✅ Paramètres système créés
🎉 Seeding terminé avec succès!
```

---

## ✅ Étape 6: Démarrer le serveur

### Mode développement (avec auto-reload)

```powershell
npm run dev
```

Vous devriez voir :
```
🚀 Serveur démarré en mode development
📡 Serveur écoute sur le port 5000
📚 Documentation API: http://localhost:5000/api-docs
🔗 Base URL: http://localhost:5000/api
```

### Tester que le serveur fonctionne

Ouvrez votre navigateur et allez sur :
- **http://localhost:5000/health** → Vous devriez voir `{"success":true,"message":"API fonctionnelle"}`
- **http://localhost:5000/api-docs** → Documentation Swagger interactive

---

## ✅ Étape 7: Tester l'API (optionnel)

### Avec Swagger UI

1. Ouvrez **http://localhost:5000/api-docs**
2. Cliquez sur `POST /api/auth/login`
3. Cliquez sur "Try it out"
4. Entrez :
   ```json
   {
     "email": "admin@mariamanjaka.com",
     "motDePasse": "admin123"
   }
   ```
5. Cliquez "Execute"
6. Vous devriez recevoir un token JWT

### Avec PowerShell / curl

```powershell
# Test de connexion
Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@mariamanjaka.com","motDePasse":"admin123"}'
```

---

## 🎉 Félicitations !

Votre backend est maintenant opérationnel ! 

### Prochaines étapes

1. **Consultez la documentation** : http://localhost:5000/api-docs
2. **Testez les endpoints** avec Swagger UI ou Postman
3. **Connectez le frontend** Next.js au backend
4. **Explorez les données** avec Prisma Studio :
   ```powershell
   npm run studio
   ```

### Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarrer en mode développement |
| `npm run studio` | Ouvrir Prisma Studio (GUI base de données) |
| `npm run migrate` | Créer/appliquer migrations |
| `npm run seed` | Réinitialiser et remplir la base |

### Identifiants par défaut

- **Email**: `admin@mariamanjaka.com`
- **Mot de passe**: `admin123`

---

## 🆘 Problèmes courants

### ❌ "Cannot connect to database"

1. Vérifiez que PostgreSQL est démarré :
   - Ouvrez "Services" Windows (Win + R → `services.msc`)
   - Cherchez "postgresql-x64-16" → Statut doit être "Running"

2. Vérifiez votre `.env` :
   - Le mot de passe est-il correct ?
   - Le port est-il 5432 ?

### ❌ "Port 5000 already in use"

Changez le port dans `.env` :
```env
PORT=5001
```

### ❌ Migration échoue

Réinitialisez tout :
```powershell
npx prisma migrate reset
npm run seed
```

---

## 📞 Support

Si vous rencontrez des problèmes, vérifiez :
1. Les logs dans `Backend/logs/`
2. La console PowerShell pour les erreurs
3. Le README.md pour plus de détails
