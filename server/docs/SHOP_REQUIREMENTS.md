# Shop verification requirements

New shops save their details as Pending, then upload private images in the shop
application or Account Credibility. Required documents are DTI **or** SEC business
registration, TIN ID/proof of TIN, and a Mayor’s Permit. One registration alternative
is sufficient. Images support JPG, PNG and WebP, up to 6 MB; PDF uploads are not
implemented. LabaRide review is manual and does not imply government verification.

Owners can upload/replace documents while Pending or Rejected. Uploads re-open
Pending review and reset the replaced document's decision. Admins open Approve Shop
to review requirements, view a private document, then verify it or send a correction
reason (at least five characters). Verified documents no longer offer the Verify
button. Shop approval stays disabled until the required documents are verified.
The API independently enforces the requirement before enabling ownership/discovery.

Correction marks the application Rejected and shows the reason to the owner. They
replace the flagged image, then the admin reviews the new version. Changes to shop
identity/details send the application back to Pending, disable shop mode and reset
document decisions. Each document mutation increments applicationVersion; image
review also checks expectedUpdatedAt. Shop row locks serialize uploads, reviews and
approval, and failed final approvals roll back the entire status change.

Document lists and image bytes require the shop owner or an authenticated admin.
Only the owner can upload; only admins can review. Image responses use private,
no-store caching and nosniff headers. Lists select metadata only; customer shop APIs
never include document bytes. Uploaded images are decoded, oriented, resized and
re-encoded as JPEG with EXIF metadata removed.

Deploy `20261024030000_shop_requirements` and regenerate Prisma. New registrations
force requirementsVersion=1 on the server; clients cannot opt out. Existing Pending
and Rejected applications become version 1. Already-approved/suspended legacy shops
remain version 0, so they are not deactivated and can be restored without invented
document verification. Their Account Credibility explicitly identifies that legacy
status. Editing and resubmitting their identity upgrades them to the new checks.

Endpoints:

- `GET /api/shops/:shopId/documents`: private metadata/readiness/version.
- `PUT /api/shops/:shopId/documents/:type`: owner-only imageBase64 upload.
- `GET /api/shops/:shopId/documents/:type`: owner/admin private JPEG.
- `PUT /api/shops/:shopId/documents/:type/review`: admin status, reason and timestamp.

Checks: server build and unit suite, `node tests/shop-requirements.integration.cjs`
(isolated committed fixture accounts/documents, all deleted in finally), and
`node tests/ui-browser.cjs --shop-requirements` (intercepted upload/review fixtures
at 320/390/1440, SEC alternative, correction, replacement and final approval).
