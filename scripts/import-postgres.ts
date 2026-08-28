#!/usr/bin/env tsx
/**
 * PostgreSQL Data Import Script
 * 
 * Imports data from JSON files (exported from MySQL) into PostgreSQL.
 * 
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/import-postgres.ts
 * 
 * Prerequisites:
 *   - PostgreSQL database with schema created
 *   - exports/ directory with JSON files from export-mysql.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../drizzle/schema.postgres";

// ─── Configuration ──────────────────────────────────────────────────────────

const EXPORT_DIR = join(process.cwd(), "exports");

// Tables to import (in order for foreign key dependencies)
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

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Convert MySQL date format to PostgreSQL-compatible format
 */
function convertDate(date: string | Date | null): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  return new Date(date);
}

/**
 * Convert MySQL JSON string to PostgreSQL JSONB
 */
function convertJson(value: any): any {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Transform row data for PostgreSQL compatibility
 */
function transformRow(row: any, tableName: string): any {
  const transformed: any = {};
  
  for (const [key, value] of Object.entries(row)) {
    // Convert timestamps
    if (key.endsWith("At") || key.endsWith("at") || key === "createdAt" || key === "updatedAt") {
      transformed[key] = convertDate(value as string);
    }
    // Convert JSON fields
    else if (
      key === "evidence" || 
      key === "payload" || 
      key === "toolScopes" || 
      key === "allowedAssets" ||
      key === "capabilities" ||
      key === "permissions" ||
      key === "scores" ||
      key === "attribution" ||
      key === "action" ||
      key === "criteria"
    ) {
      transformed[key] = convertJson(value);
    }
    // Default: pass through
    else {
      transformed[key] = value;
    }
  }
  
  return transformed;
}

// ─── Main Import Function ───────────────────────────────────────────────────

async function importData() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  if (!existsSync(EXPORT_DIR)) {
    console.error(`❌ Export directory not found: ${EXPORT_DIR}`);
    console.error("   Run export-mysql.ts first to create exports");
    process.exit(1);
  }

  console.log("🚀 Starting PostgreSQL data import...\n");

  // Connect to PostgreSQL
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
  });
  const db = drizzle(pool);

  // Read manifest
  const manifestPath = join(EXPORT_DIR, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error("❌ Manifest file not found");
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  console.log(`📋 Manifest: ${manifest.totalRows} total rows\n`);

  const importStats: {
    importedAt: string;
    tables: Record<string, { imported: number; errors: number }>;
    totalImported: number;
    totalErrors: number;
  } = {
    importedAt: new Date().toISOString(),
    tables: {},
    totalImported: 0,
    totalErrors: 0,
  };

  // Import each table
  for (const table of TABLES) {
    const filename = join(EXPORT_DIR, `${table.name}.json`);
    
    if (!existsSync(filename)) {
      console.log(`⏭️  Skipping ${table.name} (no export file)`);
      continue;
    }

    try {
      console.log(`📥 Importing ${table.name}...`);
      
      // Read JSON file
      const data = JSON.parse(readFileSync(filename, "utf8"));
      
      if (data.length === 0) {
        console.log(`   ⏭️  No rows to import`);
        importStats.tables[table.name] = { imported: 0, errors: 0 };
        continue;
      }

      // Transform and insert rows in batches
      const batchSize = 100;
      let imported = 0;
      let errors = 0;

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        for (const row of batch) {
          try {
            const transformed = transformRow(row, table.name);
            
            // Use ON CONFLICT DO UPDATE to handle duplicates
            await db.insert(table.schema).values(transformed).onConflictDoNothing();
            
            imported++;
          } catch (error) {
            console.error(`   ⚠️  Error importing row:`, error);
            errors++;
          }
        }
      }
      
      importStats.tables[table.name] = { imported, errors };
      importStats.totalImported += imported;
      importStats.totalErrors += errors;
      
      console.log(`   ✅ ${imported} rows imported (${errors} errors)`);
    } catch (error) {
      console.error(`   ❌ Error importing ${table.name}:`, error);
      importStats.tables[table.name] = { imported: 0, errors: 1 };
      importStats.totalErrors++;
    }
  }

  // Write import stats
  const statsPath = join(EXPORT_DIR, "import-stats.json");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(statsPath, JSON.stringify(importStats, null, 2));

  console.log("\n📊 Import Summary:");
  console.log(`   Total imported: ${importStats.totalImported}`);
  console.log(`   Total errors: ${importStats.totalErrors}`);
  console.log(`   Stats: ${statsPath}`);

  // Close connection
  await pool.end();

  console.log("\n✅ Import complete!");
}

// ─── Run ────────────────────────────────────────────────────────────────────

importData().catch((error) => {
  console.error("❌ Import failed:", error);
  process.exit(1);
});
