**Projet : API de gestion de fichiers (prototype)**

Résumé
- **But** : prototype d'une API permettant l'upload direct vers un stockage objet (S3/MinIO), le traitement asynchrone (scan, calcul de hash), et la distribution via URLs présignées.
- **Stack fournie** : Node.js + TypeScript, Express, AWS SDK v3 (S3), MinIO (local dev), PostgreSQL (prévu mais non intégré pour l'instant), worker simple (fichiers JSON pour prototypage).

**Fichiers importants**
- `API.md` : principes d'architecture et recommandations (source de la conception).
- `README.md` : checklist d'implémentation et points opérationnels.
- `DOCS.md` : ce document (guide d'usage et d'architecture pour dev).
- `package.json`, `tsconfig.json` : configuration du projet.
- `src/server.ts` : point d'entrée Express.
- `src/routes/upload.ts` : endpoints `POST /upload/request`, `POST /upload/complete`, `GET /upload/:key/download`, `GET /upload/:key/metadata`.
- `src/s3Client.ts` : helpers S3 (presigned PUT/GET, get object & hash).
- `src/worker.ts` : worker POC — boucle de polling sur `data/jobs.json` et écriture dans `data/metadata.json`.
- `src/scripts/init-dev.ps1` : script PowerShell pour démarrer `docker-compose`, créer le bucket MinIO et lancer le serveur.
- `docker-compose.yml` : services MinIO + Postgres (dev).
- `data/` : dossier runtime (jobs.json, metadata.json) utilisé par le prototype.

**Pré-requis (dev)**
- Docker + Docker Compose (pour MinIO et Postgres local).
- Node.js ≥ 18 recommandé.
- PowerShell (sur Windows) pour scripts d'init fournis.

Installation & démarrage rapide (développement)
1. Installer dépendances:
  - `npm install`
2. Démarrer les services dev et le serveur automatiquement (PowerShell):
  - `npm run init:dev` (ce script démarre `docker-compose`, crée le bucket `test-bucket` et lance le serveur dans une nouvelle fenêtre PowerShell)
3. Si tu veux démarrer manuellement:
  - `docker-compose up -d` (démarre MinIO + Postgres)
  - Créer le bucket (script fourni):
    ```powershell
    $env:MINIO_ENDPOINT='http://localhost:9000'
    $env:MINIO_ACCESS_KEY='minioadmin'
    $env:MINIO_SECRET_KEY='minioadmin'
    $env:S3_BUCKET='test-bucket'
    node .\src\scripts\create_bucket.js
    ```
  - Compiler et lancer le serveur:
    ```powershell
    npm run build
    $env:USE_MINIO='true'; $env:MINIO_ENDPOINT='http://localhost:9000'; $env:MINIO_ACCESS_KEY='minioadmin'; $env:MINIO_SECRET_KEY='minioadmin'; $env:S3_BUCKET='test-bucket'; node dist/server.js
    ```

Endpoints (prototype)
- `POST /upload/request` — génère une presigned PUT URL
  - Body JSON: `{ "filename": "name.txt", "contentType": "text/plain" }`
  - Response: `{ "url": "...", "key": "uploads/...", "expiresIn": 300 }`
  - Exemple PowerShell:
    ```powershell
    Invoke-RestMethod -Method Post -Uri http://localhost:3000/upload/request -ContentType 'application/json' -Body '{"filename":"test.txt","contentType":"text/plain"}'
    ```

- Upload direct (client → MinIO) en PUT avec la `url` retournée:
  - PowerShell example:
    ```powershell
    Set-Content -Path .\tmpfile.txt -Value "hello"
    Invoke-WebRequest -Uri "<PRESIGNED_URL>" -Method Put -ContentType 'text/plain' -InFile .\tmpfile.txt
    ```

- `POST /upload/complete` — notifier que l'upload est terminé (simule event S3)
  - Body JSON: `{ "key": "uploads/1234-test.txt" }`
  - Action: ajoute un job dans `data/jobs.json` pour traitement asynchrone par le worker.

- `GET /upload/:key/download` — renvoie une presigned GET URL (TTL court)
  - Response: `{ "url": "...", "expiresIn": 300 }`

- `GET /upload/:key/metadata` — récupère métadonnées (SHA256, état de scan) depuis `data/metadata.json`.

Worker (prototype)
- `src/worker.ts` lit périodiquement `data/jobs.json` et pour chaque job :
  - Télécharge l'objet depuis S3 (MinIO)
  - Calcule SHA-256
  - Exécute un **mock** de scan (placer un vrai scanner dans une version production)
  - Écrit les métadonnées dans `data/metadata.json` (clé → { sha256, scanned, scan: {...}, processedAt })
- Pour exécuter le worker en local (foreground):
  - Définir `S3_BUCKET` et variables MinIO puis `node dist/worker.js`.

Fichiers runtime
- `data/jobs.json` — queue simple JSON (array) ; chaque job: `{ bucket, key, timestamp, status }`.
- `data/metadata.json` — map clé→métadonnées produites par le worker.

Tests
- `src/tests/integration.test.js` : POC d'intégration qui démarre `docker-compose`, crée le bucket, lance le serveur, appelle `/upload/request` et valide la réponse. 
- Commande:
  - `npm run test:integration`

