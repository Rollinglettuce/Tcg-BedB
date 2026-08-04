# ESSENCE CCG Platform

A shared development platform for the **ESSENCE CCG** card database, administrative tools, and focused card-creation applications.

## Applications

### Admin Command Center

The existing React application currently remains at the repository root during the low-risk migration phase.

It manages:

- Card records
- Player profiles and inventories
- Player decks
- Matchmaking data
- Firebase-backed administrative workflows

Run it with:

```bash
npm run dev:admin
```

### Conjuring CardForge

Located in `apps/cardforge`, CardForge is a focused responsive tool for creating and validating ESSENCE CCG Conjurings.

The first functional version includes:

- Card name, element, subtype, Essence cost, Attack, and Health inputs
- Live card preview
- Shared cost-tier lookup
- Canonical Attack and Health baseline warnings
- Mobile-responsive layout

Run it with:

```bash
npm run dev:cardforge
```

## Shared packages

```text
packages/
├── game-rules/       Canonical elements, card types, turn phases, and core rules
├── card-schema/      Shared TypeScript card interfaces
└── balance-engine/   Cost tiers and reusable Conjuring validation
```

Applications must import canonical rules from these packages rather than duplicating constants or balance tables.

## Repository structure

```text
.
├── apps/
│   └── cardforge/
├── packages/
│   ├── game-rules/
│   ├── card-schema/
│   └── balance-engine/
├── src/                    Existing Admin Command Center
├── firestore.rules
├── firebase.json
└── package.json
```

The Admin Command Center will move into `apps/admin` only after the additive monorepo foundation builds successfully. This staged approach keeps the existing application runnable throughout migration.

## Development

### Requirements

- Node.js 22 or newer
- npm
- A configured Firebase project for cloud-connected admin features

### Install

```bash
npm install
```

### Validate everything

```bash
npm run typecheck
npm run build
```

GitHub Actions performs both checks for pull requests.

## Security

- Never commit `.env` or `.env.local` files.
- Browser Firebase configuration identifies the project but does not replace Firestore security rules.
- Administrative authorization must be enforced by Firebase Authentication, custom claims, and Firestore rules—not only by hidden UI controls.
- Existing permissive development Firestore rules require a separate security-hardening migration before production deployment.

## Current migration status

This branch establishes the first monorepo foundation while preserving the existing app. Remaining work includes moving the admin app, extracting Firebase services and shared UI components, completing CardForge persistence and import/export, and deploying hardened production rules.

See GitHub issue **#2** for the complete migration checklist.
