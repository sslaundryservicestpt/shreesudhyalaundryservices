# Marketing-aligned operations design

Approved implementation, 2026-11-17. Marketing source, artwork and business behavior are preserved.

## What changed

- Reused marketing's existing banner logo byte-for-byte in operations login, sidebar and isolated demo. Removed duplicate text branding and the separate SS text mark at those placements. Original artwork is not regenerated or edited.
- Aligned operations with navy #08253E, aqua #008ED5, gold #B58B40 and warm ivory #FAF9F5. Body/table type remains DM Sans; the login headline uses a restrained serif. Emerald remains meaningful for success states.
- Added a lazy-loaded CSS perspective washer accent on login and the live dashboard: brief six-second animation, pause/replay and hide controls, offscreen/hidden-page suspension, static SVG alternative for mobile/reduced motion. No Three/Fiber dependency, WebGL canvas, GLTF, textures or GPU resource lifecycle is added to operations. This is intentionally a 3D-style CSS model, not the full marketing WebGL scene.
- Added a labelled ordered workflow pipeline from actual order state. Processing/QC completion uses batch and quantity state, not an animation timer. Billing eligibility is explicitly distinguished from invoice issuance.
- Improved timeline colors, small illustrated empty-state accents, and a brief server-confirmed success reveal limited to collected pickups, issued invoices and recorded payments. Discrepancy/count saves do not trigger the milestone animation. All normal error and save messages remain visible text.
- Dashboard progress shows completed versus non-cancelled orders in the authorized scope, with all-time/current-snapshot wording and a completed-order drilldown. No invented daily percentages or mixed quantity-unit sums.
- Demo banner uses the requested explicit sample-only statement and Exit demo link. It retains local-only data and does not obtain a real auth session.

## Verification

- Operations lint and typecheck passed.
- Operations unit suite: 12 passed, including three new SSR checks for logo alternative text, unverified pipeline state and delivery-versus-invoicing semantics.
- Domain baseline: 18 passed. Marketing cycle/layout/export/contact checks passed during audit.
- Operations production build passed; marketing production build verified separately in the execution report.
- HTTP login and demo: 200 with the shared brand asset. Anonymous business API: 401.
- SHA-256 hashes of marketing and operations banner assets match.
- No database migration, financial-rule change, new production data or authentication bypass was introduced.

## Manual checks / limits

Open /login: observe the brief drum animation, pause/replay/hide it, then enable reduced motion and use a phone-width viewport. The form must stay usable while the scene chunk loads. Open /demo: verify role switching, filtering, sample-data banner and Exit demo. Sign into a configured real account: check order pipeline labels against counts and batch history, and verify completion counts against the linked list.

Real-browser motion, keyboard/device layouts, screen-reader output and frame timing are not certified in this session. No FPS, Lighthouse or screenshot acceptance result is claimed. New Playwright motion/device coverage remains a follow-up. Daily progress indicators, animated milestone feedback for other actions and a shared WebGL component package are not implemented; only metrics with a clear current data basis are displayed.


## Login viewport refinement

The screenshot showed the original oversized story panel forcing the form below the viewport. Login now has a continuous marketing ivory background on both sides, navy/gold copy, an unframed logo presentation, a smaller two-line heading and a side-by-side feature/illustration row. Empty auth status text occupies no grid row; real error text remains available. Short-screen spacing is reduced while controls retain 44px minimum heights. Mobile uses a compact logo header and stacked form. No fixed-height clipping or overflow-hidden workaround is used. Logo image bytes remain unchanged; CSS clips the decorative outside edge and blends the paper background with ivory.

Operations lint, twelve unit tests and the login HTTP check passed. The build completed compilation, TypeScript and prerendering; final completion is recorded in the execution result. Actual browser/device fit is not screenshot-certified in this session.


## Logo-paper colour unification

Sampled the existing banner JPEG's paper areas, excluding saturated artwork and frame colours. Bright upper paper median: #FBFAF8; lower paper median: #F7F6F2. Combined neutral background median: #F8F7F5. These are texture samples rather than a claim that every raster background pixel has one colour.

A shared --logo-paper token now drives the login, dashboard canvas, sidebar, drawer, header and footer. Card paper uses sampled #FBFAF8 for gentle separation; form fields retain a pale warm tint for readable controls. Removed main-surface marble overlays and logo multiply blending to avoid darkening the original raster background. Navy text and restrained gold/aqua interactive states maintain contrast on light navigation. Original logo files and business behavior are unchanged.

Operations lint and served login/CSS HTTP checks passed; sampled token and normal blend are confirmed in the delivered stylesheet. No new database changes or browser visual certification are claimed.


## Clean logo replacement — supersedes banner-paper matching

The later screenshot confirmed that the old logo's visible gold rectangle and service-icon strip were baked into the banner asset. A flat background colour alone could not remove them. Operations now uses the owner's supplied clean 1536×1024 artwork (attachment e1904560-b5b3-4d33-95b5-0e56431c8b15) as brand-logo-clean.jpg. It was copied without modifying pixels. Top, left and right paper samples all had dominant RGB (254,254,254), so shared --logo-paper and --logo-paper-light now use #FEFEFE. Logo clipping and blending were removed, with explicit compact dimensions for sidebar, short login viewports and mobile. Marketing source remains untouched.

Login/demo HTTP responses reference the clean asset and not the old banner; the JPEG is served successfully. Operations lint and twelve unit tests passed. Actual browser screenshot acceptance remains unverified.
