# Optional reunion survey update

Version 3 adds high-school talents/hobbies still enjoyed today, U.S. states visited,
and countries visited. Travel counts are lifetime counts including places lived.
New spreadsheet columns are appended after existing columns to preserve their positions.
If version 2 is already installed, replace index.html and functions/api/create-checkout.js
in GitHub, and update Code.gs in Apps Script and deploy a new version as below.
The client and webhook already forward the new fields; their files are included for
users who have not yet installed the earlier survey updates.

Prepared locally; not yet published to GitHub, Cloudflare, or Google Apps Script.

## 1. Update Apps Script first

Open the existing registration spreadsheet, then Extensions > Apps Script.
Replace Code.gs with the contents of google-sheets/Code.gs from this package. Save.
Do not change Script Properties, the spreadsheet ID, or your shared secrets.
You do not need to run setupRegistrationSheet again.

Choose Deploy > Manage deployments > your existing active deployment > Edit (pencil).
Under Version choose New version, then Deploy. Keep the existing deployment URL,
Execute as Me, and access settings. This preserves the URL configured in Cloudflare.
Official instructions: https://developers.google.com/apps-script/guides/versions

## 2. Update these four files in the existing GitHub repository

- index.html
- script.js
- functions/api/create-checkout.js
- functions/api/stripe-webhook.js

Keep the functions/api folder structure. Do NOT replace the root create-checkout.js;
that is not the function imported by worker.js. No changes to worker.js, wrangler.jsonc,
styles.css, or any Cloudflare variables are needed for this survey update.
Commit these four files together, then let the configured Cloudflare deployment finish.

The ZIP is an update bundle, not a complete standalone website. Do not deploy it as
a replacement for the whole existing site. Keep your other files and assets.

## 3. Check the result

Refresh the site: Where are we now? is fully visible above the refund checkbox.
The fields can be skipped but are not labeled optional. The price is still $45 and Friday details are preserved.
Saturday's main reunion now begins at CDO at 5 PM, with dinner at DiBella's afterward.
The countdown also targets 5 PM. The family picnic remains at noon.
After a paid checkout reaches the webhook successfully, responses appear in a new
Classmate Survey tab in the SAME spreadsheet. That tab is created on the first
survey delivery, not immediately after pasting the script.

The existing Registrations and Summary tabs remain in place. The new tab contains
individual responses, not a finished statistics dashboard. Blank answers are not zero.
Each graduate should respond only once. Repeat webhook deliveries do not create
duplicate rows; separate purchases by the same person still need manual review.
For shared children/grandchildren, count them on only one graduate's response.
Treat totals as reported counts among respondents, not verified unique family members.

Keep the spreadsheet restricted to organizers. Only share written answers when the
permission column says Yes; without permission use anonymous aggregate statistics only.
Old purchases cannot gain survey answers retroactively. Existing spreadsheet-delivery
issues are not proven resolved by this update: verify the webhook and a resulting row
before announcing the survey. Do not buy another live ticket just to test this code.

## Verification

Local mocked checks cover optional answers, zero versus blank, validation, six
graduates, Unicode preservation, Stripe metadata limits, signed webhook processing,
legacy purchases without survey answers, retry deduplication, consent and spreadsheet
formula escaping. No real payments or spreadsheet writes were made during those tests.
Run node survey-test.mjs locally if desired; do not upload test files as public assets.
Stripe limits: https://docs.stripe.com/api/metadata
