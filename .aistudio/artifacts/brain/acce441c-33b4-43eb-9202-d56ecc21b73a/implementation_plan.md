# Standalone Election Results Page Plan

Architecture and implementation plan to elevate the **Election Results** feature from an internal Assembly tab into a dedicated, top-level application page (`/election-results`). The page is positioned in the primary navigation between **Orders** and **Persons**, displays the electoral tally of the currently active Legislative Assembly, and refines the alignment of the 3 header summary lines and Wikipedia-style vote sharing table.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were clarified and confirmed during Phase 1:
> - **Navigation Placement**: The Election Results view will move **exclusively** to the primary navigation menu (`/election-results`), located directly under **Orders** and above **Persons** in the sidebar/navigation bar. It will be removed from the Assembly entity tab bar.
> - **3 Header Lines Alignment & Logic**: The top section of the election results card features 3 precisely aligned lines for the active Legislative Assembly:
>   - **Line 1**: `All [N] seats in the [Assembly Name] Legislative Assembly` (centered headline with link)
>   - **Line 2**: `[M] seats needed for a majority` (centered secondary subtitle)
>   - **Line 3**: `General Election Mandate` / Status indicator with direct Assembly linkage
> - **Active Assembly Target**: Automatically detects and presents the currently active Legislative Assembly's general election results. If multiple or historical assemblies exist, an assembly selector allows inspecting historical assemblies while defaulting to the active assembly.
> - **Logic Preservation**: Retains all established rules from the previous iteration: leader seat resolution (`(Lost)`, multiple seats served), non-by-election data purity, and auto-freezing when all constituencies are occupied.

---

## 1. Overview & Core Concept

### What It Delivers
1. **Primary Navigation Item**:
   - In `Layout.tsx`, a new navigation item **Election Results** (with `Vote` icon) is added between `Orders` and `Persons`:
     `Dashboard -> Assemblies -> Cabinet -> Orders -> Election Results -> Persons -> Alliances -> Parties -> Constituencies -> Settings`.
2. **Dedicated Standalone Page (`/election-results`)**:
   - A dedicated page `src/pages/ElectionResultsPage.tsx` loaded via Route `/election-results`.
   - Identifies the current active Legislative Assembly (via `a.isActive !== false` or highest chronological score).
   - If user wants to inspect other assemblies, provides a clean assembly switcher toolbar.
3. **Refined 3-Line Header Alignment**:
   - Fixed line heights, balanced typographic hierarchy (`text-wrap: balance`), and centered alignments.
   - Line 1: `All [N] seats in the [Active Assembly Name] Legislative Assembly`
   - Line 2: `[M] seats needed for a majority` (where M = `Math.floor(N / 2) + 1`)
   - Line 3: Assembly status and term timeline pill / indicator
   - High-density strip beneath it for `Registered` electors and `Turnout` percentage with tabular alignment.
4. **Clean Removal from Assembly Tabs**:
   - Removes the `election_results` tab button and container from `src/pages/EntityPage.tsx`, keeping Assembly tabs streamlined to: `DETAILS` | `LEADERSHIP` | `BILLS`.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Accessing Election Results**:
   - User clicks **Election Results** in the left sidebar or mobile navigation drawer (placed directly below **Orders** and above **Persons**).
   - Navigates immediately to `/election-results`.
2. **Reviewing Active Assembly Results**:
   - The page loads the currently active assembly (e.g. "15th Kerala Legislative Assembly").
   - The top banner displays the 3 centered header lines:
     ```
     All 140 seats in the 15th Kerala Legislative Assembly
     71 seats needed for a majority
     General Election Mandate • Term 2021–2026
     ```
   - Below it, the Registered voters and Turnout metrics sit in balanced rows with tabular figures.
   - The 3-column Vote Sharing table displays the top political alliances/parties, portrait headshots, leader seat resolutions, vote shares, and seat changes.
3. **Switching Assemblies**:
   - A clean top-right assembly switcher dropdown allows switching to prior assemblies (e.g., 14th Assembly) to view frozen historical records.

### Visual Polish & Alignment Corrections
- **Header Geometry**: Centered flex column with strict line heights (`leading-snug`, `leading-tight`) preventing layout drift.
- **Table Alignment Discipline**:
  - Left row labels: Left-aligned with comfortable padding (`px-4 py-3`), semi-bold neutral text (`text-zinc-300`), hairline borders.
  - Contender columns (3 columns): Centered alignments for all values (`text-center font-mono tabular-nums`).
  - Swings (`▲` / `▼`): Vertically centered inline icons with colored percentage point figures.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Dedicated Route vs Embedded Component
- *Chosen Approach*: Create `src/pages/ElectionResultsPage.tsx` as a standard routed page inside `App.tsx` and `Layout.tsx`.
- *Why*: Gives Election Results first-class visibility in the main application hierarchy, matching the user's specific workflow requirement.

### Decision 2: Active Assembly Default with Historical Switcher
- *Chosen Approach*: Default automatically to the currently active assembly, while providing a quiet segmented selector if the user wants to review a dissolved or historical assembly's frozen election.
- *Why*: Satisfies "show the result of current active assembly's election" while retaining full utility for historical assemblies.

### Decision 3: Removal from Assembly Entity Tabs
- *Chosen Approach*: Fully remove the `election_results` tab from `EntityPage.tsx` as requested ("Move exclusively to the main navigation menu").
- *Why*: Prevents redundant UI duplication and keeps the Assembly details page focused on legislative governance, leadership, and bills.

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                              App Routes                                │
│                                                                        │
│   /orders  ──►  /election-results  ──►  /persons  ──►  /alliances      │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         ElectionResultsPage                            │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Assembly Selector Toolbar (Defaults to Active Assembly)          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                │                                       │
│                                ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ AssemblyElectionResults (Refined 3-Line Header & Table)          │  │
│  │                                                                  │  │
│  │ Line 1: All X seats in the [Active Assembly]                     │  │
│  │ Line 2: Y seats needed for a majority                            │  │
│  │ Line 3: General Election Mandate • Status                        │  │
│  │                                                                  │  │
│  │ Registered Electors | Turnout Rate                               │  │
│  │                                                                  │  │
│  │ 3-Column Vote Sharing Infobox                                    │  │
│  │ [Leader 1]           [Leader 2]           [Leader 3]             │  │
│  │  - Headshot           - Headshot           - Headshot            │  │
│  │  - Party/Alliance     - Party/Alliance     - Party/Alliance      │  │
│  │  - Seat (Won/Lost)    - Seat (Won/Lost)    - Seat (Won/Lost)     │  │
│  │  - Seats Won          - Seats Won          - Seats Won           │  │
│  │  - Votes & Share      - Votes & Share      - Votes & Share       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Component & File Strategy
1. **`src/pages/ElectionResultsPage.tsx`**:
   - New top-level page component connected to `useDbLookup()`.
   - Locates `activeAssembly = assemblies.find(a => a.isActive !== false) || assemblies[0]`.
   - Embeds `<AssemblyElectionResults ... />`.
2. **`src/components/Layout.tsx`**:
   - Update `navItems` array to place `{ title: 'Election Results', icon: Vote, path: '/election-results' }` between `Orders` and `Persons`.
3. **`src/App.tsx`**:
   - Add `<Route path="/election-results" element={<ElectionResultsPage />} />` between `/orders` and `/persons`.
4. **`src/pages/EntityPage.tsx`**:
   - Remove `"election_results"` from the Assembly tab selector and tab panels.
5. **`src/components/AssemblyElectionResults.tsx`**:
   - Polish the 3-line header typography, vertical spacing, and centered alignments for Wikipedia layout perfection.

---

## 5. Verification Plan

1. **Route & Navigation Check**:
   - Verify sidebar order in desktop and mobile menus: `Orders` -> `Election Results` -> `Persons`.
   - Verify `/election-results` route renders the active assembly by default.
2. **Assembly Page Tab Check**:
   - Verify Assembly page tabs are restored to: `DETAILS`, `LEADERSHIP`, `BILLS`.
3. **Header Alignment & Fidelity**:
   - Confirm 3 centered header lines (Assembly seats title, majority threshold, mandate indicator).
   - Confirm Registered voters and Turnout metrics with tabular figures.
4. **Compilation & Linting**:
   - Run `compile_applet` and `lint_applet` to confirm zero errors or regressions.
