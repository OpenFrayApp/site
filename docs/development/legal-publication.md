# Legal publication dates

`src/data/legalDates.ts` owns each document’s normalized `YYYY-MM-DD` date.
Terms and Privacy render it in a `<time>` element with a UTC-formatted label.
`/legal-publication.json` publishes both dates and the Pages build’s `CF_PAGES_COMMIT_SHA`.
Local builds use `local` as the revision.

When editing either legal page, update its date in the same change. Dates are
independent and describe the published documents. Changing a date does not
request, authorize, or trigger an email. Ordinary site builds perform no
registration, template upload, or email send.

Terms, Privacy, combined policy updates, and case-by-case security notices are
prepared, reviewed, and sent manually in Resend. Follow the parent’s
[manual notice procedure](https://github.com/OpenFrayApp/openfray/blob/develop/docs/legal-publication.md)
for content and recipient review. No legal baseline or post-deployment
registration setup is required.

Retain existing publication and delivery history for recovery and replay protection.
Source merges, site deployment, and email sending are separate actions.
Production deployment and sending require separate authorization.
