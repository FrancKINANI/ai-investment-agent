import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { handleMetricsRequest, createMetricsMiddleware } from "./metrics";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ─── Metrics Middleware ─────────────────────────────────────────────────
  app.use(createMetricsMiddleware());

  // ─── Health Check Endpoint ─────────────────────────────────────────────
  app.get("/healthz", (_req, res) => {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "0.0.0",
    };
    res.json(health);
  });

  // ─── Metrics Endpoint ──────────────────────────────────────────────────
  app.get("/metrics", (req, res) => {
    handleMetricsRequest(req, res);
  });

  // ─── Security Headers ──────────────────────────────────────────────────
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Health check: http://localhost:${port}/healthz`);
    console.log(`Metrics: http://localhost:${port}/metrics`);
  });
}

startServer().catch(console.error);
