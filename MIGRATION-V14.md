# Migration Guide: Foundry VTT v14 Compatibility

This document outlines the changes made to make EnhancedCombatHUD-Dragonbane
compatible with Foundry VTT v14.

## Changes Made

1. **Updated Module Manifest** (`src/module.json`):

   - Compatibility bumped to `minimum: 13, verified: 14, maximum: 14`
   - Module version bumped to `0.13.0`

2. **Updated Package Metadata** (`package.json`):

   - Package version bumped to `0.13.0`

3. **Documentation**:

   - `README.md` now advertises Foundry VTT v13-v14
   - `CLAUDE.md` gained a v14 section alongside the existing v13 notes

## For Users

1. **Prerequisites**:

   - Foundry VTT v14
   - Argon Combat HUD (CORE) with v14 support (verify the CORE module's own
     manifest advertises v14 before installing this update)
   - Dragonbane system version compatible with Foundry v14

2. **Installation**:

   - Update Foundry VTT to v14
   - Update Argon Combat HUD (CORE) to a version that supports v14
   - Update the Dragonbane system to a version that supports v14
   - Update EnhancedCombatHUD-Dragonbane to `0.13.0`

3. **Known Caveats**:

   - This bump only changes the manifest's advertised compatibility. It does
     **not** rewrite any API calls that may have changed in Foundry v14. If a
     specific feature breaks under v14, please open an issue with a reproducer.
   - Because this module depends on Argon Combat HUD (CORE) via the `argonInit`
     hook, it will only load correctly if CORE itself supports Foundry v14.

## For Developers

If you're working with this module or extending it, please note:

- Re-run the pre-commit checklist from `CLAUDE.md` after any change:
  `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.
- The TypeScript types in `@league-of-foundry-developers/foundry-vtt-types`
  (currently `^9.280.0`) predate v13/v14. If you rely on strong typing for
  new v14 APIs, you may need to migrate to a newer types package in a
  follow-up change. This PR keeps the existing types to minimize blast
  radius.
- Test each panel (`dragonbane-actions-panel`, `dragonbane-defense-panel`,
  `dragonbane-portrait-panel`, etc.) inside a live v14 world before
  cutting a release.
