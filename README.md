# Job Hopping Dashboard

A small, self-hosted dashboard for tracking a job search: the selection pipeline, introductions waiting for a reply, salary ranges against your target, a timeline and to-dos.

Built with **Astro** (SSR) on **Cloudflare Workers** and **D1**, with a JSON **REST API**. The whole site sits behind **Cloudflare Access**, so only the email addresses you list can open it.

The UI is in Chinese (zh-CN).

## Features

- **Pipeline board**: active applications grouped by stage, with status (waiting / good / at risk / my turn). Click a card to edit it.
- **Pending introductions**: sorted by reply deadline; deadlines within 7 days are shown in red.
- **Salary chart**: each position's range compared with your current and minimum target salary.
- **Timeline and to-dos**: stored in D1, so they stay in sync across devices.
- **REST API**: every change you can make in the page can also be made through the API.
- **Light and dark** themes.

## API

All endpoints are JSON and protected by Cloudflare Access. Requests that change data must be same-origin and send `Content-Type: application/json`.

| Method | Path | |
|---|---|---|
| GET | `/api/dashboard` | everything (settings, applications, events, todos) |
| GET / PUT | `/api/settings` | salary targets, stages, etc. (PUT merges keys) |
| GET / POST | `/api/applications[?list=active\|pending\|closed]` | |
| GET / PATCH / DELETE | `/api/applications/:id` | |
| GET / POST | `/api/events[?limit=200]` | |
| PATCH / DELETE | `/api/events/:id` | |
| GET / POST | `/api/todos` | |
| PATCH / DELETE | `/api/todos/:id` | |

See `src/lib/schema.ts` for the fields and validation rules, and `migrations/` for the database schema.

## Security model

1. **Cloudflare Access** (created by Terraform) blocks unauthenticated traffic at the edge. Only the emails in `allowed_emails` can sign in, using an email one-time PIN.
2. The Worker **verifies the Access JWT** (`Cf-Access-Jwt-Assertion`) on every request, checking the issuer and the audience. It fails closed if Access isn't configured.
3. The `workers.dev` and preview URLs are disabled; the site is reachable only through the custom domain.
4. CSRF protection: an origin check plus a required JSON content type on changing requests.
5. Your personal data and account details never go into git: `wrangler.jsonc`, `infra/terraform.tfvars`, the Terraform state and your data files are all git-ignored.

## Local development

```bash
npm install
cp wrangler.example.jsonc wrangler.jsonc   # placeholder values are fine locally
cp .dev.vars.example .dev.vars             # AUTH_MODE=dev skips Access locally
npm run db:migrate:local
npm run db:seed:sample                     # load data/sample.json
npm run dev                                # http://localhost:4321
```

## Deploy your own

Requirements:

- a Cloudflare account with a domain (zone) on it
- Zero Trust enabled; the free plan is fine
- Terraform and Node.js 22.18 or later

1. **Create an API token** (My Profile → API Tokens → Custom token) with these permissions:
   - Account: *Access: Apps and Policies* Edit, *Workers Scripts* Edit, *D1* Edit
   - Zone (your domain): *Zone* Read, *Workers Routes* Edit, *DNS* Edit

   Store the token in the macOS Keychain:
   `security add-generic-password -a "$USER" -s cloudflare-job-hopping -w`
   Alternatively, export it as `CLOUDFLARE_API_TOKEN`.
2. Run `cp infra/terraform.tfvars.example infra/terraform.tfvars`, then fill in your account ID, hostname, allowed emails and Zero Trust team domain.
3. Run `./scripts/deploy.sh`. It does the following, in order:
   1. Applies Terraform, which creates the Access app and the D1 database. Access is created first, so the hostname is never exposed unprotected.
   2. Generates `wrangler.jsonc`.
   3. Builds the site.
   4. Runs the D1 migrations.
   5. Deploys the Worker.
   6. Checks that an unauthenticated request is redirected to the Access login.
4. **Load initial data (optional):**
   `node scripts/seed.mjs path/to/your-data.json --remote`
   The file uses the same format as `data/sample.json`. The script refuses to overwrite a database that isn't empty unless you pass `--force`.
5. **Back up:** `npm run db:backup`.

## License

MIT
