# Operator Guide

Ledgerline is designed for deliberate operator control. Its workflows are evidence-led, owner-scoped, and audit-logged.

## Command

Create a bounded watchlist, set the evidence standard, and inspect a public Ethereum contract through the Evidence Lab. Watchlist and evidence outputs may create a paper proposal, but neither action connects an account or executes an order. The proposal queue exposes explicit owner approval, rejection, and simulated settlement states.

## Chat

Use the dedicated supervisor conversation for a concrete research brief. The Bull and Bear views make disagreement legible; the Fund Manager review records a bounded synthesis. Confidence labels describe note completeness, not expected return or a forecast.

## Wallets and Connections

The Wallets page supports wallet connection through WalletConnect v2 and injected providers. Connected address, network, and provider info are displayed. Disconnect is immediate and logged.

**Mode management:** Simulation (default) → Paper → Live. Each step requires owner approval and is logged. Live mode requires explicit confirmation and is reversible.

**Sailor mandates:** Create on-chain mandates that define what the agent can do. Each mandate has scopes (swap, liquidity, stake, claim, transfer), per-transaction and daily value caps, and optional token/protocol allowlists. Owner signs the mandate with their wallet. Revocation is immediate.

## Platforms and Live Trading

The Platforms page manages exchange API keys and provides live trading capabilities.

**Adding a key:** Enter the API key and secret. The secret is encrypted with AES-256-GCM and never shown after initial entry. Select permissions (trading-only recommended).

**Live balances:** When a Binance key is active, the Live Trading section shows real-time account balances and 24h ticker data.

**Placing orders:** Use the order form to place MARKET or LIMIT orders (BUY/SELL). A confirmation dialog appears before every order. Orders are validated against your mandate limits before submission.

**Per-platform limits:** Set max order size (USD), allocated capital (USD), and daily trade limit per key. These limits are enforced server-side.

## Agent Execution

Agents can execute through two paths:

### CEX execution (Binance)
1. Agent proposes a trade based on research
2. Live adapter validates against active mandate limits
3. Order submitted via Binance API
4. Result logged to Activity record with alert

### On-chain execution (Sailor)
1. Agent proposes a swap/stake/liquidity action
2. Live adapter validates against Sailor mandate scope and caps
3. Transaction sent via WalletConnect for owner signature
4. Owner signs in wallet → transaction broadcast
5. Result logged to Activity record with alert

Both paths require an active mandate and enforce value caps. All attempts are logged.

## Security Alerts

The Security Alerts page surfaces critical, warning, and info-level events.

**Alert levels:**
- **Critical:** Transaction failures, mandate revocation, permission violations, limit breaches, withdrawal permissions.
- **Warning:** Unusual activity, broad permissions, connection issues.
- **Info:** Mode changes, mandates created/activated, wallets connected, keys added.

**Acknowledging alerts:** Click "Acknowledge" to mark as resolved. All alerts are structured, timestamped, and linked to the Decision Journal.

## KMS — Secret Encryption

All API secrets are encrypted at rest with AES-256-GCM. Set `ENCRYPTION_KEY` in your environment to a 64-character hex string or strong passphrase. Without it, a development fallback key is used with a console warning.

## Docker Deployment

### Development

```bash
# Start development environment
make dev

# Or: docker-compose up
```

### Production

```bash
# Set secrets
export JWT_SECRET=$(openssl rand -hex 32)
export ENCRYPTION_KEY=$(openssl rand -hex 32)

# Start production
make prod
```

### Common commands

```bash
make help           # Show all commands
make stop           # Stop all containers
make logs           # Show logs
make db-push        # Push schema changes
make test           # Run tests in container
make shell          # Open shell in app container
```

See [Docker Deployment Guide](docker-deployment.md) for details.

## Monitoring

### Start monitoring stack

```bash
make monitor
```

### Access dashboards

- **Grafana:** http://localhost:3001 (admin/admin)
- **Prometheus:** http://localhost:9090
- **Alertmanager:** http://localhost:9093

### Key metrics

- Request rate and latency
- Error rate
- Agent execution success rate
- Security alerts
- Memory usage

### Alerts

Alertmanager routes alerts based on severity:
- **Critical:** Immediate notification (Slack, email, PagerDuty)
- **Warning:** Hourly digest
- **Info:** Logged only

See [Monitoring Setup Guide](monitoring-setup.md) for configuration.

## Nginx Reverse Proxy

The nginx configuration provides:

- **SSL termination:** TLS 1.2/1.3 with HSTS
- **Rate limiting:** 10r/s API, 5r/s auth
- **Security headers:** CSP, X-Frame-Options, X-XSS-Protection
- **WebSocket support:** For real-time updates
- **Custom error pages:** 429, 502, 503

### SSL setup

```bash
# Using Let's Encrypt
sudo certbot certonly --webroot -w /var/www/certbot -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/

# Restart nginx
docker-compose restart nginx
```

## CI/CD Pipeline

The GitHub Actions pipeline automates:

1. **Quality gate:** Type check + tests + build
2. **Security scan:** Trivy vulnerability scanner
3. **Docker build:** Multi-stage build, push to ghcr.io
4. **Deploy:** Staging → Production with health checks

### Required secrets

Configure in GitHub Settings → Secrets:
- `STAGING_HOST`, `STAGING_USER`, `STAGING_SSH_KEY`
- `PRODUCTION_HOST`, `PRODUCTION_USER`, `PRODUCTION_SSH_KEY`

See [CI/CD Pipeline Guide](cicd-pipeline.md) for details.

## Settings and Activity

Settings exposes protected model routes, optional specialists, inactive schedules, and local owner preferences. Activity is the immutable review surface — "Mark all as read" only changes your browser's local marker.

## Interpreting loading states

Skeletons indicate a request is pending. Empty states indicate no record was returned. Errors are separate from both. This distinction prevents mistaking delayed data for a safe policy or completed execution.

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs app

# Check health
docker-compose ps
```

### Database connection refused

```bash
# Ensure MySQL is healthy
docker-compose ps mysql

# Wait for MySQL
sleep 10
```

### Tests fail

```bash
# Run tests locally
pnpm test

# Check for environment issues
DATABASE_URL=mysql://... pnpm test
```

### Monitoring not working

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check app metrics
curl http://localhost:3000/metrics
```
