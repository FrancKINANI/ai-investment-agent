# Environment Configuration

Ledgerline requires its deployment environment to supply configuration. Do not commit environment files, populated examples, database URLs, OAuth secrets, or provider keys.

| Variable | Purpose | Public? |
| --- | --- | --- |
| `DATABASE_URL` | Server-side database connection. | No. |
| `JWT_SECRET` | Session-signing secret. | No. |
| `OAUTH_SERVER_URL` | Server-side OAuth service base URL. | No. |
| `VITE_OAUTH_PORTAL_URL` | Public OAuth portal endpoint used by the browser. | Yes, if intentionally exposed by the OAuth provider. |
| `VITE_APP_ID` | Public application identifier. | Yes, if issued as a public client identifier. |
| `VITE_ANALYTICS_ENDPOINT` | Optional public analytics endpoint. | Yes, if analytics is enabled. |
| `VITE_ANALYTICS_WEBSITE_ID` | Optional public analytics site identifier. | Yes, if analytics is enabled. |

Secrets must be injected through the deployment platform’s protected configuration store. Browser-prefixed values are public by design and must never contain credentials. Keep analytics variables unset to disable analytics.
