# Excellence School Monastir

Application de suivi scolaire d’une école primaire privée, pour les parents, les enseignants, l’économe, le modérateur et l’administration. Installable sur téléphone (PWA), avec notifications.

| Partie | Technologie | Dossier |
|---|---|---|
| Application (web + mobile installable) | Angular 19, signals, PWA (service worker) | `src/`, `public/` |
| API | NestJS 11, TypeORM, JWT, Web Push | `server/` |
| Base de données | PostgreSQL 16 | `database/` |

## Fonctionnalités branchées sur l’API

- **Comptes** : connexion par JWT, mot de passe provisoire à changer à la première connexion, désactivation immédiate des comptes.
- **Parents** :
  - inscription en ligne, validée par l’administration (rattachement à un vrai élève) ;
  - suivi de leurs enfants validés uniquement.
- **Devoirs** : publiés par l’enseignant ; **chaque nouveau devoir notifie les parents** de la classe (dans l’app et en push sur le téléphone) ; le parent coche « fait ».
- **Notes et bulletins** :
  - l’enseignant saisit les notes ;
  - l’administration calcule les bulletins (moyennes, rang, mention) puis les publie, ce qui les fige ;
  - le parent ne voit que les bulletins publiés de ses enfants.
- **Messagerie** : échanges privés parent ↔ enseignant pour un élève, et notes de l’enseignant (encouragement, travail…). Seuls les parents de l’élève et cet enseignant y ont accès.
- **Calendrier scolaire** (vues mois et semaine) : créé et modifié uniquement par l’admin et le modérateur. Chaque événement est **public** (visible par les parents) ou **privé** (personnel uniquement) ; le filtrage est fait par l’API.
- **Administration** : élèves, classes (les matières sont créées automatiquement), personnel, parents, demandes d’inscription, bulletins.

> Encore sur les données de démonstration du navigateur (`SchoolDataService`) : absences, emploi du temps, frais et paiements, rendez-vous, actualités, avis du site, matières et niveaux.

## Démarrage local

Prérequis : Node 20+, Docker.

```bash
# 1. Base de données (port 5434) : structure + données de démo
docker compose up -d

# 2. API → http://localhost:3000/api
cd server
cp .env.example .env        # renseigner JWT_SECRET (32+ caractères)
npm install
npm run start:dev

# 3. Application → http://localhost:4200
cd ..
npm install
npm start
```

### Comptes de démonstration (`database/seed-demo.sql`)

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | admin@excellence.tn | Admin123! |
| Parent | asma.belkahla@excellence.tn | Parent123! |
| Enseignant | teacher@excellence.tn | Teacher123! |
| Économe | econome@excellence.tn | Econome123! |
| Modérateur | moderator@excellence.tn | Moderator123! |

> Ces mots de passe sont publics : `seed-demo.sql` ne doit **jamais** être chargé en production.
> La structure seule est dans `database/schema.sql` (sans aucun compte).
> Base locale créée avec une ancienne version : `docker compose down -v && docker compose up -d`.

## Base de données

| Fichier | Contenu | Production |
|---|---|---|
| `database/schema.sql` | Tables, index, migrations, matières et domaines du programme | ✅ à exécuter (rejouable sans risque) |
| `database/seed-demo.sql` | Comptes, classes, élèves, notes et devoirs de démonstration | ❌ local uniquement |

Le premier administrateur de production est créé automatiquement par l’API à partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD` (mot de passe à changer à la première connexion).

## Sécurité

- **API** :
  - `JwtAuthGuard` relit le compte à chaque requête : une désactivation ou un changement de rôle s’applique tout de suite, et un changement de mot de passe ferme les autres sessions ;
  - `@Roles(...)` limite chaque route aux rôles autorisés ;
  - validation stricte des DTO, rate-limit sur la connexion, CORS limité au front-end, en-têtes `helmet`.
- **Données privées** : un parent n’accède qu’à ses enfants rattachés (routes `/api/me/*`), un enseignant qu’à ses matières et classes. Les messages ne sont lisibles ni par l’admin ni par les autres familles.
- **Notifications** : la déconnexion désinscrit l’appareil des notifications push (téléphone partagé).
- **Front-end** : `authGuard` / `roleGuard` / `passwordChangeGuard` ; aucun secret dans `src/` (tout y est public).

## Scripts

| Commande | Dossier | Effet |
|---|---|---|
| `npm start` | racine | serveur de développement (sans service worker) |
| `npm run build` | racine | build de production PWA (`dist/excellence-school/browser`) |
| `npm test` | racine | tests unitaires (Karma) |
| `npm run start:dev` | `server/` | API en mode watch |
| `npm run build` / `npm start` | `server/` | compile / lance l’API |

## Déploiement gratuit

Voir **[DEPLOYMENT.md](DEPLOYMENT.md)** : Neon (PostgreSQL) + Render (API et application), 0 €.
