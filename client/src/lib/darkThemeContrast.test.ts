import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

function relativeLuminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("dark-theme route contrast audit", () => {
  it("keeps core dark-theme text and interactive tokens above the AA contrast threshold", () => {
    const canvas = "061426";
    const surface = "0c203b";
    const tokens = ["f4f8ff", "bfd1e8", "8abaff", "78e7ff"];
    tokens.forEach((token) => {
      expect(contrastRatio(token, canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(token, surface)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("binds every active workspace to the dark-tokenized operating system", () => {
    [
      ".command-page-next",
      ".solo-chat-page",
      ".workspace-page .wallet-role",
      ".connections-page .connection-card",
      ".settings-card",
      ".activity-page .activity-log",
    ].forEach((selector) => expect(stylesheet).toContain(selector));
    expect(stylesheet).toContain(".dark { --ll-canvas:#061426");
    expect(stylesheet).toContain("--ll-muted:#bfd1e8");
  });
});
