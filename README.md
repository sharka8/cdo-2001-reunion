# CDO Class of 2001 Reunion Registration Site

Payment will not work until Stripe variables are added in Cloudflare.

## Recommended Stripe setup
Create a separate Stripe account for the reunion under the same Stripe login. This keeps Vail Velocity transactions, reports, receipts, and refunds separate. Use accurate legal and tax information for the person or entity receiving the money.

## Create the Stripe product
1. In the reunion Stripe account, create a one-time product named `CDO Class of 2001 Reunion Ticket`.
2. Price: `$67.00 USD`.
3. Copy the Price ID beginning with `price_`.
4. Enable successful payment and refund receipts in Stripe customer email settings.
5. Add support email `sharlaruiz@gmail.com` and refund policy: full refund before October 24, 2026.

## Deploy with Cloudflare Pages
Use GitHub integration, because dashboard drag-and-drop does not correctly deploy the `/functions` folder.
1. Create a private GitHub repository.
2. Upload all files, preserving `/functions/api/create-checkout.js`.
3. In Cloudflare: Workers & Pages > Create > Pages > Connect to Git.
4. Framework preset: None.
5. Build command: blank.
6. Build output directory: `/`.
7. Deploy. Cloudflare assigns a free `project-name.pages.dev` address.

## Add Cloudflare variables
Pages project > Settings > Variables and Secrets:
- `STRIPE_SECRET_KEY` (encrypted secret)
- `STRIPE_PRICE_ID` (`price_...`)
Redeploy afterward.

## Test first
Use Stripe test mode with test values and card `4242 4242 4242 4242`. Verify names, guests, Friday RSVPs, and notes in Checkout Session metadata. Then switch both variables to live mode.

## Current limitations
- Up to six tickets per transaction.
- The 200-ticket total is not automatically enforced yet. Monitor paid ticket quantity in Stripe and close registration at 200.
- Registration data is stored in Stripe Checkout Session metadata. A paid-attendee CSV/Google Sheet sync can be added next.
