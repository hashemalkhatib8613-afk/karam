# Setting up "Just Us." (free hosting)

This takes about 30 minutes and costs nothing. You will use three free services:

- **Supabase** — the database, sign-in and private photo storage.
- **GitHub** — keeps your code (and runs a small "stay awake" job).
- **Vercel** — puts the website on the internet.

You do not need to install anything on your computer for this guide, except to unzip the project.

> **Be honest with yourself about one thing:** the code was written and checked carefully, but it has not yet been run end to end by a real build. Expect that the first deploy may show one or two small errors. Step 9 explains what to do, and Vercel's build log will name the exact file and line.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com>, sign up (the free plan is enough) and click **New project**.
2. Pick a name (e.g. `just-us`), a strong database password (save it somewhere safe) and the region closest to you.
3. Wait for the project to finish creating (about 2 minutes).

## 2. Create the database

1. In Supabase, open **SQL Editor → New query**.
2. Open `supabase/migrations/0001_init.sql` from this project, copy **everything** and paste it into the editor.
3. Click **Run**. You should see "Success. No rows returned".
4. Run the remaining files in `supabase/migrations/` in numeric order, one at a time. These add usernames, secret-date sign-in, the CMS login method selector, photo carousels, and the shared display name.

If an existing site's settings fail with a missing `login_method` or `shared_display_name` column, run `supabase/migrations/0007_complete_site_settings.sql` in the SQL Editor. It safely adds either missing column, updates the public login view, and reloads the API schema without overwriting saved settings. It can also be run after all the earlier migrations. All controls on Site settings, including Extras, are saved together with **Save settings**.

For random nicknames when falling icons pop, run `supabase/migrations/0008_pop_nicknames.sql` in the SQL Editor. Then open **Site settings → Look and feel → Nicknames when icons pop** and enter one name per line. These names are visible before sign-in as well.

To control whether floating icons appear behind or in front of the site content, and to choose their quantity, run `supabase/migrations/0009_floating_icon_controls.sql`. The controls then appear under **Site settings → Look and feel**.

This creates every table, the security rules (so only signed-in people can read anything, and only you can change anything), the private `media` storage bucket, and the settings row.

## 3. Lock the doors

Open **Authentication → Sign In / Providers** (the label varies slightly by version):

- Turn **off** "Allow new users to sign up". This is what keeps the site private: only people you invite can have an account.
- Leave **Email** enabled.
- Under **Confirm email**, either setting works because you create the accounts yourself.

## 4. Create your admin account

1. Open **Authentication → Users → Add user → Create new user**.
2. Enter your email and a strong password, and tick **Auto Confirm User**.

**The first account ever created automatically becomes the admin**, so do this before inviting her.

## 5. Put the code on GitHub

1. Create a free account at <https://github.com> and click **New repository**. Choose **Private**.
2. Unzip this project and upload all of its files into the repository (**Add file → Upload files**; drag the folder contents in, including the hidden `.github` folder if your system shows it). Commit.

## 6. Deploy on Vercel

1. Sign up at <https://vercel.com> with your GitHub account (the free Hobby plan is for personal, non-commercial use, which is exactly this).
2. Click **Add New → Project**, choose your repository and leave the framework as **Next.js**.
3. Before clicking Deploy, open **Environment Variables** and add these four. The first three values are in Supabase under **Project Settings → API** (or **API Keys**):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon` / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` / secret key. **Keep it secret.** |
| `NEXT_PUBLIC_SITE_URL` | your site address, e.g. `https://just-us.vercel.app` (you can change it after the first deploy) |

4. Click **Deploy**. When it finishes, Vercel shows your address. If it differs from what you typed for `NEXT_PUBLIC_SITE_URL`, update that variable (**Settings → Environment Variables**) and redeploy.

## 7. Tell Supabase where the site lives

In Supabase open **Authentication → URL Configuration**:

- **Site URL:** your Vercel address (no trailing slash).
- **Redirect URLs:** add `https://YOUR-SITE.vercel.app/**`.

Then open **Authentication → Email Templates** and replace the two links so the emails land on your site:

**Invite user** — change the link to:

```html
<h2>You've been invited</h2>
<p>Someone special made a private place for you.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/set-password">Choose your password</a></p>
```

**Reset password** — change the link to:

```html
<h2>Reset your password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/set-password">Choose a new password</a></p>
```

Supabase's built-in email sender is limited (a few emails per hour). That is plenty for one invitation and the occasional reset.

## 8. First sign-in and filling the site

1. Open your site and sign in with the admin account from step 4. You land on the site; open `/admin` (the **More** tab also has an **Open the CMS** button).
2. **Site settings → Words on the site:** choose **Display name for everyone** (defaults to `session`). Everyone sees this name in the home and welcome greetings. Use `[HER_NAME]` in site text and letters to insert the same shared name. Set the greeting, welcome letter, the date it began, time zone and theme here too.
3. **Media Library:** upload photos. They are resized in your browser first (2400 px, plus a small preview) so the free 1 GB lasts for thousands of photos.
4. Create albums, story chapters, songs and notes. Everything starts as a **Draft** and she sees nothing until you publish it.
5. **Accounts:** give each person a username if you want username sign-in, and (optionally) set the secret date that can open her account. Then **Invite her**: enter her name and email. She gets an email, chooses a password and then sees the envelope and welcome letter.

**Active sign-in method:** choose email + password, username + password, or Our date in **Site settings → Sign-in**. Only the selected method appears and is accepted on the partner login page. Configure her username or save and enable the secret date in Accounts before selecting it. The date opens her account only and locks temporarily after repeated wrong guesses. Admins can always use their email and password at `/login/admin` to access the CMS and change the active method.

Nothing is public: every page requires sign-in, search engines are told to stay away, and photos are only reachable through links that expire after an hour.

## 9. If the first deploy fails

Open the failed deployment in Vercel and read the red lines at the bottom of the build log. They name a file and a line. Copy that text to whoever helps you with the code (or back to Claude) and it is normally a one-line fix. The code builds with type errors ignored on purpose so a small typing mistake cannot block you.

If the site loads but sign-in says "don't match", check that the three Supabase variables in Vercel have no extra spaces and that you redeployed after changing them.

## 10. Keep the free database awake

Free Supabase projects pause after about a week of no activity. The file `.github/workflows/keepalive.yml` pings your site every 3 days to prevent that.

1. In GitHub open **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `SITE_URL`, value: your Vercel address.
3. Open the **Actions** tab, choose **keep-alive** and click **Run workflow** once to confirm it turns green.

If the project ever does pause, open it in Supabase and click **Restore**. Nothing is lost.

## Optional: your own domain

Buy a domain anywhere, then in Vercel open **Settings → Domains** and follow the steps. Afterwards update `NEXT_PUBLIC_SITE_URL`, the Supabase Site URL and the Redirect URLs, and the GitHub `SITE_URL` secret to the new address.

## Backups

On the free plan, Supabase does not keep downloadable daily backups. Once in a while: **Table Editor → export** your tables, and download your photos from the Media Library. Keep the original photos on your own devices too.

## What is included, and what comes later

Included now: secure login with an invite-only partner account, the envelope intro and welcome letter, Home with the days-together counter, Our Story timeline, Gallery with albums and a viewer, Music, Letterbox with locked, scheduled and question-protected notes, timed Surprises, themes, reduced-motion support, and an admin panel for all of it with an activity log.

The database already has tables for calls, favorites, page-builder sections and revisions. Their screens are not built yet and are the natural next stage.
