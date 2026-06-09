# Electron + Univer Desktop Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current trial-production React/Vite app into a single authoritative electron-egg desktop application and replace the custom table with a Univer Sheets workspace.

**Architecture:** The Electron desktop runtime becomes the only canonical runtime. The React app moves under `frontend/`; Electron/electron-egg owns app startup and packaging. Univer is only the table interaction layer; existing business state and Excel export remain authoritative.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, electron-egg, ee-core, ee-bin, Electron, electron-builder, Univer Sheets, Vitest, xlsx.

---

## Phase Gates

| Phase | Independent owner | Depends on | Acceptance gate |
|---|---|---|---|
| Phase 0: Baseline and safety | Repo maintainer | None | Current tests/lint behavior captured; user changes untouched |
| Phase 1: Electron shell | Desktop owner | Phase 0 | Electron dev window loads unchanged app |
| Phase 2: Packaging | Desktop owner | Phase 1 | macOS `.dmg` builds locally; Windows `.exe` builds on Windows/CI |
| Phase 3: Univer foundation | Sheet owner | Phase 0 | Localized Univer sheet renders in app shell |
| Phase 4: Sheet model adapter | Sheet owner | Phase 3 | Snapshot + business map tests pass |
| Phase 5: Interaction integration | App owner | Phase 4 | Step 2-5 workflows work through Univer |
| Phase 6: Legacy removal | App owner | Phase 5 | Old table path removed; no duplicate runtime/table path |
| Phase 7: End-to-end release verification | QA owner | Phase 6 | Full test/lint/dev/build/package acceptance passes |

Parallelization rule:

- Phase 1 and Phase 3 can start after Phase 0 if they avoid editing the same files.
- Phase 4 can proceed in pure library tests once Phase 3 defines the Univer dependency shape.
- Phase 5 must wait for Phase 4.
- Phase 6 must wait for Phase 5.
- Phase 7 must wait for Phase 6.

## File Responsibility Map

### Desktop Runtime

- Create `electron/main.js`: electron-egg app bootstrap.
- Create `electron/config/config.default.js`: BrowserWindow, mainServer, logging, and security defaults.
- Create `electron/config/config.prod.js`: production overrides.
- Create `electron/preload/index.js`: preload registration.
- Create `electron/preload/bridge.js`: contextBridge API surface.
- Create `electron/preload/lifecycle.js`: lifecycle class with explicit `ready`, `electronAppReady`, `windowReady`, and `beforeClose` methods; methods can be no-op except logging.
- Create `cmd/bin.js`: ee-bin dev/build/move/package commands.
- Create `cmd/builder.json`: Windows NSIS builder config.
- Create `cmd/builder-mac.json`: macOS dmg builder config.
- Create `build/icons/*`: icon resources required by builder configs.
- Create `build/extraResources/read.txt`: minimal extra resource directory so builder config resolves.
- Modify root `package.json`: desktop scripts and electron dependencies.
- Modify root `package-lock.json`: dependency lock update.

### Frontend Runtime

- Move current frontend files into `frontend/`.
- Modify `frontend/package.json`: frontend dev/build/test/lint scripts.
- Modify `frontend/vite.config.ts`: `base: './'`, existing alias behavior, and test setup paths.
- Modify `frontend/index.html`: relative production loading.
- Modify import paths only where move breaks them.

### Univer Sheet

- Create `frontend/src/components/TrialProductionSheet.tsx`: Univer-backed replacement component.
- Create `frontend/src/components/TrialProductionSheet.test.tsx`: component integration tests.
- Create `frontend/src/lib/univerTrialProductionSheet.ts`: business state to Univer snapshot adapter and business cell map.
- Create `frontend/src/lib/univerTrialProductionSheet.test.ts`: pure adapter tests.
- Create `frontend/src/lib/univerSheetEvents.ts`: edit event normalization and reverse mapping.
- Create `frontend/src/lib/univerSheetEvents.test.ts`: event mapping tests.
- Modify `frontend/src/App.tsx`: replace `TrialProductionTable` with `TrialProductionSheet`.
- Modify `frontend/src/components/Sidebar.tsx`: route focus through sheet focus handler instead of DOM cell query for Univer-backed steps.

### Cleanup

- Delete `frontend/src/components/TrialProductionTable.tsx` after replacement.
- Delete or rewrite `frontend/src/components/TrialProductionTable.test.tsx`.
- Delete `frontend/src/lib/tableViewport.ts` and `frontend/src/lib/tableViewport.test.ts` after `TrialProductionSheet` owns sheet sizing and scrolling.
- Keep `frontend/src/lib/tableOperations.ts`; it remains the business authority for copy/paste/insert SKU behavior.
- Keep `frontend/src/lib/step5TableModel.ts` and `frontend/src/lib/trialProductionWorkbook.ts`; they remain the export authority.

## Phase 0: Baseline And Safety

### Task 0.1: Capture Current Repo State

**Files:**

- Read only: repository status and existing docs.

- [ ] Run:

```bash
git status --short 2>&1 | head -c 4000
```

Expected:

```text
Shows pre-existing user changes, including PROJECT-INDEX.json, PROJECT-INDEX.md, and AGENTS.md if still present.
```

- [ ] Record in the task notes that these user changes must not be reverted or staged unless explicitly requested.

Acceptance:

- The implementer can identify which changes are user-owned before touching files.
- No repo-tracked file is modified by this task.

### Task 0.2: Capture Baseline Verification

**Files:**

- Read only unless lockfile install is required later.

- [ ] Run:

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test 2>&1 | head -c 12000
```

- [ ] Run:

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000
```

Acceptance:

- Baseline pass/fail is documented before migration.
- Later failures can be separated from pre-existing failures.

## Phase 1: Electron-Egg Runtime Shell

### Task 1.1: Move Frontend Into `frontend/`

**Files:**

- Move current frontend files to `frontend/`.
- Keep root package for Electron.

Steps:

- [ ] Move current React/Vite source files into `frontend/` while preserving relative structure.
- [ ] Ensure `frontend/src/main.tsx` still imports `./App.tsx` and `./index.css`.
- [ ] Ensure `frontend/vite.config.ts` keeps alias `@` mapped to the frontend project root.
- [ ] Set Vite production base to `./`.

Acceptance:

- Running from `frontend/` succeeds:

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test 2>&1 | head -c 12000
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run build 2>&1 | head -c 12000
```

- No import path uses a stale root location.
- Old root Vite entry is not kept as a second runtime.

### Task 1.2: Add Electron-Egg Main Process

**Files:**

- Create `electron/main.js`
- Create `electron/config/config.default.js`
- Create `electron/config/config.prod.js`
- Create `electron/preload/index.js`
- Create `electron/preload/bridge.js`
- Create `electron/preload/lifecycle.js`

Required behavior:

- Bootstrap via `const { ElectronEgg } = require('ee-core')`.
- Register lifecycle/preload only as needed.
- Configure BrowserWindow with `contextIsolation: true` and `nodeIntegration: false`.
- Production main server loads `/public/dist/index.html`.

Acceptance:

- Electron starts without requiring renderer access to Node globals.
- The preload bridge exposes only explicit APIs.
- Config follows the `tn-viewer` shape but does not copy insecure `contextIsolation: false` or `nodeIntegration: true`.

### Task 1.3: Add EE-Bin Commands

**Files:**

- Create `cmd/bin.js`
- Modify root `package.json`
- Modify root `package-lock.json`

Required root scripts:

```json
{
  "dev": "ee-bin dev",
  "build": "npm run build-frontend && npm run build-electron",
  "start": "ee-bin start",
  "dev-frontend": "ee-bin dev --serve=frontend",
  "dev-electron": "ee-bin dev --serve=electron",
  "build-frontend": "ee-bin build --cmds=frontend && ee-bin move --flag=frontend_dist",
  "build-electron": "ee-bin build --cmds=electron",
  "build-w": "ee-bin build --cmds=win64",
  "build-m": "ee-bin build --cmds=mac"
}
```

Acceptance:

- `npm run dev` launches the Electron desktop flow.
- `npm run build` writes frontend output to `public/dist` and Electron output to `public/electron`.
- No root `vite` script remains as the canonical app launch path.

## Phase 2: Packaging

### Task 2.1: Add Builder Configs And Required Resources

**Files:**

- Create `cmd/builder.json`
- Create `cmd/builder-mac.json`
- Create `build/icons/icon.ico`
- Create `build/icons/icon.icns`
- Create `build/icons/icon.png`
- Create `build/extraResources/read.txt`

Required config:

- Windows target: NSIS `.exe`.
- macOS target: `.dmg`.
- `asar: true`.
- Exclude development-only folders from packaged app.
- Artifact names include product name, OS, version, and arch.

Acceptance:

- Builder configs resolve all referenced icon/resource paths.
- macOS config does not require signing credentials.
- Windows config is suitable for Windows/CI, not current Mac-only verification.

### Task 2.2: Verify Packaging Commands

**Files:**

- No source edits expected after Task 2.1.

Commands:

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run build 2>&1 | head -c 12000
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run build-m 2>&1 | head -c 12000
```

Windows or CI command:

```bash
npm run build-w
```

Acceptance:

- Local macOS produces a `.dmg`.
- Windows/CI produces an NSIS `.exe`.
- If `.exe` is not built on macOS, this is not a local failure because Windows/CI is the accepted path.

## Phase 3: Univer Foundation

### Task 3.1: Add Univer Dependencies And Styles

**Files:**

- Modify `frontend/package.json`
- Modify `frontend/package-lock.json`
- Modify `frontend/src/main.tsx` or `frontend/src/index.css` for required Univer CSS imports, depending on Univer package guidance.

Dependencies:

- `@univerjs/presets`
- `@univerjs/preset-sheets-core`
- `@univerjs/core`
- Any peer dependency required by the chosen Univer preset, including `rxjs` if not pulled transitively.

Acceptance:

- `cd frontend && npm run lint` passes or exposes only actionable Univer type issues to fix in this phase.
- Univer Chinese locale packages are imported from the installed package paths, not copied manually.

### Task 3.2: Create Minimal Localized Univer Component

**Files:**

- Create `frontend/src/components/TrialProductionSheet.tsx`
- Create `frontend/src/components/TrialProductionSheet.test.tsx`

Required behavior:

- Component accepts the current `TrialProductionTable` prop surface where practical.
- Component initializes Univer with Simplified Chinese locale.
- Component renders a minimal workbook without connecting business edits yet.

Acceptance:

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/components/TrialProductionSheet.test.tsx 2>&1 | head -c 12000
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000
```

- Test verifies that the component renders a sheet host.
- Manual dev check confirms Univer UI labels are Chinese.

## Phase 4: Sheet Model Adapter

### Task 4.1: Build Business-To-Sheet Adapter

**Files:**

- Create `frontend/src/lib/univerTrialProductionSheet.ts`
- Create `frontend/src/lib/univerTrialProductionSheet.test.ts`

Required exports:

```ts
export interface TrialProductionCellKey {
  skuId: string;
  supplyId?: string;
  fieldId: string;
  scope: 'sku' | 'supply' | 'field';
}

export interface TrialProductionSheetModel {
  workbookSnapshot: unknown;
  cellMap: Record<string, TrialProductionCellKey>;
}
```

Required behavior:

- Generate visible rows for each current step using the same step field filters as the old table.
- Generate columns from visible `skuData` and supplies.
- Preserve Step 5 merged/spanned semantics through `buildStep5TableModel()`.
- Mark Step 5 cells as read-only.
- Style Step 2 conflict cells.

Acceptance:

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/univerTrialProductionSheet.test.ts 2>&1 | head -c 12000
```

Test cases must cover:

- Step 2 conflict cell has a mapped business key and conflict style.
- Step 3 custom row remains visible when its group is visible.
- Step 4 validation-targetable cell exists in `cellMap`.
- Step 5 uses `buildStep5TableModel()` and marks preview cells read-only.

### Task 4.2: Build Edit Event Reverse Mapper

**Files:**

- Create `frontend/src/lib/univerSheetEvents.ts`
- Create `frontend/src/lib/univerSheetEvents.test.ts`

Required exports:

```ts
export interface TrialProductionSheetEdit {
  key: TrialProductionCellKey;
  value: string;
}

export function mapUniverEditToBusinessEdit(input: {
  row: number;
  column: number;
  value: unknown;
  cellMap: Record<string, TrialProductionCellKey>;
}): TrialProductionSheetEdit | null;
```

Required behavior:

- Return `null` for unmapped cells.
- Normalize edited values to strings.
- Preserve `sku` scoped vs `supply` scoped information.

Acceptance:

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/univerSheetEvents.test.ts 2>&1 | head -c 12000
```

## Phase 5: App Integration

### Task 5.1: Replace Table Component In App

**Files:**

- Modify `frontend/src/App.tsx`
- Modify `frontend/src/components/TrialProductionSheet.tsx`
- Modify `frontend/src/components/Sidebar.tsx`

Required behavior:

- `App.tsx` renders `TrialProductionSheet` for Step 2 and later.
- Existing Step 1 remains unchanged.
- Cell edits call existing `handleUpdateValue`.
- SKU-scoped edits update all relevant supplies as current behavior requires.
- Sidebar focus calls a `focusCellByBusinessKey` path instead of direct DOM cell lookup for Univer-backed steps.

Acceptance:

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/components/Sidebar.test.tsx src/components/TrialProductionSheet.test.tsx 2>&1 | head -c 12000
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000
```

Manual acceptance:

- Step 2 conflict card focuses the sheet cell.
- Step 4 validation card focuses the target field cell.
- Editing a normal supply-scoped cell changes `skuData`.

### Task 5.2: Reconnect Step 2 Candidate Panel

**Files:**

- Modify `frontend/src/components/TrialProductionSheet.tsx`
- Modify `frontend/src/components/TrialProductionSheet.test.tsx`

Required behavior:

- Selecting a conflict cell opens a candidate panel.
- Candidate click calls the same business update callback as an edit.
- SKU-scoped conflict candidate applies to all relevant supplies.

Acceptance:

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/components/TrialProductionSheet.test.tsx 2>&1 | head -c 12000
```

Manual acceptance:

- Candidate panel displays field label, PCBA, supply label or "整列", and candidate buttons.
- After a candidate is chosen, conflict styling disappears after state recomputation.

### Task 5.3: Preserve Step 3 Structure Operations

**Files:**

- Modify `frontend/src/components/TrialProductionSheet.tsx`
- Keep `frontend/src/lib/tableOperations.ts`
- Keep `frontend/src/lib/tableOperations.test.ts`

Required behavior:

- Add supply, insert SKU, copy selected SKU, paste into new SKU, insert row, and delete row remain app-level operations.
- Univer native row/column insert/delete menus do not become business structure entry points.

Acceptance:

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/tableOperations.test.ts src/components/TrialProductionSheet.test.tsx 2>&1 | head -c 12000
```

Manual acceptance:

- User can copy selected SKU and paste into a new SKU.
- User cannot use a Univer native menu to create a column that is not represented in `skuData`.

### Task 5.4: Preserve Step 5 Preview And Export Layout

**Files:**

- Modify `frontend/src/components/TrialProductionSheet.tsx`
- Keep `frontend/src/lib/step5TableModel.ts`
- Keep `frontend/src/lib/trialProductionWorkbook.ts`

Required behavior:

- Step 5 is read-only.
- Step 5 preview is generated from `buildStep5TableModel()`.
- Row height and column width changes update `Step5LayoutSnapshot` where available.
- Excel export still calls `buildTrialProductionWorkbook()`.

Acceptance:

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/step5TableModel.test.ts src/lib/trialProductionWorkbook.test.ts src/components/TrialProductionSheet.test.tsx 2>&1 | head -c 12000
```

Manual acceptance:

- Step 5 sheet is not editable.
- Exported workbook still contains the expected `搭配表` sheet.

## Phase 6: Legacy Removal And Canonicalization

### Task 6.1: Remove Old Table Path

**Files:**

- Delete `frontend/src/components/TrialProductionTable.tsx`
- Delete or replace `frontend/src/components/TrialProductionTable.test.tsx`
- Delete `frontend/src/lib/tableViewport.ts`
- Delete `frontend/src/lib/tableViewport.test.ts`
- Modify any stale imports.

Acceptance:

```bash
cd frontend && rg -n "TrialProductionTable|tableViewport|data-step4-cell-id|data-step2-cell-id" src 2>&1 | head -c 12000
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test 2>&1 | head -c 12000
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000
```

Expected:

- No production import references `TrialProductionTable`.
- No production code relies on old DOM targeting attributes for sheet focus.
- Tests and type-check pass.

### Task 6.2: Update Project Docs And Index

**Files:**

- Modify `AGENTS.md` if it is intended to be tracked.
- Modify `PROJECT-INDEX.json`.
- Modify `README.md` if it documents launch/build commands.
- Remove stale `metadata.json` references from docs because desktop is now canonical.
- Do not modify the current untracked `AGENTS.md` unless the user explicitly asks to stage or track it.

Acceptance:

- Commands in docs match root desktop scripts and `frontend/` scripts.
- Docs state `.exe` is built on Windows/CI and `.dmg` locally on macOS.
- Docs do not present static SPA deployment as the canonical runtime.

## Phase 7: End-To-End Verification

### Task 7.1: Full Local Verification

Commands:

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test 2>&1 | head -c 12000
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run build 2>&1 | head -c 12000
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run build-m 2>&1 | head -c 12000
```

Acceptance:

- All tests pass.
- Type-check passes.
- Electron build completes.
- `.dmg` exists in the configured output directory and opens locally.

### Task 7.2: Manual Product Flow Verification

Required screenshots:

- Electron window loaded on Step 1.
- Step 2 Univer sheet with an unresolved conflict.
- Step 2 candidate panel open.
- Step 3 copy/paste SKU controls visible.
- Step 4 validation card focuses a Univer cell.
- Step 5 read-only preview.
- macOS `.dmg` app launched.
- Windows `.exe` app launched in Windows/CI.

Acceptance:

- Five-step flow can complete.
- Conflict blocking still works.
- Validation cards still navigate to cells.
- Exported `.xlsx` opens and matches the expected business workbook structure.
- Univer UI appears in Chinese.

### Task 7.3: Windows/CI Packaging Verification

Command on Windows or CI:

```bash
npm run build-w
```

Acceptance:

- NSIS `.exe` artifact is produced.
- Installed app launches to the trial-production wizard.
- This result is recorded with artifact path and build environment.

## Final Done Criteria

- One canonical runtime: Electron desktop.
- One canonical table: Univer-backed `TrialProductionSheet`.
- One canonical business state: existing React state and business modules.
- One canonical export path: `buildTrialProductionWorkbook()`.
- `npm run test`, `npm run lint`, `npm run build`, and `npm run build-m` pass locally.
- `npm run build-w` passes on Windows/CI.
- Old hand-built table path is removed, not hidden behind a fallback.
