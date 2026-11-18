# Karam and Roaya database status

Verified on 18 November 2026.

- GitHub repository: `hashemalkhatib8613-afk/karam`, production branch `main`.
- Vercel project: `karam-and-roaya`.
- Production site: https://karam-and-roaya.vercel.app.
- Supabase project: `fqmxjtgpzorbvpvzesjl`.

This repository and its Vercel project are separate from the original Just Us project. Application clients use environment variables; no credentials are committed.

## Applied CMS repairs

The imported database had the content tables but lacked application policies and supporting functions. These five migrations restored content saves, publication visibility, media attachments and carousels, private media bucket policies, note clues, audit logging, and bucket-list saves:

| Version | Migration |
| --- | --- |
| 20261118120702 | restore_cms_content_save_policies |
| 20261118120749 | restore_published_content_visibility |
| 20261118120808 | restore_cms_media_saves |
| 20261118120843 | restore_cms_note_clue_saves |
| 20261118121005 | restore_cms_bucket_list_saves |

Their exact SQL is recorded in [supabase/repairs/applied_cms_repairs.sql](supabase/repairs/applied_cms_repairs.sql). This is an archive of repairs already applied to the new database, not an additional fresh-install migration. Running the original numbered migrations creates these objects on a fresh database; do not run the repair archive afterward.

## Verification

Database tests ran under the existing admin and partner identities, using the `authenticated` role. All changes made by the tests were rolled back.

- Admin create, update, and delete passed for albums, stories, notes, songs, surprises, and bucket-list items.
- Media registration and metadata, album/story attachments and ordering, carousel saves, note clues, settings, usernames, and audit writes passed.
- Partner content writes were denied. Published albums were visible; locked note bodies and draft surprises remained private.
- The private media bucket and application policies exist. A real file upload was not exercised.
- Production deployment from `karam/main` completed successfully. The login page and `/api/health` returned HTTP 200; health reported `ok: true`.

## Remaining work

The separate restoration of account/login functions (`reset_onboarding`, `update_my_profile`, `set_date_login`, `date_login_status`, `verify_date_login`, and `lookup_login_email`) remains pending explicit approval. Those changes were not applied by the CMS content repairs above. Username database updates work, but username authentication depends on the missing lookup function. Secret-date configuration/authentication and profile preference saves still need their corresponding functions.

Environment changes must be made only on the dedicated Vercel project and use this database's credentials. Database repairs do not require an application redeployment.
