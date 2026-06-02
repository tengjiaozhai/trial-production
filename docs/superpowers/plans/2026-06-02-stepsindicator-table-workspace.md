# StepsIndicator And Table Workspace Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the step rail collapse upward to free vertical space, make the step 2-4 table denser and more readable, and support inserting and copying whole mainboard blocks without breaking alignment or export behavior.

**Architecture:** Keep the current React table shell and shared viewport math as the single layout source of truth. Put the collapse state and whole-block selection state in `App.tsx`, keep the step rail behavior isolated in `StepsIndicator.tsx`, and keep table sizing, insertion affordances, and copy/paste rendering inside `TrialProductionTable.tsx`. Avoid introducing a parallel data model; the canonical state remains `skuData` plus `activeFields`, because history, validation, and export already consume that path.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, lucide-react, Vitest

---

## File Structure

- Modify: `src/App.tsx`
- Modify: `src/components/StepsIndicator.tsx`
- Modify: `src/components/TrialProductionTable.tsx`
- Modify: `src/lib/tableViewport.ts`
- Modify: `src/lib/tableViewport.test.ts`

---

### Phase 1: Collapsible Step Rail

**Goal:** Add a toggle under `StepsIndicator` that collapses the step rail upward so the table gets more vertical space, while keeping the current step visible and preserving navigation behavior.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/StepsIndicator.tsx`

- [ ] **Step 1: Add failing coverage for the collapse state**
  - Test the rendered step rail in both expanded and collapsed modes.
  - Verify that the toggle button exists under the rail and flips the compact class set when clicked.

- [ ] **Step 2: Wire the collapse state through the shell**
  - Add a local `stepsCollapsed` state in `App.tsx`.
  - Pass `collapsed` and `onToggleCollapsed` into `StepsIndicator`.
  - Adjust the content shell so the main workspace gains height when the rail collapses.

- [ ] **Step 3: Implement the compact rail UI**
  - Keep the current step number/label behavior in the expanded view.
  - In collapsed mode, reduce the rail to a narrow strip with an upward collapse affordance and a minimal active-step indicator.
  - Do not persist the state to local storage.

- [ ] **Step 4: Verify the behavior in the browser**
  - Collapse the rail and confirm the table gains visible height.
  - Expand it again and confirm the shell returns to the prior layout without losing step state.

**Acceptance Criteria**
- Clicking the arrow under the step rail collapses the rail upward and exposes more table viewport.
- The current step remains readable in both states.
- Collapsing and expanding do not reset project data, table edits, or validation results.

### Phase 2: Dense Table Viewport

**Goal:** Make the step 2-4 table show more content without shrinking other sections, especially by fixing the basic info block height and keeping horizontal scrolling usable.

**Files:**
- Modify: `src/components/TrialProductionTable.tsx`
- Modify: `src/lib/tableViewport.ts`
- Modify: `src/lib/tableViewport.test.ts`

- [ ] **Step 1: Extend viewport tests for the new layout rules**
  - Keep the shared width metrics covered.
  - Add coverage that verifies the basic info block and the lower groups derive from the same width model.

- [ ] **Step 2: Split the table into a fixed top band and a flexible lower band**
  - Give the basic info area a fixed visible height with its own internal scroll.
  - Let the lower groups consume the remaining height.
  - Keep the existing synchronized horizontal scrolling path as the only horizontal scroll behavior.

- [ ] **Step 3: Tighten the visual density**
  - Reduce wasted cell padding where the current layout leaves empty space.
  - Move the `+` affordances to more stable positions so they do not compete with input content.
  - Keep the sticky index/label columns intact.

- [ ] **Step 4: Re-check the wide-table scenarios**
  - Use a dataset with multiple mainboard blocks and multiple supplies per block.
  - Confirm the basic info block does not collapse or get compressed when more columns are added.

**Acceptance Criteria**
- The basic info block keeps a fixed height even when more columns are inserted.
- Additional columns do not squeeze the lower groups out of view.
- The top and bottom table bands stay aligned and horizontally synchronized.
- The table still supports reading right-side columns through visible horizontal scrolling.

### Phase 3: Insert Rows And Mainboard Blocks

**Goal:** Let users insert a new row under any existing row and insert a blank mainboard block to the right of an existing block in steps 2-4.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TrialProductionTable.tsx`

- [ ] **Step 1: Add test coverage for row insertion and block insertion**
  - Verify a new row is inserted into the correct group and lands immediately after the target row.
  - Verify a new mainboard block is created with the expected supply structure but empty values.

- [ ] **Step 2: Implement row insertion as a canonical `activeFields` change**
  - Insert the new field into the same group as the row above it.
  - Keep the new field editable in step 2-4 and visible in history/export paths.

- [ ] **Step 3: Implement mainboard block insertion as a canonical `skuData` change**
  - Insert a blank block to the right of the current block.
  - Reuse the current block's supply count and structure so the table remains aligned.
  - Leave values empty so the user can fill the new block explicitly.

- [ ] **Step 4: Reposition the `+` controls**
  - Make row insertion controls appear on the row boundary in a consistent place.
  - Make block insertion controls appear at the block edge, not inside the data cells.

**Acceptance Criteria**
- Clicking the row `+` inserts a new editable row in the intended group.
- Clicking the block `+` inserts a blank block to the right without breaking the table structure.
- Newly inserted rows and blocks participate in the same state path as existing data.
- The controls remain usable in the denser layout and do not obscure input values.

### Phase 4: Whole-Block Select, Copy, And Paste

**Goal:** Allow a user to select a whole mainboard block and copy its contents into a newly inserted blank block.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TrialProductionTable.tsx`

- [ ] **Step 1: Add selection and copy-state coverage**
  - Verify a block can be marked as selected.
  - Verify a copied block can be pasted into a blank inserted target.

- [ ] **Step 2: Add whole-block selection state**
  - Track the currently selected block in `App.tsx`.
  - Render a selected style on the block header and the matching columns.

- [ ] **Step 3: Implement copy into a blank target block**
  - Copy the source block's visible values, supply labels, and structural metadata into the target block.
  - Regenerate ids so the copied block does not collide with the source block.
  - Keep the target editable after paste.

- [ ] **Step 4: Keep validation and export on the canonical data**
  - Ensure validation still runs against the updated `skuData`.
  - Ensure the step 5 preview and workbook export reflect the copied block exactly.

**Acceptance Criteria**
- A whole mainboard block can be selected clearly from the table UI.
- A copied block pastes into an inserted blank target block with matching content.
- The copied target gets unique ids and remains editable.
- Validation, step 5 preview, and export all reflect the copied data path without special cases.

### Phase 5: Verification And Regression

**Goal:** Prove the feature works end to end and does not regress the existing step flow, validation, or export behavior.

**Files:**
- Modify: `src/lib/tableViewport.test.ts`
- Run: `npm run test`
- Run: `npm run lint`

- [ ] **Step 1: Run the focused tests**
  - Run `npm run test -- src/lib/tableViewport.test.ts`.
  - Run any added insertion/copy tests for the new state helpers.

- [ ] **Step 2: Run the full repo checks**
  - Run `npm run test`.
  - Run `npm run lint`.

- [ ] **Step 3: Verify the UI in the browser**
  - Confirm the step rail collapse increases table viewport.
  - Confirm step 2-4 can show more content without height compression.
  - Confirm inserted rows, inserted blocks, and whole-block copy all behave in a representative multi-block dataset.

**Acceptance Criteria**
- The focused tests pass.
- The full test suite and typecheck/lint pass.
- Manual browser verification confirms the compact rail, denser table, insert controls, and whole-block copy flow all work together.

## Assumptions

- This plan does not add a backend or persistence layer.
- The canonical state remains `skuData` and `activeFields`; no duplicate data model is introduced.
- Whole-block copy is limited to the step 2-4 editing flow.
- The step rail collapse is session-only and does not need to survive a refresh.
