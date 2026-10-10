# Fortify email campaign

Send the Fortify promo email (`fortify-showcase.html`) to a list via Resend.
No `npm install` — the script uses Node 18+ native fetch.

`fortify-io.com` is verified in Resend (DKIM, SPF and DMARC), so send from an
address on that domain, e.g. `Fortify <hello@fortify-io.com>`.

`fortify-showcase.html` matches the site's monochrome design. The older
`fortify-marketing.html` and `fortify-email.html` use an off-brand cyan/purple
palette — only send them deliberately, with `--html`.

## Sending

```powershell
# 1. Set your key (PowerShell)
$env:RESEND_API_KEY="re_xxxxxxxx"

# 2. Make your list — copy the example and edit
#    Columns: email,name   (name optional, used for {{name}} in the HTML)
copy recipients.example.csv recipients.csv

# 3. Dry run first — prints who it WOULD email, sends nothing
node send-campaign.js --to recipients.csv --dry-run

# 4. Real send — needs an inbox you actually read for opt-outs
node send-campaign.js --to recipients.csv --from "Fortify <hello@fortify-io.com>" --unsubscribe you@example.com
```

### Options

| Flag | Default | Purpose |
|------|---------|---------|
| `--to <file>` | `recipients.csv` | CSV of recipients |
| `--html <file>` | `fortify-showcase.html` | HTML to send |
| `--from "<addr>"` | env `RESEND_FROM` or `onboarding@resend.dev` | From address |
| `--unsubscribe <email>` | env `UNSUBSCRIBE_EMAIL` | Opt-out inbox. **Required for a live send** |
| `--subject "<txt>"` | built-in | Subject line |
| `--dry-run` | off | Validate + preview, send nothing |
| `--limit <n>` | none | Only send to first n (testing) |

## Personalisation

The script fills these placeholders per recipient:

- `{{name}}` — from the CSV `name` column (falls back to "there" if blank).
- `{{unsubscribe_url}}` — a `mailto:` link to the `--unsubscribe` inbox. The same
  address goes in the `List-Unsubscribe` header, so mail clients show their own
  unsubscribe button.
- `{{tracking_pixel}}` — removed; this sender does no open tracking.

## Notes

- Throttled to ~2/sec for Resend's rate limit. Big lists take a few minutes.
- `recipients.csv` is gitignored — never commit real contact lists.
- Inbound mail for `@fortify-io.com` is received by Resend, not a normal mailbox,
  so point `--unsubscribe` at an inbox you check (and honour opt-outs by hand).
