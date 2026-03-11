# MyKNVA – Canevas de cours

Application web pour créer, planifier et imprimer des canevas de cours multi‑utilisateurs.

## Fonctionnalités
- Gestion multi‑utilisateurs (comptes locaux).
- Modules / classes / années.
- Canevas multi‑jours avec activités et durée.
- Drag & drop pour réordonner les activités.
- Paramétrage des journées (matin/après‑midi, pauses, heure supplémentaire).
- Gestion des blocs (1/2 jour, 1 jour + 1/2 jour, 1/2 jour + 1 jour).
- Choix demi‑journée matin ou après‑midi.
- Objectifs pédagogiques globaux par semaine.
- Vue d’impression synthétique en tableau (paysage).
- Mode clair / sombre.

## Stack
- Backend: Node.js + Express
- Base de données: SQLite
- Frontend: HTML / CSS / JavaScript
- Conteneur: Docker

## Démarrage rapide (Docker)
```bash
docker compose up --build
```
Puis ouvrir `http://localhost:8080`.

## Démarrage sans Docker
```bash
npm install
npm start
```
Puis ouvrir `http://localhost:3000`.

## Variables d’environnement
- `SESSION_SECRET`: secret pour les sessions (recommandé en production)

## Données
- La base SQLite est stockée dans `./data/app.db`.
- Le dossier `data` est monté en volume par Docker.

## Structure
- `server.js`: API + serveur
- `db.js`: schéma et migration légère
- `public/`: interface web
- `Dockerfile`, `docker-compose.yml`

## Impression
L’impression est optimisée en paysage et affiche un tableau synthétique (titre, module, classe, année, objectifs, activités).

## Notes
- Les suppressions de modules/classes sont bloquées si elles sont utilisées dans un canevas.
- Le drag & drop réordonne les activités et sauvegarde en base.
