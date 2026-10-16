# Safe Land

Safe Land is a land-safety website with a government-style green and white design. It has an animated intro, a login site, a corporate dashboard for officers and institutions, and a citizen portal for ordinary users.

It is a front-end prototype. It runs entirely in the browser, and all land data is sample data. See [Limitations](#limitations).

## Pages and how people move between them

```
index.html (intro) -> Enter portal -> login type page
   |-- User login ------> ID + password -> OTP -> portal.html (citizen portal)
   |      |-- Create account: details -> OTP -> account saved -> back to the intro
   |      '-- Forgot password: ID + last name -> OTP -> new password
   '-- Corporate login --> ID + password -> OTP -> corporate.html (corporate dashboard)
```

- Every page after the intro has a back arrow in the top left. On the dashboard and the portal it logs the person out and returns to the login type page.
- `index.html#login` skips the intro and opens the login type page directly.
- `corporate.html` and `portal.html` check for a logged-in session. Without one, they send the visitor back to `index.html`.
- Corporate accounts are not created on this site. There is no "forgot password" or "create ID" on the corporate login.

### Corporate dashboard (`corporate.html`)

| Tab | What it does |
|---|---|
| E-Registration | The escrow and temporary lock engine. Plots move through `ACTIVE_VERIFIED`, `TEMPORARY_ESCROW_LOCK` and `PERMANENT_RECORD_UPDATED`. Officers register a deed, which saves a draft and locks the plot. When the same plot is selected again, its draft page appears, and the officer completes e-Mutation from it (releases the lock and transfers ownership). Each plot keeps a history. |
| Topsoil Scan | A real map (satellite or street view) with flagged plots and alert cards. Marker and card are linked, and "Dispatch inspection" updates both. |
| River Inspection | A real map of the Meghna River near Meghna Bridge with a legal Balu Mahal zone and simulated boats. A boat is amber within 20 m of the zone line and red more than 20 m outside it. Pumping during the banned hours (6 pm to 6 am, Bangladesh time) also raises an alert. Alerts move from New to Acknowledged to Patrol dispatched. |

### Citizen portal (`portal.html`)

| Heading | What it does |
|---|---|
| My Land Vault | Lists the user's parcels, totals them against the 60-bigha ceiling (counted as 1,980 decimals), and has an anti-theft guard toggle with a test alert. A parcel the user tries to link goes under verification first. It is added only if it matches the land records registered to the user's NID. Otherwise the user sees Access denied and nothing is added. |
| Land Check | Takes district, upazila, mouza, daag and khatian. Returns a 0 to 100 score (Safe, Caution or High Risk) and four checks: ownership continuity, sub-registry lock, litigation and zoning. Daag numbers that match the corporate sample plots use their real lock state. |
| Tax & Fee Calculator | Shows the fixed e-Mutation fee (BDT 1,170) and the percentage registration costs, plus economic codes for direct payment. |
| Family Land Distributor | Computes Islamic inheritance shares as exact fractions, including the cases where shares are reduced or the remainder is returned. It can download a Warishan Buntonnama summary. |
| Report Digging | An anonymous report with a photo, device GPS, time and nearest mouza. |

## Demo buttons

The login type page has a **Demo as Citizen** button on the user login card and a **Demo as Officer** button on the corporate login card. Each one logs in as a made-up demo account with no ID, password or OTP to type, so a reviewer can open the citizen portal or the corporate dashboard in a few seconds. The demo accounts hold only dummy data. Remove these buttons before real use.

The E-Registration tab has a **Reset demo plots** button that puts the sample plots back to their starting states after someone has tried locking or changing them.

## Files

| File | Purpose |
|---|---|
| `index.html`, `index.css`, `index.js` | The intro and the login site |
| `corporate.html`, `corporate.css`, `corporate.js` | The corporate dashboard |
| `portal.html`, `portal.css`, `portal.js` | The citizen portal |
| `storage.js` | All saved data: accounts, the OTP, plots, parcels, reports, the login history and the session. Loaded by all three pages. Uses the online database when `config.js` has one, and the browser otherwise. |
| `config.js` | The two database settings (URL and public key). Empty means browser-only mode. |
| `supabase-setup.sql` | A one-time script that creates the online database tables and functions, with dummy data. |
| `supabase-drafts.sql` | Adds the saved draft registrations used by E-Registration. |
| `supabase-verification.sql` | Adds the land records and the parcel verification check used by the Land Vault. |

## Setting up the online database (optional)

Without a database, accounts exist only in the browser where they were created. With one, the same ID and password work on any device.

1. Create a free project at [supabase.com](https://supabase.com).
2. In the dashboard, open **SQL Editor**. Paste and run these three files, one at a time and in this order: `supabase-setup.sql`, then `supabase-drafts.sql`, then `supabase-verification.sql`. Do not run `supabase-setup.sql` again afterwards, because it would replace the newer functions.
3. Open **Project Settings > API**. Copy the **Project URL** and the **anon public** key.
4. Paste them into `config.js`. Never paste the `service_role` key anywhere.
5. Redeploy the site.

How it works: the tables are locked, and the site can only call the functions in the SQL file. Passwords are hashed with bcrypt inside the database. Each login returns a session token, and officer or citizen actions need that token. The citizen's land vault, the guard setting, the E-Registration plot states and the anonymous reports are saved in the database. Plot states are shared, so everyone sees the same plots.

If the database cannot be reached, login shows a message asking the person to try again.

## Deploying on Vercel

1. Put all the site files (the `.html`, `.css` and `.js` files above) directly in the root of the project, not inside another folder. `supabase-setup.sql` and this README do not need to be uploaded.
2. Keep the file names exactly as they are. The pages load each other by name.
3. Deploy. The main address opens `index.html`.

The site is static and needs no build step.

## Where to change things

| To change | Open |
|---|---|
| Text and headings | The page's `.html` file |
| Colors, spacing and fonts | The page's `.css` file |
| The OTP code, the demo accounts, sample plots and sample parcels | `storage.js` |
| The database URL and public key | `config.js` |
| Fee and tax percentages (`RATES`), economic codes, ceiling size | `portal.js` |
| River zone and bridge coordinates (`ZONE`, `BRIDGE`), boat behavior, pump-ban hours (`NIGHT`) | `corporate.js` |
| Topsoil alerts and map markers (`ag`) | `corporate.js` |

## How data is stored

- **Browser mode (no database):** `localStorage` key `lt_db` holds accounts, plots, parcels, reports and the login history. Passwords are stored as a SHA-256 hash.
- **Database mode:** the same data lives in Supabase tables. Passwords are hashed with bcrypt inside the database.
- `sessionStorage` key `lt_session` holds who is logged in, for the current browser tab only.

## Limitations

- **Fixed OTP.** Every OTP step accepts one fixed code stored in `storage.js`. No SMS is sent. Replace this with a real SMS service before real use. The OTP check also runs in the browser, so it can be bypassed.
- **The public key is public.** Anyone can call the database functions with the anon key. The tables are protected, but there is no rate limiting on logins.
- **Sample data.** Land records, court checks, zoning results, plots, satellite alerts and boat positions are sample or simulated. Nothing connects to a real land database, satellite feed or GPS tracker. Use dummy data only. Do not enter real names, NID numbers, phone numbers or land records.
- **Reports.** Digging reports are saved without a name or NID. They are not delivered to the UNO, AC (Land) or River Police.
- **Fee rates need checking.** The portal uses 1.5% stamp duty, 1% registration fee and 2% local government tax. Published guides disagree on these, and a 2026 registration ordinance may have changed them. Confirm the current rates before relying on the calculator. AIT has no default rate.
- **Economic codes.** Only stamp duty (1162101) and document registration fee (1422201) are filled in. Other codes say to confirm with the office.
- **Map positions are approximate.** The River Inspection zone and the Topsoil Scan markers are approximations. Replace them with official survey boundaries.
- **Maps need internet.** They load from outside services. If a map cannot load, the page shows a message.
- **Inheritance output is for reference.** It covers spouse, sons, daughters, mother and father only. Other heirs, such as siblings, are not included. An official Warishan certificate is still required.

## Before real use

- Stronger account security and rate limiting on the database.
- A real OTP service by SMS.
- Proper password handling on the server.
- Connections to the official land records, court data, zoning data and payment services.
- Real satellite and GPS feeds for the Topsoil Scan and River Inspection tabs.

## Third-party services

- [Leaflet](https://leafletjs.com/) for maps, loaded from cdnjs.
- Esri World Imagery tiles for the satellite view, and OpenStreetMap tiles for the street view.
- Google Fonts (Bricolage Grotesque) for the big title.

## AI tools used

Claude (Anthropic) was used to write and revise the code, the database script and this README.
