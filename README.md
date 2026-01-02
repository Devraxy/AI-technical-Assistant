Ceci est le projet de démarrage [assistant-ui](https://github.com/Yonom/assistant-ui).

## Démarrage

### Variables d'environnement

Créez un fichier `.env.local` (ou `.env` pour la production) avec les variables requises suivantes :

#### Variables requises

```bash
# Configuration de la base de données (Requis)
DATABASE_URL="postgresql://user:password@localhost:5432/database_name?schema=public"

# Clé API OpenAI (Requis)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Variables optionnelles

```bash
# Configuration de l'application
APP_NAME="Assistant IA"
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Configuration email (Requis pour la vérification d'email et la réinitialisation de mot de passe)
# Choisissez UNE des options suivantes :

# Option 1 : Resend (Recommandé - Niveau gratuit disponible)
# Obtenez votre clé API sur : https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM="Assistant IA <onboarding@resend.dev>"
# Note : Mettez à jour l'adresse email ci-dessus avec votre domaine vérifié dans Resend

# Option 2 : SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
EMAIL_FROM="Assistant IA <noreply@example.com>"

# Option 3 : Gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
EMAIL_FROM="Assistant IA <your-email@gmail.com>"
```

**Note pour Gmail :** Vous devez activer la vérification en deux étapes et générer un mot de passe d'application depuis les [Paramètres du compte Google](https://myaccount.google.com/apppasswords).

**Note pour Resend :** Inscrivez-vous sur [resend.com](https://resend.com) pour obtenir une clé API gratuite. Le niveau gratuit comprend 3 000 emails/mois et 100 emails/jour.

### Étapes de configuration

1. **Configurez votre base de données :**

   ```bash
   # Exécutez les migrations
   npm run db:migrate

   # (Optionnel) Remplissez la base de données
   npm run db:seed
   ```

2. **Configurez les variables d'environnement** (voir ci-dessus)

3. **Lancez le serveur de développement :**

```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
# ou
bun dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur pour voir le résultat.

Vous pouvez commencer à modifier la page en modifiant `app/page.tsx`. La page se met à jour automatiquement lorsque vous modifiez le fichier.

## Fonctionnalités

### Vérification d'email

Les nouveaux utilisateurs doivent vérifier leur adresse email avant de pouvoir se connecter. Après l'inscription :

1. Les utilisateurs reçoivent un email de vérification avec un lien et un code à 6 chiffres
2. Ils peuvent cliquer sur le lien ou entrer le code sur la page de vérification
3. Une fois vérifiés, ils sont automatiquement connectés

Le lien de vérification expire après 24 heures. Les utilisateurs peuvent demander un nouvel email de vérification si nécessaire.
