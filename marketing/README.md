# Fortify email campaign

Send the Fortify promo email (`fortify-email.html`) to a list via Resend.
No `npm install` — the script uses Node 18+ native fetch.

## One-time setup (required before sending to real people)

The Resend key is currently **restricted to test mode** — it can only email your
own account address until you verify a domain.

1. Go to https://resend.com/domains → **Add Domain** → `fortify-io.com`.
2. Add the DKIM + SPF DNS records Resend shows you (in your domain's DNS).
3. Wait for it to show **Verified**.
4. Once verified, send from an address on that domain, e.g.
   `Fortify <hello@fortify-io.com>`.

This also gets you into the inbox instead of spam.

## Sending

```powershell
# 1. Set your key (PowerShell)
$env:RESEND_API_KEY="re_xxxxxxxx"

# 2. Make your list — copy the example and edit
#    Columns: email,name   (name optional, used for {{name}} in the HTML)
copy recipients.example.csv recipients.csv

# 3. Dry run first — prints who it WOULD email, sends nothing
node send-campaign.js --to recipients.csv --dry-run

# 4. Real send
node send-campaign.js --to recipients.csv --from "Fortify <hello@fortify-io.com>"
```

### Options

| Flag | Default | Purpose |
|------|---------|---------|
| `--to <file>` | `recipients.csv` | CSV of recipients |
| `--html <file>` | `fortify-email.html` | HTML to send |
| `--from "<addr>"` | env `RESEND_FROM` or `onboarding@resend.dev` | From address |
| `--subject "<txt>"` | built-in | Subject line |
| `--dry-run` | off | Validate + preview, send nothing |
| `--limit <n>` | none | Only send to first n (testing) |

## Personalisation

Put `{{name}}` anywhere in `fortify-email.html` and it's replaced per-recipient
from the CSV `name` column (falls back to "there" if blank).

## Notes

- Throttled to ~2/sec for Resend's rate limit. Big lists take a few minutes.
- `recipients.csv` is gitignored — never commit real contact lists.
- Test-mode key only delivers to your own Resend account email. Verify a domain
  to reach anyone else.
