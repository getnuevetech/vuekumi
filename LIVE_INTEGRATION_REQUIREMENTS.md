# VUEKUMI Live Integration Requirements

To move from the local provider-ready adapters to live production integrations, provide these items.

## Payment

- Global subscription charging provider: Stripe, Paystack, Flutterwave, or another chosen provider.
- Sandbox and live API key references for each provider.
- Webhook signing secret for successful payment, failed payment, refund, dispute, subscription renewal, and cancellation events.
- Merchant/account IDs, enabled currencies, settlement countries, tax/VAT rules, and callback URLs.
- Per-country contributor payout provider for each African country VUEKUMI supports.
- Payout API key reference, bank/mobile-money requirements, payout approval rules, minimum payout amount, and payout cadence.

## SMS OTP

- SMS provider per country, API key reference, sender ID, sender approval status, and supported countries.
- OTP message template, OTP expiry time, resend limit, and rate limit rules.
- Delivery status webhook URL and provider callback secret where supported.

## Contributor Verification

- KYC/ID verification provider and API credentials.
- Accepted ID types by country, including DL, International Passport, and high-rated government ID rules.
- Face/liveness provider credentials, face match threshold, retry policy, and manual review fallback.
- Model release and copyright approval document templates.

## Image Processing

- AI image enhancement provider/model credentials.
- Minimum quality threshold, enhancement policy, watermark rules, and manual review policy.
- Image moderation provider if nudity, violence, trademark, or sensitive-content checks are required.

## Storage And Delivery

- Object storage bucket, access key reference, upload limits, allowed file types, and retention policy.
- CDN hostname, signed URL policy, thumbnail sizes, preview watermark settings, and download authorization rules.

## Platform Operations

- Production domain, SSL, transactional email provider, admin email addresses, privacy policy, terms, contributor agreement, copyright agreement, payout agreement, and refund policy.
- Initial admin accounts and final list of test phone numbers for Admin, contributor categories, Regular Individual, Agency, and Corporate users.

## Current Local Test Cadres

- Admin: `+10000000001`, OTP `246810`
- Contributor Photo Content: `+2348000000101`, OTP `246810`
- Contributor Models: `+2348000000102`, OTP `246810`
- Contributor Photographers: `+254700000103`, OTP `246810`
- Regular Individual: `+12025550101`, OTP `246810`
- Agency: `+12025550102`, OTP `246810`
- Corporate: `+12025550103`, OTP `246810`
