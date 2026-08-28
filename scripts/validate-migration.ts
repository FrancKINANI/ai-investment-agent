#!/usr/bin/env tsx
/**
 * Migration Validation Script
 * 
 * Validates data integrity after migrating from MySQL to PostgreSQL.
 * Compares row counts, checks owner scoping, and verifies data types.
 * 
 * Usage:
 *   MYSQL_URL=mysql://... POSTGRES_URL=postgresql://... npx tsx scripts/validate-migration.ts
 */

import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { createPool } from "mysql2";
import { Pool } from "pg";
import * as mysqlSchema from "../drizzle/schema";
import * as pgSchema from "../drizzle/schema.postgres";

// ─── Configuration ──────────────────────────────────────────────────────────

interface ValidationResult {
  table: string;
  mysqlCount: number;
  postgresCount: number;
  match: boolean;
  ownerScopingValid: boolean;
  errors: string[];
}

// ─── Validation Functions ───────────────────────────────────────────────────

async function validateTable(
  mysqlDb: ReturnType<typeof drizzleMysql>,
  postgresDb: ReturnType<typeof drizzlePostgres>,
  tableName: string,
  mysqlTable: any,
  pgTable: any,
  hasUserId: boolean = true
): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: tableName,
    mysqlCount: 0,
    postgresCount: 0,
    match: false,
    ownerScopingValid: true,
    errors: [],
  };

  try {
    // Count rows in MySQL
    const mysqlRows = await mysqlDb.select().from(mysqlTable);
    result.mysqlCount = mysqlRows.length;

    // Count rows in PostgreSQL
    const pgRows = await postgresDb.select().from(pgTable);
    result.postgresCount = pgRows.length;

    // Check if counts match
    result.match = result.mysqlCount === result.postgresCount;

    // Validate owner scoping if applicable
    if (hasUserId && result.mysqlCount > 0) {
      // Check that all rows have valid userId
      const invalidRows = pgRows.filter((row: any) => !row.userId);
      if (invalidRows.length > 0) {
        result.ownerScopingValid = false;
        result.errors.push(`${invalidRows.length} rows missing userId`);
      }
    }

    // Validate JSON/JSONB fields
    if (result.postgresCount > 0) {
      const sampleRows = pgRows.slice(0, 5);
      for (const row of sampleRows) {
        // Check that JSON fields are valid
        for (const [key, value] of Object.entries(row)) {
          if (key === "evidence" || key === "payload" || key === "toolScopes") {
            if (value !== null && typeof value !== "object") {
              result.errors.push(`Invalid JSON in ${key} field`);
            }
          }
        }
      }
    }

    // Validate timestamps
    if (result.postgresCount > 0) {
      const sampleRows = pgRows.slice(0, 5);
      for (const row of sampleRows) {
        const createdAt = (row as any).createdAt;
        if (createdAt && !(createdAt instanceof Date)) {
          result.errors.push(`Invalid timestamp in createdAt`);
        }
      }
    }
  } catch (error) {
    result.errors.push(`Error: ${error}`);
  }

  return result;
}

// ─── Main Validation Function ───────────────────────────────────────────────

async function validateMigration() {
  const mysqlUrl = process.env.MYSQL_URL;
  const postgresUrl = process.env.POSTGRES_URL;

  if (!mysqlUrl || !postgresUrl) {
    console.error("❌ MYSQL_URL and POSTGRES_URL environment variables are required");
    process.exit(1);
  }

  console.log("🔍 Starting migration validation...\n");

  // Connect to both databases
  const mysqlPool = createPool(mysqlUrl);
  const mysqlDb = drizzleMysql(mysqlPool);

  const postgresPool = new Pool({ connectionString: postgresUrl, max: 10 });
  const postgresDb = drizzlePostgres(postgresPool);

  // Tables to validate
  const tables = [
    { name: "users", mysql: mysqlSchema.users, pg: pgSchema.users, hasUserId: false },
    { name: "agentProfiles", mysql: mysqlSchema.agentProfiles, pg: pgSchema.agentProfiles },
    { name: "agentNodes", mysql: mysqlSchema.agentNodes, pg: pgSchema.agentNodes },
    { name: "agentConversations", mysql: mysqlSchema.agentConversations, pg: pgSchema.agentConversations },
    { name: "agentIndividualConversations", mysql: mysqlSchema.agentIndividualConversations, pg: pgSchema.agentIndividualConversations },
    { name: "agentMessages", mysql: mysqlSchema.agentMessages, pg: pgSchema.agentMessages },
    { name: "agentMemoryEntries", mysql: mysqlSchema.agentMemoryEntries, pg: pgSchema.agentMemoryEntries },
    { name: "agentMemoryActions", mysql: mysqlSchema.agentMemoryActions, pg: pgSchema.agentMemoryActions },
    { name: "agentEvolutionEvents", mysql: mysqlSchema.agentEvolutionEvents, pg: pgSchema.agentEvolutionEvents },
    { name: "agentRuns", mysql: mysqlSchema.agentRuns, pg: pgSchema.agentRuns },
    { name: "awarenessRecords", mysql: mysqlSchema.awarenessRecords, pg: pgSchema.awarenessRecords },
    { name: "strategyLineages", mysql: mysqlSchema.strategyLineages, pg: pgSchema.strategyLineages },
    { name: "strategyEvaluations", mysql: mysqlSchema.strategyEvaluations, pg: pgSchema.strategyEvaluations },
    { name: "outcomeRecords", mysql: mysqlSchema.outcomeRecords, pg: pgSchema.outcomeRecords },
    { name: "investmentPolicies", mysql: mysqlSchema.investmentPolicies, pg: pgSchema.investmentPolicies },
    { name: "walletMandates", mysql: mysqlSchema.walletMandates, pg: pgSchema.walletMandates },
    { name: "venueConnections", mysql: mysqlSchema.venueConnections, pg: pgSchema.venueConnections },
    { name: "agentProposals", mysql: mysqlSchema.agentProposals, pg: pgSchema.agentProposals },
    { name: "executionLedger", mysql: mysqlSchema.executionLedger, pg: pgSchema.executionLedger },
    { name: "paperOrders", mysql: mysqlSchema.paperOrders, pg: pgSchema.paperOrders },
    { name: "liveOrderIntents", mysql: mysqlSchema.liveOrderIntents, pg: pgSchema.liveOrderIntents },
    { name: "liveDailyRiskBuckets", mysql: mysqlSchema.liveDailyRiskBuckets, pg: pgSchema.liveDailyRiskBuckets },
    { name: "liveOrderApprovals", mysql: mysqlSchema.liveOrderApprovals, pg: pgSchema.liveOrderApprovals },
    { name: "operatorActions", mysql: mysqlSchema.operatorActions, pg: pgSchema.operatorActions },
    { name: "bindingChangeRequests", mysql: mysqlSchema.bindingChangeRequests, pg: pgSchema.bindingChangeRequests },
    { name: "securityAlerts", mysql: mysqlSchema.securityAlerts, pg: pgSchema.securityAlerts },
    { name: "platformApiKeys", mysql: mysqlSchema.platformApiKeys, pg: pgSchema.platformApiKeys },
    { name: "authorityControls", mysql: mysqlSchema.authorityControls, pg: pgSchema.authorityControls },
    { name: "watchlists", mysql: mysqlSchema.watchlists, pg: pgSchema.watchlists },
    { name: "watchlistItems", mysql: mysqlSchema.watchlistItems, pg: pgSchema.watchlistItems },
    { name: "discoverySchedules", mysql: mysqlSchema.discoverySchedules, pg: pgSchema.discoverySchedules },
    { name: "discoveryFindings", mysql: mysqlSchema.discoveryFindings, pg: pgSchema.discoveryFindings },
  ];

  const results: ValidationResult[] = [];

  // Validate each table
  for (const table of tables) {
    console.log(`🔍 Validating ${table.name}...`);
    const result = await validateTable(mysqlDb, postgresDb, table.name, table.mysql, table.pg, table.hasUserId);
    results.push(result);
    
    if (result.match && result.ownerScopingValid && result.errors.length === 0) {
      console.log(`   ✅ ${result.mysqlCount} rows (match)`);
    } else {
      console.log(`   ⚠️  MySQL: ${result.mysqlCount}, PostgreSQL: ${result.postgresCount}`);
      if (!result.match) console.log(`   ❌ Row count mismatch`);
      if (!result.ownerScopingValid) console.log(`   ❌ Owner scoping invalid`);
      if (result.errors.length > 0) {
        result.errors.forEach(err => console.log(`   ❌ ${err}`));
      }
    }
  }

  // Summary
  console.log("\n📊 Validation Summary:");
  console.log(`   Tables validated: ${results.length}`);
  console.log(`   Passed: ${results.filter(r => r.match && r.ownerScopingValid && r.errors.length === 0).length}`);
  console.log(`   Failed: ${results.filter(r => !r.match || !r.ownerScopingValid || r.errors.length > 0).length}`);

  // Write results
  const { writeFileSync } = await import("node:fs");
  const resultsPath = "migration-validation.json";
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results written to ${resultsPath}`);

  // Close connections
  mysqlPool.end();
  await postgresPool.end();

  // Exit with appropriate code
  const hasFailures = results.some(r => !r.match || !r.ownerScopingValid || r.errors.length > 0);
  if (hasFailures) {
    console.log("\n❌ Validation failed!");
    process.exit(1);
  } else {
    console.log("\n✅ Validation passed!");
    process.exit(0);
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

validateMigration().catch((error) => {
  console.error("❌ Validation failed:", error);
  process.exit(1);
});
