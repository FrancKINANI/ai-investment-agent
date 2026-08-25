# Monitoring Setup Guide

This guide covers setting up monitoring for Ledgerline with Prometheus, Grafana, and alerting.

## Overview

The monitoring stack provides:

- **Metrics collection:** Prometheus scrapes `/metrics` endpoint
- **Visualization:** Grafana dashboards with 8 panels
- **Alerting:** Alertmanager routes alerts to Slack, email, PagerDuty
- **Infrastructure metrics:** Node, MySQL, Nginx exporters

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Monitoring Stack                        │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  Grafana    │◀───│ Prometheus  │◀───│  App        │ │
│  │ (dashboard) │    │ (scrape)    │    │ (/metrics)  │ │
│  └─────────────┘    └──────┬──────┘    └─────────────┘ │
│                            │                            │
│                            ▼                            │
│                     ┌─────────────┐                     │
│                     │ Alertmanager│                     │
│                     │ (routing)   │                     │
│                     └──────┬──────┘                     │
│                            │                            │
│                   ┌────────┼────────┐                   │
│                   ▼        ▼        ▼                   │
│               Slack    Email    PagerDuty               │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │Node Exporter│    │MySQL Exporter│   │Nginx Exporter│ │
│  │  (host)     │    │  (database) │    │  (proxy)    │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Quick start

```bash
# Start monitoring stack
make monitor

# Or with full stack
docker-compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d
```

Access:
- Grafana: http://localhost:3001 (admin/admin)
- Prometheus: http://localhost:9090
- Alertmanager: http://localhost:9093

## Metrics endpoint

The app exposes `/metrics` in Prometheus format:

```bash
curl http://localhost:3000/metrics
```

### Available metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | counter | Total HTTP requests |
| `http_request_duration_seconds` | histogram | Request latency |
| `http_errors_total` | counter | Total HTTP errors |
| `agent_executions_total` | counter | Total agent executions |
| `agent_execution_failures_total` | counter | Failed agent executions |
| `orders_placed_total` | counter | Total orders placed |
| `security_alerts_total` | counter | Total security alerts |
| `mandate_actions_total` | counter | Total mandate actions |
| `process_uptime_seconds` | gauge | Process uptime |
| `process_resident_memory_bytes` | gauge | Memory usage |

## Grafana dashboard

The pre-configured dashboard includes 8 panels:

1. **Service Status:** Up/Down indicator
2. **Request Rate:** Requests per second
3. **Error Rate:** Errors per second
4. **Response Time (P95):** 95th percentile latency
5. **Agent Executions:** Executions and failures per second
6. **Security Alerts:** Alerts per second
7. **Memory Usage:** Current memory consumption
8. **Uptime:** Process uptime

### Accessing Grafana

```bash
# Open Grafana
make grafana

# Default credentials
Username: admin
Password: admin
```

### Custom dashboards

To create custom dashboards:

1. Login to Grafana
2. Click "+" → "New Dashboard"
3. Add panels with PromQL queries
4. Save dashboard

Example queries:

```promql
# Request rate by endpoint
rate(http_requests_total[5m])

# Error rate percentage
rate(http_errors_total[5m]) / rate(http_requests_total[5m]) * 100

# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Agent execution success rate
1 - (rate(agent_execution_failures_total[5m]) / rate(agent_executions_total[5m]))
```

## Alert rules

### Availability alerts

```yaml
- alert: LedgerlineDown
  expr: up{job="ledgerline"} == 0
  for: 1m
  labels:
    severity: critical
```

### Performance alerts

```yaml
- alert: HighLatency
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
  for: 5m
  labels:
    severity: warning
```

### Security alerts

```yaml
- alert: CriticalSecurityAlerts
  expr: rate(security_alerts_by_level{level="critical"}[5m]) > 0
  for: 1m
  labels:
    severity: critical
```

### Business alerts

```yaml
- alert: HighOrderFailureRate
  expr: rate(agent_execution_failures_total[5m]) / rate(agent_executions_total[5m]) > 0.3
  for: 5m
  labels:
    severity: warning
```

## Alertmanager configuration

### Severity routing

- **Critical:** Immediate notification (Slack, email, PagerDuty)
- **Warning:** Hourly digest
- **Info:** Logged only

### Slack integration

```yaml
receivers:
  - name: 'critical'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK'
        channel: '#alerts-critical'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'
```

### Email integration

```yaml
receivers:
  - name: 'critical'
    email_configs:
      - to: 'alerts@yourdomain.com'
        from: 'alertmanager@yourdomain.com'
        smarthost: 'smtp.yourdomain.com:587'
        subject: '[CRITICAL] {{ .GroupLabels.alertname }}'
```

## Infrastructure metrics

### Node Exporter

Collects host-level metrics:

- CPU usage
- Memory usage
- Disk I/O
- Network traffic

Access: http://localhost:9100/metrics

### MySQL Exporter

Collects database metrics:

- Query throughput
- Connection count
- InnoDB metrics
- Slow queries

Access: http://localhost:9104/metrics

### Nginx Exporter

Collects proxy metrics:

- Request rate
- Response codes
- Connection count

Access: http://localhost:9113/metrics

## Production setup

### 1. Configure alerting

Edit `monitoring/alertmanager.yml`:

```yaml
receivers:
  - name: 'critical'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#ops-alerts'
```

### 2. Set up TLS

For production, configure TLS for Grafana and Prometheus:

```yaml
# In docker-compose.monitoring.yml
grafana:
  environment:
    GF_SERVER_CERT_FILE: /etc/grafana/cert.pem
    GF_SERVER_KEY_FILE: /etc/grafana/key.pem
```

### 3. Configure retention

Prometheus data retention (default 30 days):

```yaml
command:
  - '--storage.tsdb.retention.time=90d'
```

### 4. Set up backups

```bash
# Backup Prometheus data
docker cp prometheus_data:/prometheus ./backups/prometheus-$(date +%Y%m%d)

# Backup Grafana dashboards
docker cp grafana_data:/var/lib/grafana ./backups/grafana-$(date +%Y%m%d)
```

## Troubleshooting

### Prometheus can't scrape metrics

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check app metrics endpoint
curl http://localhost:3000/metrics
```

### Grafana shows "No data"

- Verify Prometheus is running: `docker ps | grep prometheus`
- Check Prometheus config: `curl http://localhost:9090/api/v1/status/config`
- Verify datasource in Grafana: Settings → Data Sources

### Alerts not firing

- Check Alertmanager is running: `docker ps | grep alertmanager`
- Verify alert rules: `curl http://localhost:9090/api/v1/rules`
- Check Alertmanager config: `curl http://localhost:9093/api/v1/status`

### High memory usage

- Check Prometheus TSDB size: `du -sh prometheus_data`
- Reduce retention: `--storage.tsdb.retention.time=15d`
- Increase memory limit in docker-compose

## Best practices

1. **Start simple:** Use default dashboards before creating custom ones
2. **Set meaningful alerts:** Avoid alert fatigue with appropriate thresholds
3. **Monitor what matters:** Focus on business metrics, not just infrastructure
4. **Review regularly:** Update alerts based on actual incidents
5. **Document runbooks:** Add response procedures to alert descriptions
6. **Test alerting:** Verify notifications work before incidents happen
