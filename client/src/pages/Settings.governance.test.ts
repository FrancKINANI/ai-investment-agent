import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const settings = readFileSync(fileURLToPath(new URL("./Settings.tsx", import.meta.url)), "utf8");
const activity = readFileSync(fileURLToPath(new URL("./Activity.tsx", import.meta.url)), "utf8");
const dashboard = readFileSync(fileURLToPath(new URL("../components/DashboardLayout.tsx", import.meta.url)), "utf8");

describe("PAIA governance surfaces", () => {
  it("keeps binding changes staged and validates them through the protected registry procedure", () => {
    expect(settings).toContain("Binding editor");
    expect(settings).toContain("validateCapabilityBinding");
    expect(settings).toContain("The runtime manifest remains unchanged");
    expect(settings).toContain("Binding change requests");
    expect(settings).toContain("Submit for administrator review");
    expect(settings).toContain("Approve staged request");
    expect(settings).toContain("active manifest remains unchanged");
  });

  it("requires an explicit paper-only hard gate review before approval", () => {
    expect(settings).toContain("Hard evaluation gates");
    expect(settings).toContain("reviewHardGate");
    expect(settings).toContain("Approve paper simulation");
    expect(settings).toContain("Passing a gate never authorizes a real order or transaction");
  });

  it("renders registry origin and exact capability versions in activity", () => {
    expect(activity).toContain("Capability source");
    expect(activity).toContain("registryRevision");
    expect(activity).toContain("capability.id");
  });

  it("uses the approved agent-first Mission Control navigation without reviving the retired Command label", () => {
    const rail = dashboard.slice(dashboard.indexOf("const menuItems"), dashboard.indexOf("const routeLabels"));
    expect(rail).not.toContain('label: "Command"');
    expect(rail).toContain('label: "Mission Control"');
    expect(rail).toContain('label: "Agent Room"');
    expect(rail).toContain('label: "Decision Desk"');
    expect(dashboard).not.toContain('navigate("/")}><LayoutDashboard size={14} /> Mission Control');
    expect(dashboard).not.toContain('navigate("/settings")}><Settings2 size={14} /> Configure');
    expect(dashboard).not.toContain('markActivityRead(); navigate("/activity")');
    expect(dashboard).not.toContain('>Open Configure</Button>');
  });
});
