# Docker Deployment Guide

This guide covers deploying Ledgerline using Docker for both development and production environments.

## Prerequisites

- Docker 20.10+ and Docker Compose v2
- Git
- (Production) SSL certificates for HTTPS

## Quick start

### Development

```bash
# Clone the repository
git clone https://github.com/FrancKINANI/ai-investment-agent.git
cd ai-investment-agent

# Copy environment file
cp .env.example .env

# Edit .env with your settings
nano .env

# Start development environment
make dev
# Or: docker-compose up
```

This starts:
- MySQL 8.0 with health checks
- App with hot reload
- Nginx reverse proxy

Access at http://localhost:3000

### Production

```bash
# Set production environment variables
export JWT_SECRET=$(openssl rand -hex 32)
export ENCRYPTION_KEY=$(openssl rand -hex 32)

# Start production environment
make prod
# Or: docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Stack                          │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │    Nginx    │───▶│     App     │───▶│    MySQL    │ │
│  │  (reverse   │    │  (Express   │    │   (8.0)     │ │
│  │   proxy)    │    │   + tRPC)   │    │             │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│         │                  │                  │         │
│         ▼                  ▼                  ▼         │
│    SSL/TLS           Health checks      Data persistence│
│    Rate limiting     Metrics endpoint   Backups         │
│    Security headers  Graceful shutdown                   │
└─────────────────────────────────────────────────────────┘
```

## Configuration

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL connection string |
| `JWT_SECRET` | Yes | Session token secret |
| `ENCRYPTION_KEY` | Prod | AES-256-GCM master key (64-char hex) |
| `BINANCE_API_KEY` | No | Binance API key for live trading |
| `BINANCE_API_SECRET` | No | Binance API secret |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (default: development) |

### Generating secrets

```bash
# Generate JWT secret
openssl rand -hex 32

# Generate encryption key
openssl rand -hex 32
```

## Docker Compose services

### MySQL

- **Image:** mysql:8.0
- **Port:** 3306
- **Health check:** mysqladmin ping
- **Volumes:** mysql_data (persistent)

### App

- **Image:** Built from Dockerfile
- **Port:** 3000
- **Health check:** wget /healthz
- **Resources (prod):** 1 CPU, 512MB memory

### Nginx

- **Image:** nginx:alpine
- **Ports:** 80, 443
- **Config:** nginx/nginx.conf

## Makefile commands

```bash
make help           # Show all commands
make dev            # Start development environment
make dev-d          # Start in background
make prod           # Start production environment
make stop           # Stop all containers
make logs           # Show logs
make logs-app       # Show app logs only
make db-push        # Push database schema
make db-reset       # Reset database (WARNING: destroys data)
make test           # Run tests in container
make typecheck      # Run TypeScript checks
make monitor        # Start monitoring stack
make grafana        # Open Grafana dashboard
make prometheus     # Open Prometheus UI
make shell          # Open shell in app container
make status         # Show container status
```

## SSL/TLS setup

### Using Let's Encrypt

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --webroot -w /var/www/certbot -d yourdomain.com

# Copy to nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/

# Restart nginx
docker-compose restart nginx
```

### Using self-signed (development)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

## Database management

### Push schema changes

```bash
make db-push
# Or: docker-compose exec app pnpm db:push
```

### Reset database

```bash
make db-reset
# Or: docker-compose down -v && docker-compose up -d mysql && sleep 10 && docker-compose exec app pnpm db:push
```

### Access MySQL shell

```bash
make db-shell
# Or: docker-compose exec mysql mysql -u ledgerline -pledgeledgerline ledgerline
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs app

# Check health
docker-compose ps

# Restart services
docker-compose restart
```

### Database connection refused

```bash
# Ensure MySQL is healthy
docker-compose ps mysql

# Check MySQL logs
docker-compose logs mysql

# Wait for MySQL to be ready
sleep 10
```

### Permission denied

```bash
# Fix file permissions
sudo chown -R 1001:1001 dist/
sudo chown -R 1001:1001 node_modules/
```

### Out of memory

```bash
# Check resource usage
docker stats

# Increase memory limit in docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 1G
```

## Production checklist

- [ ] Set strong `JWT_SECRET` and `ENCRYPTION_KEY`
- [ ] Configure SSL/TLS certificates
- [ ] Set up database backups
- [ ] Configure monitoring (Prometheus/Grafana)
- [ ] Set up log aggregation
- [ ] Configure rate limiting in nginx
- [ ] Set up CI/CD pipeline
- [ ] Review security headers
- [ ] Test health check endpoint
- [ ] Verify graceful shutdown
