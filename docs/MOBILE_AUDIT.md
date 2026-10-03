# Mobile Readiness Audit — Capacitor (Android/iOS)

**Date:** 2026-10-03
**Scope:** Existing React frontend prepared for Capacitor packaging. **Read-only audit — no files were modified.**
**Stack:** React 19 · Vite 6 · Tailwind CSS v4 · Radix UI · react-router 7 · Recharts · Capacitor 8 (`android/` present)
**Method:** Static audit of every page group (`admin`, `registrar`, `teacher`, `committee`, `principal`, auth/standalone), all shared components, all `ui/` primitives, services, context and Capacitor config. Findings are source-verified with `file:line`.

---

## 0. Executive summary

The app already has a solid **mobile foundation** (see §1) — this is not a greenfield mobile effort. The remaining work is concentrated in four themes:

1. **Native/WebView breakage (Critical):** every file export (PDF/CSV/XLSX) ends in `URL.createObjectURL` + a synthetic `<a download>` click, and every "Print" button calls `window.print()`. Neither works in an Android WebView. The required Capacitor plugins (`@capacitor/filesystem`, `@capacitor/share`, `@capacitor/browser`, `@capacitor/app`) are **not installed**.
2. **Unadopted mobile primitives:** `ModalShell`, `HybridTable`, `PageContainer`, `pt-safe`/`pb-safe`/`px-safe`, `touch-target` all exist and work, but ~20 hand-rolled `fixed inset-0` modals, ~15 raw wide tables, and the app shell itself bypass them.
3. **Touch ergonomics:** sub-44px icon buttons, 14px checkboxes that drive bulk actions, 20px paper-form inputs, hover-only controls.
4. **Charts & dashboards:** fixed pixel heights, oversized pie `outerRadius` + outside labels, crowded axis labels on 360px phones.

Approximate severity count across the audited surface: **3 Critical · ~25 High · ~45 Medium · ~35 Low**.

---

## 1. What already exists (do NOT rebuild)

| Foundation | Location | Status |
|---|---|---|
| Capacitor scaffold (`android/`, appId, `build:mobile`, `.env.mobile`) | `capacitor.config.json`, `package.json:10-14` | Present |
| Mobile drawer sidebar (off-canvas `< md`, `md:static` at 768px+) | `layout/Sidebar.tsx:69-81` | Present |
| Bottom tab bar for phones | `layout/BottomNav.tsx` | Present |
| Hamburger + 44px top-bar controls | `layout/TopBar.tsx:60-66,132-152` | Present |
| Responsive modal shell (bottom sheet `< sm`) | `components/ModalShell.tsx` | Present, under-used |
| Desktop table + mobile cards shell | `components/HybridTable.tsx` | Present, under-used |
| Mobile-first page gutter | `components/PageContainer.tsx` | Present, under-used |
| Safe-area utilities, `touch-target`, `min-h-dvh-safe` | `styles/index.css:101-122` | Defined; `pt-safe`/`px-safe` used **nowhere**, `pb-safe` only in BottomNav/Sidebar |
| Dynamic viewport shell | `Layout.tsx:95` (`h-dvh`) | Present |
| Document pan/zoom viewer for paper forms | `components/DocumentViewer.tsx` | Present |
| Dark mode + print pinning to white paper | `styles/index.css:55-265` | Present |
| Server CORS already allows Capacitor origins | `server/src/index.ts:67-99` | Present (no change needed) |
| Android `FileProvider` + cleartext traffic | `android/app/src/main/AndroidManifest.xml:10,28-36` | Present (enables file share) |
| Touch-friendly learner typeahead | `components/SearchableStudentSelect.tsx` | Present |

**Already mobile-ready pages:** `RegistrarDashboard`, `GradeDistribution`, `MasterSchedule`, `Graduates`, `SubjectView`, `AdminDashboard` (near), `ActivityLogs` (near), `NotFound` (near).

---

## 2. Critical / cross-cutting (fix once, benefits every page)

| # | Area | Problem | Severity | Recommended Fix | File |
|---|---|---|---|---|---|
| C1 | **File export** | All exports save via `URL.createObjectURL(blob)` + hidden `<a download>`. Android WebView does not persist blob downloads: nothing lands in Downloads, no share sheet, yet the UI reports success. | **Critical** | Install `@capacitor/filesystem` + `@capacitor/share`; write bytes to `Directory.Cache/Documents` then `Share.shareFiles()`. Web fallback keeps the current blob path. | `services/pdfRender.ts:533-541`, `services/pdfExport.ts:592`, `services/lis.ts:33-34`, `services/lisPdf.ts:274-275`, `services/backups.ts:22-40`, `services/documents.ts:75-102`, `pages/principal/PrincipalExportCenter.tsx:86-88`, `pages/SystemGuide.tsx:383-423` |
| C2 | **Token in URL** | Backup/document downloads put the JWT in `?token=` on a hidden-anchor navigation (leaks into WebView history/logs; also breaks native download). | **Critical** | Fetch with `Authorization` header → Blob → Filesystem; never put tokens in query strings. | `services/backups.ts:29-40`, `services/documents.ts:87-102` |
| C3 | **Print is a no-op** | `window.print()` / `iframe.contentWindow.print()` are unsupported in Android WebView, so every Print button is dead on device. | **High** | Print via a share/print plugin, or hide Print on native and make "Export PDF" the only output. | `components/FormPrintPreview.tsx:71-83`, `pages/registrar/CertificateParts.tsx:151`, `pages/registrar/SchoolForms.tsx:1241-1250`, `pages/registrar/EnrollmentReport.tsx:300`, `pages/SystemGuide.tsx:398,509-513` |
| C4 | **ModalShell adoption** | ~20 hand-rolled centered `fixed inset-0` overlays bypass `ModalShell`; on phones they don't become bottom sheets, often lack `max-h`, body scroll, safe-area padding, focus trap and Escape. | **High** | Replace each with `ModalShell` (already implements `items-end` + `max-h-[88vh]` + `app-scroll`). | Admin: `AcademicYearManagement.tsx:576,605`, `AdminRooms.tsx:220,306`, `DatabaseBackup.tsx:403`, `SectionCreation.tsx:531,617,681,705,870,1027`, `SubjectManagement.tsx:649,743,821,960`, `UserManagement.tsx:780,821,859`. Registrar: `GradeCorrections.tsx:275`, `PromotionRecords.tsx:252`, `ScheduleModifier.tsx:403`, `SchoolForms.tsx:355`, `TransferManagement.tsx:582`. Shared/auth: `ProfileSections.tsx:759`, `Login.tsx:265-309` |
| C5 | **Safe areas** | `pt-safe`/`px-safe` used nowhere; `Layout` main lacks them; `ModalShell` sheet and all custom modals lack `pb-safe`; standalone routes have none. Content can sit under the status bar / home indicator. | **Medium** | Add `pt-safe px-safe` to the main scroller; `pb-safe` to modal footers; safe-area padding on `Login`, `ResetPassword`, `NotFound`. | `Layout.tsx:121-124`, `ModalShell.tsx:52`, `pages/Login.tsx:656-699,710,878`, `ResetPassword.tsx:51`, `NotFound.tsx:11` |
| C6 | **Hardware back** | No `@capacitor/app`; `BackHandler`/`appUrlOpen` unused. Android back exits the app instead of going back / closing the drawer/modal. | **High** | Install `@capacitor/app`; handle `backButton` to `navigate(-1)` and close open drawer/modals; handle `appUrlOpen` deep links. | `package.json:17-19`; no matches in `src` |
| C7 | **Hover-only controls** | Features reachable only by hover are invisible on touch: copy-to-clipboard (StudentProfile), notification dismissal (`mousedown` only), tooltips (`hover`/`focus` only). | **High** | Make controls visible/`opacity-100` on coarse pointers; add `onPointerDown`/`onClick`; give tooltips a tap path. | `StudentProfile.tsx:224-234`, `NotificationsDropdown.tsx:246`, `layout/Tooltip.tsx:34-36` |
| C8 | **External CDN assets** | Mermaid runtime, DepEd seal (gstatic), and a Vercel-hosted seal are hotlinked — blank/dead offline or behind a strict CSP. | **High** | Bundle `mermaid` (`npm i mermaid`, dynamic import) and localize both seal images into `src/assets`. | `SystemGuide.tsx:29-30,322-334,435,528`, `sf5-report.tsx:778`, `school-form-title.tsx:16` |
| C9 | **`ui/select.tsx` height bug** | Radix select viewport uses `h-[var(--radix-select-trigger-height)]`, the known shadcn clipping bug — long lists clip inside modals. | **Medium** | Use `min-h-[var(--radix-select-trigger-height)] h-auto` and `max-h-*`. | `ui/select.tsx:81` |
| C10 | **`ui/dialog.tsx`** | `fixed top-[50%]` with no `max-h`/`overflow`, bare `size-4` close icon; not safe-area aware. | **Medium** | Add `max-h-[88vh] overflow-y-auto` + safe-area + larger close target, or route through `ModalShell`. | `ui/dialog.tsx:60,66` |
| C11 | **`ui/sheet.tsx`** | `inset-y-0 h-full`, no safe-area padding, icon-only close. | **Medium** | Add `pb-safe` and `touch-target` close. | `ui/sheet.tsx:63,65,75` |
| C12 | **`ui/sonner.tsx`** | Uses `useTheme()` from `next-themes` but no `ThemeProvider` exists → toasts don't follow app theme; toast layer lacks safe-area offset. | **Low** | Drive from `AppContext.darkMode`; add `pb-safe`/`pt-safe` offset. | `ui/sonner.tsx:3,7`, `AppContext.tsx:404` |
| C13 | **DocumentViewer pinch bug** | `touchAction:'pan-x pan-y'` (`:151`) conflicts with a non-passive `touchmove` `preventDefault()` (`:96`) — pinch-zoom misbehaves. | **Medium** | Set `touchAction:'none'` while JS handles gestures, or drop the JS handler and use CSS `touch-action: pan-x pan-y pinch-zoom`. | `DocumentViewer.tsx:96,151` |
| C14 | **Router/deep links** | `createBrowserRouter` in a WebView with `androidScheme: https` works for in-app nav, but hard reloads / external-tab links are brittle (several `<a href>` cause full document reloads and state loss). | **Medium** | Keep `createBrowserRouter`; replace internal `<a href>` with router `<Link>`. | `pages/admin/LisExport.tsx:25-30`, `pages/principal/PrincipalExportCenter.tsx:474-483` |

---

## 3. App shell & shared components

| Area | Problem | Severity | Recommended Fix | File |
|---|---|---|---|---|
| Main scroller | Fixed `pb-20` doesn't include the home-indicator inset (BottomNav adds `pb-safe`), so the last content row is obscured on gesture-nav devices. | Medium | `pb-[calc(5.25rem+env(safe-area-inset-bottom))]`. | `Layout.tsx:121-122`, `BottomNav.tsx:35` |
| FormPrintPreview | Full-screen centered dialog (not a sheet), `iframe min-h-[420px]`, Print dead on native, `p-1.5` close. | High | Bottom-sheet it; scale iframe via transform; native share; `touch-target`. | `FormPrintPreview.tsx:76,86-109,128` |
| School form header | Inputs `text-[11px]` with fixed widths `w-28`…`w-72`. | Low | `w-full sm:w-*`, `text-base` on mobile. | `school-form-header.tsx:28,96-140` |
| StudentRiskList | Raw `min-w-[1000px]` 9-column table, no `HybridTable`; 26px filter chips; 32px search. Fixes 3 roles' at-risk pages at once. | High | `HybridTable` mobile card list; `touch-target` chips. | `StudentRiskList.tsx:191-192,170,162` |
| StudentRiskOverview | Row `flex gap-3` with fixed `w-10` avg + chip; name truncates to nothing. | Medium | Stack under `sm`, hide chip. | `StudentRiskOverview.tsx:119-139` |
| NotificationsDropdown | `mousedown`-only dismissal; panel `absolute right-0 top-12` (not portaled), no safe-area. | Medium | `pointerdown` + outside/Escape; portal + safe-area. | `NotificationsDropdown.tsx:246,273` |
| SearchCommand | Whole palette commented out; trigger only present on desktop (center search) — mobile uses the icon. | Low | Confirm intentional; otherwise re-enable. | `SearchCommand.tsx:95-96` |
| Confetti | Many animated DOM nodes; battery/perf on low-end devices. | Low | Cap piece count on mobile / respect `prefers-reduced-motion`. | `Confetti.tsx:34`, `BulkPromotion.tsx:785` |

---

## 4. Admin pages

| Page | Problem | Severity | Fix | File |
|---|---|---|---|---|
| AcademicYearManagement | Raw table (6 cols) no cards; 2 hand-rolled modals no `max-h`; 36px badges, 28px row actions. | High/Medium | `HybridTable`; `ModalShell`; `touch-target`. | `:440-476`, `:576,605`, `:421,503` |
| ActivityLogs | Search-clear `✕` ~16px; filter row no `flex-wrap`. | High/Medium | `touch-target`; `flex-wrap`. | `:203`, `:209-248` |
| AdminDashboard | Chart `height={240}` fixed; `grid-cols-2` stat cards. | Medium/Low | `h-56 sm:h-72`; `grid-cols-1 sm:grid-cols-2`. | `:250,281`, `:202` |
| AdminRooms | Status filter row overflows; `p-1.5` icon buttons; 2 hand-rolled modals; non-responsive grids. | High | `flex-wrap`; `touch-target`; `ModalShell`; responsive grids. | `:159-169`, `:206,209`, `:220,306`, `:246,260,278` |
| DatabaseBackup | Native-broken + token-in-URL download; 24px mobile Download/Restore; hand-rolled restore modal; `p-1 text-xs` links. | High | Filesystem/Share; `touch-target`; `ModalShell`. | `:383,387`, `:403`, `services/backups.ts:22-40` |
| LisExport (admin) | `<a href>` full reload; 40px CTA; `p-8 mt-10`. | Medium/Low | router `<Link>`; `touch-target`; `p-5 sm:p-8`. | `:25-30`, `:27`, `:13` |
| RoleAccessControl | Permission switch `h-5 w-9` (20×36) is the primary control; fixed `max-h-[560px]` inner scroll; 30px bulk buttons. | High/Medium | Wrap in `min-h-11 min-w-11`; `max-h-[60vh]`; `touch-target`. | `:52`, `:374`, `:349-369` |
| SchoolSettings | `grid-cols-2` thresholds; non-wrapping footer; 24px remove chips; `w-44` fixed input. | Medium/Low | responsive grids; `flex-wrap`; `touch-target`; `w-full sm:w-44`. | `:834`, `:375,856`, `:65-69`, `:575` |
| SectionCreation | **6** hand-rolled modals; 32px swatches/icons; 20px clear links; dropdown clipping. | High/Medium | `ModalShell`; `touch-target`; portal dropdown. | `:531,617,681,705,870,1027`, `:929,960`, `:948,974`, `:91` |
| SubjectManagement | **4** hand-rolled modals; `grid-cols-3` type selector; 32px close. | High/Medium | `ModalShell`; `grid-cols-2 sm:grid-cols-3`; `touch-target`. | `:649,743,821,960`, `:693`, `:661` |
| UserManagement | **3** hand-rolled modals (`p-6`, `max-h-[65vh]`); password-eye no padding. | High/Medium | `ModalShell`; `touch-target`. | `:780,821,859,888`, `:1021-1026` |

---

## 5. Registrar pages

| Page | Problem | Severity | Fix | File |
|---|---|---|---|---|
| SchoolForms | **5** raw `<table>`s inside `overflow-hidden` with **no scroll** (clipped); hand-rolled generator modal; 3× `flex-1` footer buttons overflow; `grid-cols-4` config. | **High** | Wrap tables `overflow-x-auto` + `min-w-[720px]`, or `DocumentViewer`; `ModalShell`; `flex-wrap`. | `:586,675,889,973,1096`, parent `:356`, `:355,469`, `:1222-1238`, `:381` |
| SectionAssignment | Queue/preview tables `w-full` with **no `min-w`** → columns compress to ~45px and text wraps per character; **14px checkboxes** drive bulk assign (mis-tap risk); 20px Exam/Interview toggles. | **High** | `min-w-[860px]` + `HybridTable`; `w-5 h-5` in 44px hit area; `min-h-11` toggles. | `:797-798,1075-1076`, `:1085,1110`, `:1182,1197` |
| DocumentCompletion | `min-w-[900px]` matrix, scroll-only. | Medium | `HybridTable` per-learner checklist. | `:323-324,331,346` |
| EnrollmentReport | `min-w-[850px]` table; blob export; 14px clear buttons; toast no safe-area. | High/Medium | Mobile cards; Filesystem/Share; `touch-target`; safe-area toast. | `:607-608`, `:186,268,300`, `:466,486`, `:403` |
| GradeCorrections | `w-full` table no `min-w` (chars break); hand-rolled modal. | Medium | `min-w-[640px]` or cards; `ModalShell`. | `:175-176,242`, `:275` |
| PromotionRecords | Hand-rolled detail modal with nested `min-w-[880px]` table; blob export. | Medium/High | `ModalShell` + stacked rows; Filesystem/Share. | `:252,365-366`, `:70` |
| RegistrarAtRisk | Mounts `StudentRiskList` (1000px). | Medium | See §3. | `StudentRiskList.tsx:191-192` |
| StudentSearch | `min-w-[700px]` table scroll-only; blob CSV export. | Medium/High | Mobile cards; Filesystem/Share. | `:336-337`, `:166` |
| CertificateOfEnrollment / GoodMoral / CertificateParts | `p-10` + `w-64` signature block clipped by `overflow-hidden`; no zoom/pan; Print dead; 16px clear. | High/Medium | Wrap in `DocumentViewer`; `w-40 sm:w-64`; native share; `touch-target`. | `CertificateParts.tsx:110`, `CertificateOfEnrollment.tsx:133-134`, `:117-129`, `CertificateStudentSearch.tsx:98-103` |
| ScheduleModifier | Hand-rolled modal; 30px close; table pans. | Medium/Low | `ModalShell`; `touch-target`. | `:403,412-418`, `:332-333` |
| SpecialSubjects | 28px Edit/retire buttons; default 13px checkbox. | Medium | `touch-target`; `h-5 w-5`. | `:495,507`, `:364-370` |
| TransferManagement | Hand-rolled long form modal; 34px close; unqualified `grid-cols-3` stats. | Medium | `ModalShell`; `touch-target`; `grid-cols-1 sm:grid-cols-3`. | `:582-583`, `:593-597`, `:456` |
| sf1-register | `h-5` inputs, 10px text, effective ~10px tap target inside a 1340px sheet; global unscoped print CSS. | **High** | Separate wide "data-entry mode" from the paper preview; scope print CSS. | `:872,886`, `:906`, `sf1.css:22-53` |
| sf5-report | `h-6`/10px inputs; external gstatic seal. | **High**/Medium | Wide entry mode; local seal asset. | `:890`, `:778` |
| sf9-report | ~90 `h-6` `select`s per card + 9px text inside 850px sheet. | **High** | Stacked tappable behavior list for on-screen entry; paper grid for preview/print. | `:1397-1407`, `:829,1246,1347` |
| sf10-report | Suggestion dropdown `onMouseDown` **does not fire on touch** (learner search broken on phone); 11px paper text. | **High**/Medium | `onPointerDown`/`onClick`; wide entry mode. | `:851`, `:1310,1514,1563` |

---

## 6. Teacher & Committee pages

| Page | Problem | Severity | Fix | File |
|---|---|---|---|---|
| GradeManagement | Correction modal panel is `overflow-hidden` with only the body `max-h-[65vh]` → **clipped, not scrollable**. | **High** | Make panel `app-scroll`/`overflow-y-auto` or use `ModalShell`. | `:915-1031` (panel `:916`, body `:933`) |
| ReadingAssessments | 820px-wide list, unbounded vertically. | Medium | `HybridTable` + `max-h`. | `:326` |
| EnrollmentModule | 4 KPI tiles `grid-cols-2` pair a long non-truncated label with a `w-9` icon; label wraps to 2–3 lines. | Medium | `truncate`/`min-w-0` on label; drop icon under `sm`. | `:1738` (tile `:1728-1748`) |
| AtRiskDetection | Inherits `StudentRiskList`; root layout. | Medium | See §3. | `:7,41` |
| TeacherProfile | Profile-photo picker triggers `saveProfilePhoto(file)`; camera/`accept` path. | Medium | Confirm `accept`/size guard; `touch-target`. | `:80,89` |
| TransferApprovals | `title`-only info with only a banner fallback for unapprovable. | Low | Promote the banner text. | `:274,355` |

---

## 7. Principal & standalone/auth pages

| Page | Problem | Severity | Fix | File |
|---|---|---|---|---|
| PrincipalDashboard | Pie `outerRadius={100}` + outside labels in a ~248px card → overflow/clip; second pie `95` + Legend in `height={260}`; crowded axes; fixed chart heights. | **High** | `outerRadius="70%"`, `label={false}` + `<Legend>`; `YAxis width={36}`, angled `XAxis`; responsive heights. | `:211-219,285-295`, `:196-197,238-239`, `:311` |
| EnrollmentFigures | Raw 3-col table scroll-only; header chip no wrap; 28px filter buttons; axis crowding. | Medium | `HybridTable`; `flex-wrap`; `touch-target`. | `:114-142`, `:69-80`, `:87-92`, `:98-105` |
| EnrollmentTrend | Raw table; header no wrap; axis crowding. | Medium | `HybridTable`; `flex-wrap`. | `:103-125`, `:55-66`, `:87-94` |
| GradeProgress | Raw table × per grade; `title`-only Locked badge. | Medium | `HybridTable`; inline badge text. | `:108-151`, `:140` |
| PromotionStats | Raw table; `"G7 → G11"` labels overlap badly. | Medium-High | `HybridTable`; angled XAxis. | `:116-149`, `:100-107` |
| SectionPopulation | Raw 6-col table (worst); `grid-cols-2` stat cards. | Medium-High | `HybridTable`; responsive cards. | `:122-159`, `:71-100` |
| PrincipalExportCenter | `pdfMake.createPdf().download()` broken on native (no FS/share plugins); select row no wrap; `<a href>` tabs; eager ~1.5MB pdfmake import. | **High** | Filesystem/Share; `flex-wrap`; router `<Link>`; dynamic import. | `:86-88`, `:434-466`, `:474-483`, `:24-25` |
| PrincipalProfile | Inherits `ProfileSections` `ChangePasswordModal` (hand-rolled) + 4 small controls. | High/Medium | Fix `ProfileSections` once. | `:147`, `ProfileSections.tsx:759,276,477-493,630-634,752` |
| AtRiskView | Mounts `StudentRiskList`. | High | See §3. | `:32` |
| SystemGuide | Mermaid CDN (offline-dead); scale+`overflow-hidden` clips zoom; `min-w-[800px]`; node clicks are mouse-oriented; Print dead; blob exports; external seals. | **High** | Bundle mermaid; proper scroll-zoom; mobile module list; native share; local assets. | `:29-30,322-334`, `:769-775`, `:282-320`, `:398,509-513`, `:383-423`, `:435,528` |
| Login | LegalModal hand-rolled; `min-h-screen` + `overflow-hidden` + nested scroll + `my-auto`; terms links nested in `<label>` (double-activate); 24px eyes; no safe-area. | High/Medium | `ModalShell`; `min-h-dvh`; un-nest links; `touch-target`; safe-area. | `:265-309`, `:878-882`, `:1031-1050`, `:980-985`, `:656-699` |
| ResetPassword | No safe-area; `min-h-screen`; icon-only eye, no confirm toggle; missing injected animation style. | Medium | safe-area + `min-h-dvh`; `touch-target`. | `:51`, `:141-147`, `:53` |
| StudentProfile | Copy button `opacity-0 group-hover` → **unreachable on touch**; 5 nowrap tabs pan with no indicator; 9px grade labels. | High/Medium | Always-visible copy on coarse pointer; scroll-into-view + shadow; `text-[11px]`. | `:224-234`, `:506-539`, `:965-980` |
| NotFound | No safe-area; non-wrapping button row; 230px "404" row; 40px buttons. | Medium/Low | safe-area; `flex-wrap`; responsive sizes. | `:11`, `:43-57`, `:27-31`, `:44-56` |

---

## 8. Capacitor-native checklist (config/plugins)

| Item | Current | Action |
|---|---|---|
| `@capacitor/filesystem` | ✅ installed (8.1.4) | Required for every export. |
| `@capacitor/share` | ✅ installed (8.0.3) | Share exported files. |
| `@capacitor/browser` | ✅ installed (8.0.5) | For external links (LIS portal, deep links). |
| `@capacitor/app` | ✅ installed (8.1.2) | Hardware back + `appUrlOpen` deep links. |
| `@capacitor/status-bar` | ✅ installed (8.0.4) | Edge-to-edge / status-bar color management. |
| Safe-area CSS (`pt-safe`…) | defined, mostly unused | Apply across shell + modals + standalone routes. |
| `window.print()` | used in 5+ places | Replace/guard for native. |
| `min-h-screen` | Login, ResetPassword | `min-h-dvh` (URL-bar/keyboard). |
| `createBrowserRouter` | in use | Keep; ensure internal links use router `<Link>`. |
| External assets | mermaid CDN, gstatic/vercel seals | Bundle locally for offline. |

---

## 9. Recommended implementation waves

Ordered by leverage and risk; each wave is independently shippable and desktop-preserving (all changes are additive/responsive).

- **Wave 0 — Capacitor plumbing:** install `@capacitor/filesystem`, `share`, `browser`, `app`, `status-bar`; add a `downloadAndShare()` util; hardware back; verify build:mobile. **✅ DONE 2026-10-03**
- **Wave 1 — Native output paths:** replace every blob download + `window.print()` with the util / share (C1, C2, C3, C8). **✅ DONE 2026-10-03**
- **Wave 2 — Shared foundation:** safe-area in `Layout`/`ModalShell`/standalone routes (C5); adopt `ModalShell` for all ~20 modals (C4); fix `ui/select` height, `ui/dialog` max-h, `ui/sheet` safe-area, `ui/sonner` theme (C9–C12). **✅ DONE 2026-10-03** — safe-area applied to `TopBar`, `Layout` main, `ModalShell`, `AppContext` toasts, `ResetPassword`, `NotFound`, `Login`(+LegalModal); 26 hand-rolled modals converted to `ModalShell` across admin/registrar/teacher/shared (nullable-state modals wrapped in their original guard to preserve TS narrowing); `ui/select` `min-h`, `ui/dialog` `max-h-[88vh] overflow-y-auto pb-safe` + 36px close, `ui/sheet` bottom-sheet `max-h-[88vh] pb-safe` + 36px close. C12 skipped: `ui/sonner.tsx` is dead code (app toasts render in `AppContext`; `<Toaster>` is never mounted).
- **Wave 3 — Tables:** `HybridTable` / `overflow-x-auto` conversions — priority `SchoolForms`, `SectionAssignment`, `StudentRiskList`, `DocumentCompletion`, `EnrollmentReport`, principal tables, `StudentSearch`, `GradeCorrections`. **✅ DONE 2026-10-03 (scroll fix)** — `SchoolForms` 5 raw tables got `overflow-x-auto` wrappers + `min-w` (720px; SF9 attendance 320px) with footer `flex-wrap`/`sm:flex-1`; `SectionAssignment` both tables `min-w-[860px]`; `GradeCorrections` `min-w-[640px]`; principal `EnrollmentFigures`/`EnrollmentTrend` 520px, `GradeProgress`/`PromotionStats` 560px, `SectionPopulation` 720px; `DocumentCompletion` (900px), `EnrollmentReport` (850px), `StudentSearch` (700px) and `StudentRiskList` (1000px) already had `overflow-x-auto`+`min-w`. Mobile stacked-card variants (`HybridTable`) deferred to Wave 4 polish.
- **Wave 4 — Touch ergonomics:** sub-44px targets, `SectionAssignment` checkboxes/toggles, `RoleAccessControl` switch, `AdminRooms`/`ActivityLogs` filters, `flex-wrap` grids. **✅ DONE 2026-10-03** — `RoleAccessControl` switch expanded via `after:-inset-3` pseudo hit area (visual pill unchanged) + bulk buttons `min-h-11` + checklist `max-h-[60vh]`; `SectionAssignment` checkboxes `w-5 h-5` inside `touch-target` labels, Exam/Interview toggles `min-h-11`; `Login`/`ResetPassword` eyes `touch-target` (+`pr-11`), `Login` legal links un-nested from the agree `<label>` (double-activate bug fixed), modal gets `aria-label`s; `StudentProfile` copy button now visible on touch (`opacity-100 md:opacity-0 md:group-hover`) + scrollable tab row; `AdminRooms`/`ActivityLogs` filters `flex-wrap` + `touch-target` icons; `SchoolSettings` chips `after:-inset-3`, footer `flex-wrap`, `w-full sm:w-44`, `grid-cols-1 sm:grid-cols-2`; `SpecialSubjects`/`StudentSearch`/`GradeCorrections`/`TransferManagement` buttons `min-h-11`/`touch-target`, checkboxes `w-5 h-5` in `touch-target` labels; `NotFound` button row `flex-wrap`. `touch-target` = `min-h/min-w 44px` utility.
- **Wave 5 — Charts:** principal/admin pie radius + labels, axis width/angle, responsive heights. **✅ DONE 2026-10-03** — `PrincipalDashboard` program pie `outerRadius="70%"` + `label={false}` + `<Legend/>` (was `100` + outside labels overflowing), gender pie `outerRadius="70%"`, bar/trend/dist `YAxis width={36}` + `interval={0}`; `AdminDashboard` chart wrapped in `h-56 sm:h-72` with `ResponsiveContainer height="100%"` + `YAxis width={32}`, stat grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`; `EnrollmentFigures`/`EnrollmentTrend` `YAxis width={36}` + `interval={0}`; `PromotionStats` angled `XAxis` (`angle={-20} textAnchor="end" height={54}`) + `YAxis width={36}`.
- **Wave 6 — Paper forms:** on-screen "wide data-entry mode" for SF1/SF5/SF9/SF10; fix `sf10` touch suggestion bug; document-viewer pinch fix (C13). **◑ PARTIAL 2026-10-03** — ✅ `sf10` learner-suggestion dropdown `onMouseDown` → `onPointerDown` (tap now selects on touch); ✅ `DocumentViewer` auto-fits the paper to the phone viewport on first paint (was manual "Fit" only); ✅ global SF print CSS scoped under `body:has(.sf1-page)` so its chrome-hiding/width-reset rules no longer leak to unrelated page prints (C-scope). All four forms already render inside `DocumentViewer` (pan/zoom/`Fit`), which is the adaptation. ⛔ **Deferred (large/feature work):** dedicated wide mobile data-entry modes for SF1/SF5/SF9/SF10 (the paper sheets remain print-accurate and are viewable/pannable/zoomable on mobile; entering ~90 fields per SF9 on a phone stays impractical). C13: existing confined two-finger pinch retained (single-finger native pan via `touch-action: pan-x pan-y`); revisit only if pinch misbehaves on-device.
- **Wave 7 — Polish/offline:** bundle mermaid + seals, hover-only fixes (C7), confetti reduced-motion, router `<Link>` swaps (C14). **✅ DONE 2026-10-03** — C8: `npm i mermaid`, `SystemGuide` now dynamically imports bundled mermaid (own 165 kB gzip chunk, works offline; CDN script injection removed); DepEd seals localized — `school-form-title.tsx` + `sf5-report.tsx` gstatic URLs and `SystemGuide` 2× Vercel URLs now import `src/assets/7bbc…png` (right-side logo was already inline base64). C7: `Tooltip` reveals the label on `touchstart` for 1.6 s (was hover/focus only); `StudentProfile` copy fix from Wave 4. Confetti: `@media (prefers-reduced-motion: reduce)` hides `.confetti-piece`. C14: `LisExport` and `PrincipalExportCenter` tab `<a href>` → router `<Link>` (no full reloads); `LisExport` also `p-5 sm:p-8` + `touch-target` CTA.
- **Wave 8 — residual audit fixes (out-of-wave items):** **✅ DONE 2026-10-03** — `StudentRiskList` gets a `md:hidden` mobile card list (desktop table now `hidden md:block`) + `touch-target` filter chips/search (fixes all 3 at-risk pages); `StudentRiskOverview` hides the low-value classification chip under `sm` so the name has room; `NotificationsDropdown` outside-dismiss switched `mousedown`→`pointerdown` + Escape closes; `Confetti` caps pieces at 28 on phones (<768px) on top of reduced-motion; `AcademicYearManagement` summary table `min-w-[560px]` + `touch-target` row actions / bulk-promotion CTA; `DatabaseBackup` mobile Download/Restore `touch-target` + 13px icons; `SubjectManagement` type selector `grid-cols-2 sm:grid-cols-3` + `touch-target` type buttons & modal closes; `SectionCreation` swatches `w-10 h-10`, icon picker `w-11 h-11`, clear-links/search-clear `touch-target`; `EnrollmentModule` KPI label `truncate min-w-0` + icon `hidden sm:flex`; `EnrollmentReport` search-clear `touch-target`; certificates (`CertificateParts` signature `w-40 sm:w-64 max-w-full`, `CertificateOfEnrollment`/`GoodMoralCertificate` body `p-6 sm:p-14`); `TransferManagement` stats `grid-cols-1 sm:grid-cols-3`; `EnrollmentFigures`/`EnrollmentTrend` headers `flex-wrap` + filter buttons `touch-target`; `SystemGuide` zoom transform moved from the scroll container to the inner canvas so `overflow-auto` can actually pan the zoomed diagram. **Deferred:** `PrincipalExportCenter` eager pdfmake import (route-level lazy loading already isolates it; dynamic-import refactor risks the PDF path); wide SF1/SF5/SF9/SF10 mobile data-entry modes; `StudentRiskList`/`DocumentCompletion`/`ReadingAssessments` full `HybridTable` conversions where horizontal scroll already works.

---

## 10. Notes / non-issues (verified)

- Server CORS already permits Capacitor origins (`server/src/index.ts:67-99`).
- `AndroidManifest.xml` already has a `FileProvider` and cleartext for the dev LAN API.
- `HybridTable` + `PageContainer` are correctly used in `Graduates`, `StudentProfile` tables, `UserManagement`/`SubjectManagement` lists, `AdminDashboard`, `ActivityLogs`.
- No `<input type="file">` / `capture` exists in registrar pages (nothing to adapt there beyond the shared profile picker).
- `RegistrarDashboard`, `GradeDistribution`, `MasterSchedule`, `SubjectView` are effectively mobile-ready.
- `ui/resizable.tsx` is an intentional stub; `ui/sidebar.tsx` is unused.
