# Builder Client Portal

A branded portal for custom home builders and their clients. One codebase serves every builder; each builder is a block of settings in `config.js`.

## Files

| File | What it is |
|---|---|
| `index.html` | Page shell |
| `styles.css` | Look and layout (colors and fonts are overridden per builder) |
| `config.js` | **Per-builder settings**: name, colors, fonts, wording, build phases, draw schedule, warranty, office |
| `app.js` | The app |
| `supabase/migrations/001_portal_schema.sql` | Database tables, security rules, storage |
| `supabase/functions/invite/index.ts` | Sends invitations to clients and team members |

## How access works

- **Admin**: the builder's owner. Sees every home, invites team members and clients.
- **Staff**: project managers and design team. Sees every home of their builder, posts updates, asks questions, sends change orders.
- **Client**: the homeowners. Sees only the homes they were invited to. Can answer questions, choose selections, sign change orders, comment, message, add notes, and request visits.

Every table is protected by row-level security, so one builder can never see another builder's data, and a client can never see another client's home. Client actions that change records (answering, choosing, signing) go through database functions that check the rules server-side.

## Setup (one time)

1. Run `supabase/migrations/001_portal_schema.sql` in the Supabase project.
2. Deploy the `invite` edge function.
3. In Supabase **Authentication > Sign In / Providers**, turn off **Allow new users to sign up** (the portal is invitation-only).
4. In **Authentication > URL Configuration**, set the Site URL and add the portal's address to Redirect URLs.
5. Put the project URL and publishable key in `config.js`.
6. Create the builder row and its first admin (see below).
7. Host the folder (GitHub Pages works) and point `portal.<builder>.com` at it.

### Add the builder and its first admin

```sql
insert into builders (slug, name) values ('stoneledge', 'Stoneledge Luxury Homes');
-- after the admin has an account (invite them from Authentication > Users):
update profiles set builder_id = (select id from builders where slug = 'stoneledge'),
  role = 'admin', full_name = 'Full Name', title = 'Title'
where email = 'admin@example.com';
```

From then on, the admin invites everyone else from inside the portal (Your team).

## Adding another builder

1. Copy the `stoneledge` block in `config.js`, rename the key and `slug`, and change the name, colors, fonts, labels, phases, draws, warranty, and office.
2. Add their portal address under `hosts`.
3. Insert their row in `builders` and set up their admin as above.

Preview any builder's branding with `?builder=slug` in the address.
