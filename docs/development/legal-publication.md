# Legal publication dates

`src/data/legalDates.ts` owns each document’s normalized `YYYY-MM-DD` date.
Terms and Privacy render it in a `<time>` element with a UTC-formatted label.
`/legal-publication.json` publishes both dates and the Pages build’s `CF_PAGES_COMMIT_SHA`.
Local builds use `local` and cannot qualify as production publications.

The console stores publication history and snapshots eligible account IDs.
The admin worker sends individually through reviewed hosted templates.
The parent deployment repo verifies successful publication before invoking registration.
Ordinary site builds perform no registration, template upload, or email send.

Coordinate these legal-copy changes with console issue #111 and the parent’s
[activation procedure](https://github.com/OpenFrayApp/openfray/blob/main/docs/legal-publication.md).
The first deployment establishes an explicitly approved baseline without historical mail.
Existing accounts receive no notice for that initial baseline. Later changed dates trigger notices.
Enable later production releases only after that baseline and staging verification succeed.
Production delivery requires separate authorization.

Dates are independent. Simultaneous changed dates produce one combined notice.
Content-only edits with unchanged dates, repeated deployments, and rollback to recorded dates
produce no new notices. A second edit with the same displayed date cannot send another notice.
Do not change the date merely to retry failed delivery.
