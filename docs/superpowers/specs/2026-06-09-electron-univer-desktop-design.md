# Electron + Univer Desktop Design

## Goal

Convert the trial-production React/Vite SPA into a single authoritative Electron desktop application, using the local `tn-viewer` electron-egg structure as the implementation reference. Replace the hand-built trial-production table with Univer Sheets, including Simplified Chinese localization, while preserving the current five-step business flow, validation behavior, and Excel export.

## Confirmed Decisions

- Use the full electron-egg structure, not a minimal Electron shell.
- The desktop app is the canonical runtime path. Do not keep a parallel legacy SPA path.
- Use Univer Sheets as the canonical table implementation. Do not keep the old `TrialProductionTable` as a fallback.
- Build `.dmg` locally on macOS. Build `.exe` on a Windows machine or CI runner.
- Keep the current business model (`skuData`, `activeFields`, `ProjectInfo`, validation results) as the source of truth. Univer snapshots are view/editing projections, not the business state authority.

## Electron Architecture

The root package becomes the desktop application package. Add the same high-level folders used by `tn-viewer`:

- `electron/` for electron-egg main process, preload bridge, lifecycle, and config.
- `cmd/` for `ee-bin` development, build, move, and packaging commands.
- `build/` for icons and installer resources.
- `public/` for packaged Electron code and frontend build output.
- `frontend/` for the existing React/Vite application.

Development runs through electron-egg:

- Frontend dev server runs from `frontend/`.
- Electron loads the dev URL during local development.
- Production loads `public/dist/index.html`.

Window defaults:

- Width and height follow `tn-viewer` style: large desktop workspace with a reasonable minimum size.
- `contextIsolation: true`.
- `nodeIntegration: false`.
- Preload exposes only explicit desktop APIs required by this app.
- `autoHideMenuBar: true`.

Packaging:

- `cmd/builder.json` produces Windows NSIS `.exe`.
- `cmd/builder-mac.json` produces macOS `.dmg`.
- Current local macOS build is unsigned unless signing credentials are later provided.
- Windows `.exe` is accepted only from Windows or CI, because the current Mac environment has no `wine` or `makensis`.

## Univer Table Design

Replace `TrialProductionTable` with `TrialProductionSheet`.

The app keeps current business state as source of truth:

- `skuData`
- `activeFields`
- `currentStep`
- `projectInfo.efuseConfigs`
- validation results and Step 2 conflicts

Add pure adapter functions:

- Build a Univer workbook snapshot from the current business state.
- Build a row/column business map from visible sheet cells to `{ skuId, supplyId, fieldId, scope }`.
- Build Step 5 preview data from `buildStep5TableModel()` so Excel preview semantics stay aligned with export semantics.

Step behavior:

- Step 2, 3, and 4 render editable sheets.
- Step 5 renders a read-only preview sheet.
- Basic information and supply columns remain visible and navigable through Univer freeze/scroll behavior where practical.
- Business structure changes, such as inserting SKU blocks, adding supplies, copying selected SKU, and pasting into a new SKU, remain driven by existing app-level buttons and `tableOperations.ts`.
- Univer native row/column insertion and deletion menus are hidden or disabled so users cannot bypass the structured `skuData` model.

Localization:

- Use Univer Simplified Chinese locale (`LocaleType.ZH_CN`) and merge the required preset/plugin language packs.
- Keep the surrounding app UI in existing Chinese labels.

Events and synchronization:

- Cell edit events map `row/column` back to the business key and call existing callbacks such as `onUpdateValue`.
- SKU-scoped fields such as `band`, `storage`, `project`, `stage`, and `mb_id` update all relevant supplies when the current behavior requires a spanned business value.
- Supply label and selected supply updates remain explicit app controls unless Univer cells are deliberately mapped to those fields.

Step 2 conflicts:

- Conflict cells receive Univer cell styles that make the unresolved state visible.
- Candidate choices move to a lightweight side/top candidate panel keyed by the active conflict cell.
- Choosing a candidate calls the same business update callback used by manual edits.

Step 4 validation targeting:

- `ValidationResult` remains keyed by `skuId`, `supplyId`, and `targetFieldId ?? fieldId`.
- `TrialProductionSheet` exposes a focus-by-business-key operation.
- Sidebar validation cards call that operation instead of querying DOM attributes like `data-step4-cell-id`.

Step 5 export:

- `buildTrialProductionWorkbook()` remains the only authoritative Excel export path.
- Do not switch to Univer export for business output.
- Read row heights and column widths from Univer where available and update the existing `Step5LayoutSnapshot`.

## Migration Sequence

1. Move the existing React app into `frontend/` and update Vite configuration for Electron production loading.
2. Add electron-egg folders, package scripts, config, builder configs, and the minimal icons/resources required by those builder configs.
3. Verify Electron can load the unchanged existing frontend.
4. Add Univer dependencies and a minimal localized sheet component.
5. Add the business-to-Univer adapter and tests.
6. Add edit-event reverse mapping and tests.
7. Replace `TrialProductionTable` usage with `TrialProductionSheet`.
8. Reconnect Step 2 conflicts, Step 3 structure actions, Step 4 validation focus, and Step 5 layout/export.
9. Remove old table-only code that is no longer used, including old viewport helpers and DOM-targeting tests where they no longer apply.
10. Run full verification and packaging checks.

## Testing And Acceptance Criteria

Unit and component checks:

- Business-to-Univer snapshot adapter creates correct rows, columns, merged/spanned semantics, styles, and read-only Step 5 data.
- Reverse mapping sends edits to the exact `skuId`, `supplyId`, and `fieldId`.
- Step 2 candidate selection resolves the correct conflict cell.
- Step 4 Sidebar cards focus the intended Univer cell.
- Existing business modules still pass, especially `tableOperations`, `step5TableModel`, `trialProductionWorkbook`, validation, and conflict tests.

Commands:

- `npm run test`
- `npm run lint`
- `npm run dev`
- `npm run build`
- `npm run build-m`
- On Windows or CI: `npm run build-w`

Packaging acceptance:

- macOS produces an unsigned `.dmg` that opens locally.
- Windows/CI produces an NSIS `.exe`.
- The app launches to the trial-production wizard and can complete the existing five-step flow with Univer as the table UI.

## Risks And Constraints

- Univer is a complex spreadsheet runtime. Keep all business writes flowing through existing callbacks to avoid hidden state divergence.
- If a Univer menu or permission feature does not behave as documented, choose the smaller single-path control: hide the feature and keep business controls outside the sheet.
- Do not introduce compatibility branches for old table behavior unless explicitly requested later.
- Do not use Univer export as a replacement for the existing business workbook export in this migration.
- Code signing and notarization are not in scope for this design.

## References

- Local reference: `/Users/shenmingjie/tinno/tn-viewer`
- electron-egg: `https://github.com/dromara/electron-egg`
- Univer Sheets: `https://docs.univer.ai/guides/sheets`
- Univer i18n: `https://docs.univer.ai/guides/sheets/getting-started/i18n`
- Univer Facade API: `https://docs.univer.ai/guides/sheets/getting-started/facade`
