#!/usr/bin/env tsx
/**
 * MySQL Backup Script
 * 
 * Creates a backup of the MySQL database before migration.
 * 
 * Usage:
 *   DATABASE_URL=mysql://... npx tsx scripts/backup-mysql.ts
 * 
 * Output:
 *   - backups/ directory with SQL dump file
 *   - backups/manifest.json with backup metadata
 */

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// ─── Configuration ──────────────────────────────────────────────────────────

const BACKUP_DIR = join(process.cwd(), "backups");

// ─── Main Backup Function ───────────────────────────────────────────────────

async function backupDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log("🚀 Starting MySQL backup...\n");

  // Create backup directory
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Parse database URL
  const url = new URL(databaseUrl);
  const host = url.hostname;
  const port = url.port || "3306";
  const database = url.pathname.slice(1);
  const username = url.username;
  const password = url.password;

  // Generate backup filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = join(BACKUP_DIR, `backup-${timestamp}.sql`);

  console.log(`📦 Backing up database: ${database}`);
  console.log(`   Host: ${host}:${port}`);
  console.log(`   Output: ${backupFile}\n`);

  try {
    // Create backup using mysqldump
    const command = [
      "mysqldump",
      `--host=${host}`,
      `--port=${port}`,
      `--user=${username}`,
      `--password=${password}`,
      "--single-transaction",
      "--routines",
      "--triggers",
      "--events",
      "--set-gtid-purged=OFF",
      database,
    ].join(" ");

    console.log("⏳ Running mysqldump...");
    execSync(command, {
      stdio: "pipe",
      timeout: 300000, // 5 minutes
    });

    // Write backup file
    const { execSync: exec } = await import("node:child_process");
    const dump = exec(command, { encoding: "utf8", timeout: 300000 });
    writeFileSync(backupFile, dump);

    // Get backup size
    const { statSync } = await import("node:fs");
    const stats = statSync(backupFile);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    // Write manifest
    const manifest = {
      backedUpAt: new Date().toISOString(),
      database,
      host,
      port,
      backupFile,
      sizeBytes: stats.size,
      sizeMB: `${sizeMB} MB`,
    };

    const manifestPath = join(BACKUP_DIR, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log("\n📊 Backup Summary:");
    console.log(`   Database: ${database}`);
    console.log(`   Size: ${sizeMB} MB`);
    console.log(`   File: ${backupFile}`);
    console.log(`   Manifest: ${manifestPath}`);

    console.log("\n✅ Backup complete!");
  } catch (error) {
    console.error("\n❌ Backup failed:", error);
    console.error("\n💡 Alternative: Use mysqldump directly:");
    console.error(`   mysqldump -h ${host} -P ${port} -u ${username} -p ${database} > ${backupFile}`);
    process.exit(1);
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

backupDatabase().catch((error) => {
  console.error("❌ Backup failed:", error);
  process.exit(1);
});
