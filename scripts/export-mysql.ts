#!/usr/bin/env tsx
/**
 * MySQL Data Export Script
 * 
 * Exports all data from MySQL database to JSON files for PostgreSQL migration.
 * 
 * Usage:
 *   DATABASE_URL=mysql://... npx tsx scripts/export-mysql.ts
 * 
 * Output:
 *   - exports/ directory with JSON files for each table
 *   - exports/manifest.json with metadata and row counts
 */

import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import { createPool } from "mysql2";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../drizzle/schema";

// ─── Configuration ──────────────────────────────────────────────────────────

const EXPORT_DIR = join(process.cwd(), "exports");

// Tables to export (in order for foreign key dependencies)
const TABLES = [
  { name: "users", schema: schema.users },
  { name: "agentProfiles", schema: schema.agentProfiles },
  { name: "agentNodes", schema: schema.agentNodes },
  { name: "agentConversations", schema: schema.agentConversations },
  { name: "agentIndividualConversations", schema: schema.agentIndividualConversations },
  { name: "agentMessages", schema: schema.agentMessages },
  { name: "agentMemoryEntries", schema: schema.agentMemoryEntries },
  { name: "agentMemoryActions", schema: schema.agentMemoryActions },
  { name: "agentEvolutionEvents", schema: schema.agentEvolutionEvents },
  { name: "agentRuns", schema: schema.agentRuns },
  { name: "awarenessRecords", schema: schema.awarenessRecords },
  { name: "strategyLineages", schema: schema.strategyLineages },
  { name: "strategyEvaluations", schema: schema.strategyEvaluations },
  { name: "outcomeRecords", schema: schema.outcomeRecords },
  { name: "investmentPolicies", schema: schema.investmentPolicies },
  { name: "walletMandates", schema: schema.walletMandates },
  { name: "venueConnections", schema: schema.venueConnections },
  { name: "agentProposals", schema: schema.agentProposals },
  { name: "executionLedger", schema: schema.executionLedger },
  { name: "paperOrders", schema: schema.paperOrders },
  { name: "liveOrderIntents", schema: schema.liveOrderIntents },
  { name: "liveDailyRiskBuckets", schema: schema.liveDailyRiskBuckets },
  { name: "liveOrderApprovals", schema: schema.liveOrderApprovals },
  { name: "operatorActions", schema: schema.operatorActions },
  { name: "bindingChangeRequests", schema: schema.bindingChangeRequests },
  { name: "securityAlerts", schema: schema.securityAlerts },
  { name: "platformApiKeys", schema: schema.platformApiKeys },
  { name: "authorityControls", schema: schema.authorityControls },
  { name: "watchlists", schema: schema.watchlists },
  { name: "watchlistItems", schema: schema.watchlistItems },
  { name: "discoverySchedules", schema: schema.discoverySchedules },
  { name: "discoveryFindings", schema: schema.discoveryFindings },
];

// ─── Main Export Function ───────────────────────────────────────────────────

async function exportData() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log("🚀 Starting MySQL data export...\n");

  // Create export directory
  if (!existsSync(EXPORT_DIR)) {
    mkdirSync(EXPORT_DIR, { recursive: true });
  }

  // Connect to MySQL
  const pool = createPool(databaseUrl);
  const db = drizzle(pool);

  const manifest: {
    exportedAt: string;
    sourceDatabase: string;
    tables: Record<string, number>;
    totalRows: number;
  } = {
    exportedAt: new Date().toISOString(),
    sourceDatabase: "mysql",
    tables: {},
    totalRows: 0,
  };

  // Export each table
  for (const table of TABLES) {
    try {
      console.log(`📤 Exporting ${table.name}...`);
      
      // Get all rows (no filtering - export everything)
      const rows = await db.select().from(table.schema);
      
      // Write to JSON file
      const filename = join(EXPORT_DIR, `${table.name}.json`);
      writeFileSync(filename, JSON.stringify(rows, null, 2));
      
      manifest.tables[table.name] = rows.length;
      manifest.totalRows += rows.length;
      
      console.log(`   ✅ ${rows.length} rows exported`);
    } catch (error) {
      console.error(`   ❌ Error exporting ${table.name}:`, error);
      // Continue with other tables
    }
  }

  // Write manifest
  const manifestPath = join(EXPORT_DIR, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log("\n📊 Export Summary:");
  console.log(`   Total tables: ${TABLES.length}`);
  console.log(`   Total rows: ${manifest.totalRows}`);
  console.log(`   Output: ${EXPORT_DIR}`);
  console.log(`   Manifest: ${manifestPath}`);

  // Close connection
  pool.end();

  console.log("\n✅ Export complete!");
}

// ─── Run ────────────────────────────────────────────────────────────────────

exportData().catch((error) => {
  console.error("❌ Export failed:", error);
  process.exit(1);
});
