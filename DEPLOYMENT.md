# Déploiement 100 % gratuit

| Élément | Service | Offre gratuite | Carte bancaire |
|---|---|---|---|
| Base PostgreSQL | **Neon** | 0,5 Go de stockage, se met en veille quand elle n’est pas utilisée | Non |
| API NestJS | **Render** (web service) | 750 h/mois ; se met en veille après 15 min sans visite | Non |
| Application (PWA) | **Render** (static site) | Gratuit, CDN mondial, HTTPS | Non |
| Code source | **GitHub** | Dépôt privé gratuit | Non |

Les deux services Render sont décrits dans `render.yaml`. Ils sont créés en une seule opération (« Blueprint »).

> **Limite du gratuit** : après 15 minutes sans visite, l’API se met en veille. La première ouverture suivante prend alors **30 à 60 secondes**, puis tout est rapide. Pour l’éviter (facultatif), voir l’étape 6.

---

## 1. Mettre le code sur GitHub

Ce dossier (`web-app/`) doit être **son propre dépôt git**. Il ne doit pas faire partie du dépôt de votre dossier utilisateur.

```bash
cd web-app
git init -b main                 # déjà fait si le dossier contient .git
git add .
git status                       # vérifier : aucun fichier .env, aucun node_modules
git commit -m "Excellence School — première version"
```

Ensuite, sur github.com : **New repository** → nom `excellence-school` → **Private** → *Create*. Puis :

```bash
git remote add origin https://github.com/asmabelkahla/school.git
git push -u origin main
```

## 2. Créer la base sur Neon

1. Créez un compte sur https://neon.tech (connexion avec GitHub possible).
2. Créez un projet `excellence-school`, en choisissant la région **Europe (Frankfurt)** si elle est proposée.
3. Ouvrez **SQL Editor**, collez **tout le contenu de `database/schema.sql`**, puis cliquez sur **Run**.
   - ⚠️ N’exécutez **pas** `seed-demo.sql` : il contient des comptes de démonstration aux mots de passe publics.
4. Dans **Dashboard → Connection string**, copiez l’URL. Elle a la forme `postgresql://user:motdepasse@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.

## 3. Générer les clés des notifications push (une seule fois)

Sur votre ordinateur :

```bash
npx web-push generate-vapid-keys
```

Gardez les deux clés affichées (**Public Key** et **Private Key**). Ne les partagez pas et ne les mettez pas dans le code.

## 4. Déployer sur Render

1. Créez un compte sur https://render.com avec GitHub, puis autorisez l’accès au dépôt.
2. **New → Blueprint** → choisissez le dépôt. Render lit `render.yaml` et propose deux services : `excellence-api` et `excellence-web`.
3. Renseignez les variables demandées :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | l’URL Neon de l’étape 2 |
   | `ADMIN_EMAIL` | l’email du premier administrateur (ex. `direction@votre-ecole.tn`) |
   | `ADMIN_PASSWORD` | un mot de passe provisoire (8 caractères minimum, avec une lettre et un chiffre) |
   | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | les clés de l’étape 3 |
   | `CORS_ORIGINS` | laisser vide (ou un domaine personnalisé, voir l’étape 7) |

   `JWT_SECRET` est généré automatiquement. L’adresse de l’API et celle de l’application sont reliées automatiquement entre elles.
4. Cliquez sur **Apply**. La première construction prend 5 à 10 minutes.
5. L’application est en ligne à l’adresse affichée pour `excellence-web` (ex. `https://excellence-web.onrender.com`).

## 5. Première connexion

1. Ouvrez l’application et connectez-vous avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. L’application demande de **choisir un nouveau mot de passe**. Le mot de passe provisoire n’est alors plus valable.
3. Dans Render, supprimez `ADMIN_PASSWORD` des variables d’`excellence-api`. Il ne sert qu’à créer le premier compte.
4. Créez ensuite :
   - **Élèves & Classes → Classes** : les classes, avec leur enseignant principal (les matières sont ajoutées automatiquement) ;
   - **Élèves** : les élèves ;
   - **Personnel** : les enseignants (un mot de passe provisoire s’affiche une seule fois : transmettez-le) ;
   - **Parents** : les parents reçus à l’accueil. Les parents peuvent aussi s’inscrire en ligne, puis vous validez leur demande dans **Inscriptions Parents**.

## 6. (Facultatif) Éviter la mise en veille

Un service gratuit comme https://cron-job.org peut appeler `https://<excellence-api>.onrender.com/api/health` **toutes les 14 minutes**, de 6 h à 22 h. L’API reste alors réveillée pendant la journée scolaire et reste sous les 750 h gratuites du mois.

## 7. (Facultatif) Nom de domaine

Pour un domaine personnel, par exemple `app.excellence-school.tn` :
1. Dans Render, ouvrez `excellence-web` → **Settings → Custom Domains** → ajoutez le domaine. Le certificat HTTPS est gratuit.
2. Dans `excellence-api`, mettez `CORS_ORIGINS=https://app.excellence-school.tn`.

Le domaine lui-même est payant (environ 10 à 30 € par an). Tout le reste reste gratuit.

---

## Installer l’application sur les téléphones

Envoyez aux parents l’adresse de l’application. Ensuite :
- **Android (Chrome)** : un bandeau « Installer l’application » s’affiche. Sinon : menu ⋮ → *Installer l’application*.
- **iPhone (Safari)** : bouton Partager → *Sur l’écran d’accueil*. Les notifications fonctionnent à partir d’iOS 16.4, une fois l’application installée.
- Dans l’application, la cloche 🔔 → **Activer** permet de recevoir les devoirs, les messages et les bulletins.

La page **Menu → Installer l’App Mobile** guide les parents pas à pas.

## Mettre à jour

Chaque `git push` sur `main` redéploie automatiquement. Les téléphones affichent alors « Une nouvelle version est prête » → **Mettre à jour**.
Si `database/schema.sql` a changé, ré-exécutez-le dans l’éditeur SQL de Neon : il est rejouable sans risque.

## Vérifications après déploiement

- [ ] `https://<excellence-api>.onrender.com/api/health` répond `"ok": true`
- [ ] Connexion admin, changement du mot de passe provisoire demandé
- [ ] `admin@excellence.tn` / `Admin123!` est **refusé** (pas de données de démo)
- [ ] Une page protégée ouverte sans connexion renvoie vers `/login`
- [ ] Devoir publié par un enseignant → notification chez le parent (cloche et téléphone)
- [ ] Sur un téléphone : l’application s’installe et s’ouvre en plein écran
