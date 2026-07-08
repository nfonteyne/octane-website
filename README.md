# Octane — outil de gestion du groupe

Application interne pour le groupe : répertoire de morceaux travaillés (avec liens de tutos par instrument), suggestions de nouveaux morceaux avec vote nominatif, setlist du prochain concert (avec rappel) et historique des concerts passés.

Stack 100% JavaScript : backend Node.js/Express servant des pages HTML/CSS/JS vanilla (pas de framework front, pas de build step) + API REST, PostgreSQL, authentification via OpenID Connect contre une instance Authentik existante.

## Démarrage rapide (serveur avec Traefik)

Ce qui suit correspond au déploiement réel : Traefik en reverse proxy, Authentik sur le même réseau Docker externe `traefik-proxy`, l'app exposée sur `octane.dandrove.com`, l'image tirée de `ghcr.io` (voir [CI/CD](#cicd-et-mises-à-jour)).

```bash
git clone https://github.com/nfonteyne/octane-website.git
cd octane-website
cp .env.example .env
```

Éditer `.env` (au minimum) :

```
POSTGRES_PASSWORD=changeme
SESSION_SECRET=une-longue-chaine-aleatoire

AUTHENTIK_ISSUER_URL=http://authentik-server:9000/application/o/octane-website/
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_REDIRECT_URI=https://octane.dandrove.com/auth/callback
ADMIN_GROUP_NAME=octane-admins

TRAEFIK_NETWORK_NAME=traefik-proxy
APP_DOMAIN=octane.dandrove.com
```

`POSTGRES_PASSWORD` est la seule variable Postgres à renseigner : l'app se connecte avec des champs séparés (host/port/base/utilisateur déjà pré-remplis avec les valeurs par défaut du service `postgres`), pas une URL unique — donc n'importe quel caractère spécial dans le mot de passe (généré par `openssl rand -base64` par exemple) fonctionne sans encodage particulier.

`AUTHENTIK_ISSUER_URL` utilise ici le nom du conteneur Authentik sur le réseau `traefik-proxy` (remplacez `authentik-server` par le vrai nom de service de votre stack Authentik — `docker ps` sur cette stack vous le donnera) plutôt que l'URL publique, pour éviter un aller-retour inutile par Traefik. L'URL publique fonctionne aussi si vous préférez.

Pour générer `POSTGRES_PASSWORD` et `SESSION_SECRET` (valeurs aléatoires, à ne jamais commiter) :

```bash
openssl rand -base64 24   # POSTGRES_PASSWORD
openssl rand -hex 32      # SESSION_SECRET
```

Si `openssl` n'est pas disponible, une alternative sans dépendance :

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"   # POSTGRES_PASSWORD
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"      # SESSION_SECRET
```

Collez chaque valeur générée dans `.env` à la place de `changeme` / `une-longue-chaine-aleatoire`.

Si le réseau `traefik-proxy` n'existe pas encore (il devrait déjà exister si Authentik tourne dessus) :

```bash
docker network create traefik-proxy
```

Puis démarrer :

```bash
docker compose pull
docker compose up -d
```

`docker-compose.yml` (à la racine du repo) est déjà prêt pour ce cas précis :

```yaml
services:
  app:
    image: ${APP_IMAGE:-ghcr.io/nfonteyne/octane-website:latest}
    container_name: octane-app
    restart: unless-stopped
    env_file: .env
    depends_on:
      - postgres
    networks:
      - default
      - traefik-proxy
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=traefik-proxy"
      - "traefik.http.routers.octane.rule=Host(`${APP_DOMAIN:-octane.dandrove.com}`)"
      - "traefik.http.routers.octane.entrypoints=websecure"
      - "traefik.http.routers.octane.tls.certresolver=myresolver"
      - "traefik.http.services.octane.loadbalancer.server.port=3000"

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: octane
      POSTGRES_USER: octane
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - default

networks:
  default:
  traefik-proxy:
    external: true
    name: ${TRAEFIK_NETWORK_NAME:-traefik-proxy}

volumes:
  pgdata:
```

Pas de port publié sur l'hôte : Traefik parle directement au conteneur `octane-app` sur le réseau `traefik-proxy`, port 3000 (celui écouté par Express en interne).

## Intégration Traefik

Le `docker-compose.yml` ci-dessus utilise déjà les **labels Docker** (option recommandée). Deux cas selon la configuration de votre Traefik :

### Option A — provider Docker (labels), déjà en place

Si Traefik tourne avec le provider Docker activé (`--providers.docker=true` et accès au socket Docker) et surveille le réseau `traefik-proxy`, rien à faire de plus : les labels du service `app` suffisent. Vérifiez juste que :
- Traefik est bien attaché au réseau `traefik-proxy`,
- l'entrypoint `websecure` et le `certResolver` `myresolver` correspondent aux noms utilisés dans votre configuration Traefik (adaptez les labels sinon).

### Option B — provider fichier (dynamic config)

Si votre Traefik est plutôt piloté par des fichiers de configuration dynamique (comme votre exemple `guitar-scale`), retirez les `labels` du service `app` dans `docker-compose.yml` et ajoutez ce fichier à votre dossier de conf dynamique Traefik (ex: `dynamic/octane.yml`) :

```yaml
http:
  routers:
    octane:
      entryPoints: ["websecure"]
      rule: Host(`octane.dandrove.com`)
      service: octane-service
      tls:
        certResolver: myresolver

  services:
    octane-service:
      loadBalancer:
        servers:
          - url: "http://octane-app:3000"
```

`octane-app` est le `container_name` fixé dans `docker-compose.yml` — Docker en fait un nom résolvable en DNS pour tout conteneur attaché au même réseau (`traefik-proxy`), donc Traefik peut l'atteindre directement par ce nom sans passer par le provider Docker.

## Architecture

```mermaid
flowchart LR
    subgraph Client["Navigateur"]
        UI["HTML / CSS / JS vanilla"]
    end

    subgraph App["Conteneur app (Node.js / Express)"]
        Static["Fichiers statiques (public/)"]
        API["API REST /api/*"]
        Auth["/auth/login, /auth/callback, /auth/logout"]
    end

    subgraph Infra["Infrastructure existante / conteneurs"]
        DB[(PostgreSQL)]
        Authentik["Authentik (OIDC)"]
    end

    UI -- "fetch()" --> API
    UI -- "redirection navigateur" --> Auth
    Auth -- "OIDC discovery + auth code + PKCE" --> Authentik
    API --> DB
    Auth -- "session (connect-pg-simple)" --> DB
```

## Modèle de données

```mermaid
erDiagram
    USERS ||--o{ SONGS : "ajoute"
    USERS ||--o{ SUGGESTIONS : "propose"
    USERS ||--o{ SUGGESTION_VOTES : "vote"
    USERS ||--o{ SETLISTS : "cree"
    SONGS ||--o{ SONG_TUTORIALS : "a des tutos"
    INSTRUMENTS ||--o{ SONG_TUTORIALS : "concerne"
    SUGGESTIONS ||--o{ SUGGESTION_VOTES : "recoit"
    SUGGESTIONS }o--o| SONGS : "promue en"
    SETLISTS ||--o{ SETLIST_SONGS : "contient"
    SONGS ||--o{ SETLIST_SONGS : "figure dans"

    USERS {
        int id PK
        text authentik_sub UK
        text name
        text email
        bool is_admin
    }
    SONGS {
        int id PK
        text title
        text artist
        text notes
    }
    SONG_TUTORIALS {
        int id PK
        int song_id FK
        int instrument_id FK
        text url
        text label
    }
    SUGGESTIONS {
        int id PK
        text title
        text youtube_url
        text status
        int promoted_song_id FK
    }
    SUGGESTION_VOTES {
        int id PK
        int suggestion_id FK
        int user_id FK
        text vote
        text comment
    }
    SETLISTS {
        int id PK
        text name
        text venue
        date concert_date
    }
    SETLIST_SONGS {
        int id PK
        int setlist_id FK
        int song_id FK
        int position
        text note
        bool is_encore
    }
```

## Fonctionnalités

| Page | Accès | Description |
|---|---|---|
| `/index.html` | Tous (lecture et écriture) | Répertoire des morceaux travaillés, avec recherche instantanée (titre/artiste), liens/vignettes YouTube et Spotify, tutos embarqués par morceau et par instrument. Ajout avec autocomplete titre/artiste + liens auto-trouvés ([détails](#recherche-automatique-de-morceaux)) |
| `/suggestions.html` | Tous | Proposer un morceau (liens YouTube et Spotify + note libre), voter approuver/rejeter avec commentaire (attribué nominativement), ajouter une suggestion au répertoire |
| `/setlist.html` | Tous (lecture et écriture) | Setlist du prochain concert : choix des morceaux du répertoire, ordre, notes, section rappel, lien "Écouter la setlist sur YouTube" |
| `/history.html`, `/history-detail.html` | Tous (lecture et écriture) | Historique des concerts passés, modifiable (date, morceaux, ordre, rappel) et supprimable, avec le même lien playlist YouTube. `/history.html` propose deux vues : chronologique (par défaut, tous les concerts détaillés avec YouTube embarqué par morceau, du plus récent au plus ancien) et réduite (liste compacte, comme avant) |
| `/profile.html` | Chacun voit le sien | Profil issu d'Authentik (nom, avatar, groupes) + votre activité (morceaux ajoutés, suggestions, votes) |
| `/calendar.html` | Tous (lecture et écriture) | Disponibilités du groupe pour les 3 prochaines semaines (calendrier, filtres par personne, modale par jour) — [détails](#disponibilités-calendrier) |

Le mode par défaut est la consultation ; les pages Répertoire, Setlist et Suggestions sont interactives pour toute personne connectée (chaque action reste attribuée nominativement via Authentik).

Un bouton clair/sombre dans la barre de navigation permet de forcer un thème (mémorisé par navigateur) ; sans préférence explicite, l'app suit le thème du système.

## Rôles

- **Membre** : tout le monde — consulte, ajoute/modifie/supprime des morceaux du répertoire et leurs tutos, crée/modifie/supprime des concerts (à venir ou passés) et leur setlist, propose des suggestions, vote/commente, ajoute une suggestion au répertoire.
- **Admin** : en plus, rejette ou supprime une suggestion (modération).

Le rôle admin n'est volontairement pas plus étendu pour l'instant : son périmètre exact (au-delà de la modération des suggestions) reste ouvert et pourra évoluer. Il n'y a pas de gestion des utilisateurs dans l'application elle-même — Authentik reste la seule source de vérité pour qui a accès et qui est admin (claim `groups`, recalculé à chaque connexion).

## Recherche automatique de morceaux

En tapant un titre dans le formulaire "Ajouter un morceau" du répertoire, une liste de suggestions apparaît (titre, artiste, pochette), basée sur l'[iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/) d'Apple — **gratuite, sans clé, sans inscription**, donc ça fonctionne dès le premier déploiement sans rien configurer.

En sélectionnant une suggestion, l'app tente aussi de retrouver automatiquement les liens **YouTube** et **Spotify** correspondants. Ça, en revanche, nécessite des identifiants (facultatifs) :

| Variable | Obtenir | Sans elle |
|---|---|---|
| `YOUTUBE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/) → activer "YouTube Data API v3" → créer une clé API (quota gratuit largement suffisant pour un groupe) | Le champ lien YouTube reste vide, saisie manuelle |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | [Spotify for Developers](https://developer.spotify.com/dashboard) → créer une app → Client ID/Secret (flux "Client Credentials", pas de compte utilisateur impliqué) | Le champ lien Spotify reste vide, saisie manuelle |

Si aucune des deux n'est configurée, l'autocomplete titre/artiste marche quand même — seuls les liens ne se remplissent pas tout seuls. Vous pouvez ajouter ces clés à tout moment dans `.env` sans changement de code, juste un redémarrage du conteneur `app`.

Si la recherche ne trouve rien (morceau trop obscur, faute de frappe...), rien ne bloque : titre, artiste et liens restent modifiables à la main comme avant.

## Setlist en playlist YouTube

Sur la page d'un concert (prochain concert ou historique), un lien **"Écouter la setlist sur YouTube"** ouvre tous les morceaux ayant un lien YouTube à la suite, dans l'ordre du programme puis du rappel — via le lecteur "mix" temporaire de YouTube (`watch_videos?video_ids=...`), sans authentification ni appel API. Le lien n'apparaît que si au moins un morceau de la setlist a un lien YouTube renseigné.

Une vraie **playlist Spotify** (persistante, sur un compte Spotify) nécessiterait une autorisation OAuth d'un compte Spotify précis — le Client ID/Secret déjà utilisé pour la recherche automatique ([détails](#recherche-automatique-de-morceaux)) ne permet que la recherche, pas la création de playlists. Pas encore implémenté.

## Disponibilités (calendrier)

La page `/calendar.html` montre, pour les 3 prochaines semaines, les créneaux de répétition (lun–ven 18h30–21h, sam–dim 15h–19h) où chaque membre est disponible — calculé par un workflow **n8n** externe qui interroge Google Calendar (FreeBusy API) de chaque personne. Cette fonctionnalité est une fusion complète de l'ancien projet séparé [octane-calendar](https://github.com/nfonteyne/octane-calendar) dans cette application (même thème, même authentification, un seul déploiement).

### Fonctionnement

```mermaid
flowchart LR
    UI["Page /calendar.html"]
    API["API /api/calendar/*"]
    N8N["Workflow n8n"]
    GCal[("Google Calendar<br/>FreeBusy API")]
    DB[("Postgres<br/>calendar_*")]

    UI -- "Actualiser" --> API
    API -- "déclenche (GET webhook)" --> N8N
    N8N -- "interroge" --> GCal
    N8N -- "{ slots: [...] }" --> API
    API -- "ingère" --> DB
    DB -- "lecture" --> API
    API -- "sert les données" --> UI
```

- Bouton **"Actualiser les disponibilités"** : appelle `POST /api/calendar/refresh`, qui déclenche le webhook n8n et attend sa réponse en tâche de fond (jusqu'à 5 min), pendant que la page sonde `GET /api/calendar/workflow-status` toutes les 4 secondes.
- Deux endpoints sont appelés **directement par n8n** (pas par le navigateur, donc pas de session possible) : `POST /api/calendar/ingest` (résultats d'une ingestion) et `POST /api/calendar/workflow-error` (notifié par le workflow d'erreur n8n). Ils sont protégés par un secret partagé plutôt que par la connexion Authentik :
  ```
  X-Calendar-Webhook-Secret: <valeur de CALENDAR_WEBHOOK_SECRET>
  ```
  Si vous reprenez un workflow n8n existant (depuis l'ancien `octane-calendar`), mettez à jour ses noeuds HTTP pour pointer vers `https://octane.dandrove.com/api/calendar/...` et ajouter ce header.

### Variables d'environnement

| Variable | Description |
|---|---|
| `N8N_WEBHOOK_URL` | URL complète du webhook n8n (production, pas l'URL de test) — **optionnel** : sans elle, la consultation des disponibilités déjà connues fonctionne, seul le bouton "Actualiser" renvoie une erreur explicite |
| `N8N_WEBHOOK_USER` / `N8N_WEBHOOK_PASS` | Identifiants HTTP basic-auth configurés sur le noeud webhook n8n, si vous en avez mis un |
| `CALENDAR_WEBHOOK_SECRET` | **Requis** — générer avec `openssl rand -hex 32`, à renseigner aussi côté n8n (header `X-Calendar-Webhook-Secret`) |

### Personnes suivies

La liste des personnes (et leur couleur) est amorcée en base par la migration `006_calendar_seed_people.sql` (Nathan, Raphaël, Yann, Jules, AK — mêmes noms que dans le workflow n8n d'origine, dont le mapping calendrier Google ↔ nom se fait dans le noeud "Build FreeBusy Request"). De nouvelles personnes apparaissant dans les données ingérées sont ajoutées automatiquement avec une couleur de la palette.

## Prérequis

- Docker + Docker Compose
- Une instance Authentik déjà en place
- Un reverse proxy Traefik déjà en place, avec un réseau Docker externe partagé (`traefik-proxy` dans nos exemples) sur lequel Authentik est également connecté

## Configuration Authentik

1. Créer un **Provider** OAuth2/OIDC dans Authentik, avec comme redirect URI la valeur que vous mettrez dans `OIDC_REDIRECT_URI` (ex: `https://octane.dandrove.com/auth/callback`).
2. Créer une **Application** Authentik pointant vers ce provider.
3. S'assurer qu'un **scope mapping** expose un claim `groups` dans l'ID token (Authentik a un mapping `groups` intégré dans les versions récentes, sinon créer un mapping personnalisé renvoyant `request.user.ak_groups.all()`).
4. Créer un **groupe** Authentik (ex: `octane-admins`) et y ajouter les membres qui doivent être admins de l'application.
5. Noter le Client ID / Client Secret du provider.
6. Optionnel — pour afficher l'avatar sur la page profil (`/profile.html`) : le scope `profile` doit renvoyer un claim `picture`. Si votre version d'Authentik ne le fait pas nativement, ajoutez un scope mapping personnalisé renvoyant l'URL de l'avatar (ex: `request.user.avatar`). Sans ce claim, un avatar généré à partir des initiales est affiché à la place — aucune configuration n'est requise pour ce cas.

## Variables d'environnement (référence complète)

Le [Démarrage rapide](#démarrage-rapide-serveur-avec-traefik) ci-dessus couvre le cas concret. Référence complète des variables de `.env` :

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Mot de passe Postgres, utilisé à la fois par le service `postgres` et par l'app (connexion par champs séparés, pas d'URL — aucun caractère à encoder) |
| `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` | Optionnels, déjà cohérents par défaut avec le service `postgres` du compose (`postgres`/`5432`/`octane`/`octane`) |
| `SESSION_SECRET` | Chaîne aléatoire longue pour signer les cookies de session |
| `AUTHENTIK_ISSUER_URL` | URL d'issuer OIDC de l'application Authentik (interne, ex: `http://authentik-server:9000/application/o/octane-website/`, ou publique) |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | Identifiants du provider Authentik |
| `OIDC_REDIRECT_URI` | URL publique de callback, doit correspondre à celle configurée dans Authentik (ex: `https://octane.dandrove.com/auth/callback`) |
| `ADMIN_GROUP_NAME` | Nom du groupe Authentik dont les membres deviennent admins |
| `AUTHENTIK_PUBLIC_URL` | Optionnel — URL publique d'Authentik, pour afficher un lien "Mon compte" (nav + page profil) permettant à chacun de changer son mot de passe. Masqué si absent |
| `TRAEFIK_NETWORK_NAME` | Nom du réseau Docker externe partagé avec Traefik et Authentik (défaut `traefik-proxy`) |
| `APP_DOMAIN` | Nom de domaine public utilisé par Traefik pour router vers l'app (ex: `octane.dandrove.com`) |
| `APP_PORT` | Port hôte utilisé uniquement par `docker-compose.dev.yml` (test local sans Traefik) |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` / `YOUTUBE_API_KEY` | Optionnels — voir [Recherche automatique de morceaux](#recherche-automatique-de-morceaux) |
| `N8N_WEBHOOK_URL` / `N8N_WEBHOOK_USER` / `N8N_WEBHOOK_PASS` | Optionnels — voir [Disponibilités (calendrier)](#disponibilités-calendrier) |
| `CALENDAR_WEBHOOK_SECRET` | Requis — voir [Disponibilités (calendrier)](#disponibilités-calendrier) |

Les migrations SQL (`src/db/migrations/*.sql`) sont exécutées automatiquement au démarrage du conteneur `app`, de façon idempotente (une table `schema_migrations` garde la trace des fichiers déjà appliqués).

## Tester en local sans Authentik (ex: dans WSL)

Pas besoin d'avoir Authentik pour essayer l'application en premier lieu. Un mode `DEV_BYPASS_AUTH` remplace la redirection OIDC par un simple formulaire "choisissez un nom" — **à n'utiliser qu'en local, jamais en production**.

```bash
cp .env.example .env
```

Dans `.env`, mettre :

```
DEV_BYPASS_AUTH=true
POSTGRES_PASSWORD=changeme
SESSION_SECRET=une-longue-chaine-aleatoire
```

(Les variables `AUTHENTIK_*` / `OIDC_*` peuvent rester vides tant que `DEV_BYPASS_AUTH=true`.)

Puis, avec Docker Compose (fichier séparé `docker-compose.dev.yml`, sans dépendance au réseau Authentik) :

```bash
docker compose -f docker-compose.dev.yml up --build
```

Ou sans Docker du tout, avec un Postgres local :

```bash
npm install
# démarrer un Postgres local, puis dans .env : PGHOST=localhost (au lieu du
# nom de service Docker "postgres" par défaut) + POSTGRES_PASSWORD assorti
npm run migrate
npm start
```

Ouvrir `http://localhost:3000` : vous serez redirigé vers `/auth/login`, qui affiche un formulaire pour choisir un nom (et cocher "Compte admin" si besoin) au lieu de passer par Authentik. Chaque nom saisi crée un utilisateur distinct et persistant en base — pratique pour tester le vote sur les suggestions avec plusieurs "personnes" (ouvrez un autre navigateur ou une fenêtre de navigation privée pour vous connecter sous un second nom).

Une fois satisfait, repassez `DEV_BYPASS_AUTH=false` et configurez les variables `AUTHENTIK_*`/`OIDC_*` avant de déployer avec `docker-compose.yml` (celui avec le réseau Authentik).

## CI/CD et mises à jour

Le workflow `.github/workflows/ci.yml` se déclenche **uniquement sur push vers `main`** :

```mermaid
flowchart LR
    Push["push sur main"] --> Test["Job test\nnpm ci + npm test"]
    Test -- succès --> Build["Job build-and-push\ndocker build (app seule)"]
    Build --> Push2["push vers ghcr.io\n:latest"]
    Push2 -. "détecte le nouveau digest" .-> Watchtower["Watchtower (sur votre serveur)"]
    Watchtower --> Redeploy["redéploie le conteneur app"]
```

1. **Job `test`** : installe les dépendances et lance `npm test` (tests unitaires avec le test runner natif de Node — `node --test`, aucune dépendance de test supplémentaire). Actuellement couvre la validation des liens YouTube/Spotify (`test/*.test.js`).
2. **Job `build-and-push`** (uniquement si les tests passent) : construit **uniquement l'image de l'app** (le `Dockerfile` ne contient que Node/Express, jamais Postgres) et la publie sur `ghcr.io/nfonteyne/octane-website:latest`.

Sur votre serveur, `docker-compose.yml` référence cette image directement (`image: ghcr.io/nfonteyne/octane-website:latest`) au lieu de la construire — Watchtower peut donc la surveiller et la mettre à jour automatiquement dès qu'un nouveau push sur `main` produit une nouvelle image.

Si le repo GitHub est privé, le package `ghcr.io` publié le sera aussi : sur le serveur, faites une fois :

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u nfonteyne --password-stdin
```

avec un token GitHub (classic PAT ou fine-grained) ayant le scope `read:packages`.

Pour lancer les tests en local :

```bash
npm test
```

## Sauvegarde de la base de données

Aucune sauvegarde automatique n'est intégrée à l'application — c'est volontaire, pour que vous gardiez la main sur votre solution de backup externe. Les données Postgres vivent entièrement dans le volume Docker nommé **`pgdata`** (déclaré dans `docker-compose.yml`, monté sur `/var/lib/postgresql/data` du service `postgres`).

Repérer le nom réel du volume (préfixé par le nom du projet Compose) :

```bash
docker volume ls | grep pgdata
docker volume inspect <nom_du_volume>   # donne le Mountpoint sur le disque de l'hôte
```

Deux façons de sauvegarder depuis l'extérieur :

- **Backup logique (`pg_dump`)**, recommandé, portable entre versions de Postgres :
  ```bash
  docker compose exec postgres pg_dump -U octane -d octane -F c -f /tmp/octane.dump
  docker compose cp postgres:/tmp/octane.dump ./octane_$(date +%Y%m%d).dump
  ```
- **Backup brut du volume**, via le `Mountpoint` renvoyé par `docker volume inspect`, ou avec un conteneur utilitaire :
  ```bash
  docker run --rm -v <nom_du_volume>:/data -v "$(pwd)/backups":/backup alpine \
    tar czf /backup/pgdata_$(date +%Y%m%d).tar.gz -C /data .
  ```

Branchez l'une de ces commandes sur votre outil de backup externe habituel (cron, Veeam, Borg, etc.).

## Structure du projet

```
octane-website/
├── .github/workflows/ci.yml   # tests + build/push de l'image Docker sur push main
├── Dockerfile, docker-compose.yml, docker-compose.dev.yml
├── test/               # tests unitaires (node --test)
├── src/
│   ├── server.js, app.js, config.js
│   ├── db/            # pool Postgres, migration runner, migrations SQL
│   ├── auth/          # OIDC (Authentik), session, middleware, routes /auth
│   ├── routes/        # routes API /api/*
│   ├── repositories/  # accès SQL par table
│   └── lib/           # helpers purs (validation YouTube/Spotify) — couverts par les tests
└── public/
    ├── *.html          # une page par fonctionnalité
    ├── css/style.css
    └── js/             # fetch wrapper, rendu, logique par page
```
