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
DATABASE_URL=postgres://octane:changeme@postgres:5432/octane
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

`AUTHENTIK_ISSUER_URL` utilise ici le nom du conteneur Authentik sur le réseau `traefik-proxy` (remplacez `authentik-server` par le vrai nom de service de votre stack Authentik — `docker ps` sur cette stack vous le donnera) plutôt que l'URL publique, pour éviter un aller-retour inutile par Traefik. L'URL publique fonctionne aussi si vous préférez.

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
| `/index.html` | Tous (lecture et écriture) | Répertoire des morceaux travaillés, liens/vignettes YouTube et Spotify, tutos embarqués par morceau et par instrument |
| `/suggestions.html` | Tous | Proposer un morceau (avec lien YouTube embarqué + note libre), voter approuver/rejeter avec commentaire, attribué nominativement |
| `/setlist.html` | Tous (lecture et écriture) | Setlist du prochain concert : choix des morceaux du répertoire, ordre, notes, section rappel |
| `/history.html`, `/history-detail.html` | Tous (lecture seule) | Historique des setlists des concerts passés |

Le mode par défaut est la consultation ; les pages Répertoire, Setlist et Suggestions sont interactives pour toute personne connectée (chaque action reste attribuée nominativement via Authentik).

## Rôles

- **Membre** : tout le monde — consulte, ajoute/modifie/supprime des morceaux du répertoire et leurs tutos, crée/modifie des concerts et leur setlist, propose des suggestions, vote/commente.
- **Admin** : en plus, modère les suggestions (promouvoir une suggestion approuvée en morceau du répertoire, la rejeter, la supprimer).

Le rôle admin n'est volontairement pas plus étendu pour l'instant : son périmètre exact (au-delà de la modération des suggestions) reste ouvert et pourra évoluer. Il n'y a pas de gestion des utilisateurs dans l'application elle-même — Authentik reste la seule source de vérité pour qui a accès et qui est admin (claim `groups`, recalculé à chaque connexion).

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

## Variables d'environnement (référence complète)

Le [Démarrage rapide](#démarrage-rapide-serveur-avec-traefik) ci-dessus couvre le cas concret. Référence complète des variables de `.env` :

| Variable | Description |
|---|---|
| `DATABASE_URL` | Chaîne de connexion Postgres (déjà cohérente avec le service `postgres` du compose) |
| `POSTGRES_PASSWORD` | Mot de passe du service Postgres |
| `SESSION_SECRET` | Chaîne aléatoire longue pour signer les cookies de session |
| `AUTHENTIK_ISSUER_URL` | URL d'issuer OIDC de l'application Authentik (interne, ex: `http://authentik-server:9000/application/o/octane-website/`, ou publique) |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | Identifiants du provider Authentik |
| `OIDC_REDIRECT_URI` | URL publique de callback, doit correspondre à celle configurée dans Authentik (ex: `https://octane.dandrove.com/auth/callback`) |
| `ADMIN_GROUP_NAME` | Nom du groupe Authentik dont les membres deviennent admins |
| `TRAEFIK_NETWORK_NAME` | Nom du réseau Docker externe partagé avec Traefik et Authentik (défaut `traefik-proxy`) |
| `APP_DOMAIN` | Nom de domaine public utilisé par Traefik pour router vers l'app (ex: `octane.dandrove.com`) |
| `APP_PORT` | Port hôte utilisé uniquement par `docker-compose.dev.yml` (test local sans Traefik) |

Les migrations SQL (`src/db/migrations/*.sql`) sont exécutées automatiquement au démarrage du conteneur `app`, de façon idempotente (une table `schema_migrations` garde la trace des fichiers déjà appliqués).

## Tester en local sans Authentik (ex: dans WSL)

Pas besoin d'avoir Authentik pour essayer l'application en premier lieu. Un mode `DEV_BYPASS_AUTH` remplace la redirection OIDC par un simple formulaire "choisissez un nom" — **à n'utiliser qu'en local, jamais en production**.

```bash
cp .env.example .env
```

Dans `.env`, mettre :

```
DEV_BYPASS_AUTH=true
DATABASE_URL=postgres://octane:changeme@postgres:5432/octane
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
# démarrer un Postgres local, renseigner DATABASE_URL dans .env
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
