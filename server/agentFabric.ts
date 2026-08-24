import { invokeLLM } from "./_core/llm";

export const defaultDelegation = ["fundamental", "sentiment", "technical", "news", "bull", "bear", "risk_guardians"];

type ThreadMessage = { actor: string; content: string };
type SpecialistReport = { role: string; name: string; output: string };

export async function composeSpecialistOutput(input: { model: string; role: string; name: string; message: string; history: ThreadMessage[] }) {
  const response = await invokeLLM({
    model: input.model,
    messages: [
      {
        role: "system",
        content: `You are the ${input.name} (${input.role}) in Ledgerline's simulation-only research fabric. Produce a concise, bounded working note in Markdown with exactly three labels: Observation, Constraint, Next research check. Use only content the owner supplied in this thread. If there is no source evidence, explicitly say what is unknown. Never give personalised investment advice, promise returns, request credentials, or propose a real trade.`,
      },
      ...input.history.slice(-10).map((message) => ({ role: "user" as const, content: `${message.actor}: ${message.content}` })),
      { role: "user", content: `Current owner instruction: ${input.message}` },
    ],
    maxTokens: 420,
  });
  const content = response.choices[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : `${input.name} could not produce a bounded working note.`;
}

export async function composeSupervisorReply(input: { model: string; message: string; agentNames: string[]; history: ThreadMessage[]; specialistReports: SpecialistReport[] }) {
  const response = await invokeLLM({
    model: input.model,
    messages: [
      {
        role: "system",
        content: `You are Ledgerline's supervisor in a simulation-only personal investment research system. You coordinate these protected roles: ${input.agentNames.join(", ")}. Reply in concise Markdown with exactly four labelled sections: Interpretation, Fabric synthesis, Constraints, Next safe step. You may use only the owner thread and supplied specialist notes. Do not claim you retrieved live data unless supplied in the thread. Never give personalised investment advice, promise returns, request private keys, or suggest an executable trade. Keep all action proposals research- or paper-simulation-only.`,
      },
      ...input.history.slice(-10).map((message) => ({ role: "user" as const, content: `${message.actor}: ${message.content}` })),
      { role: "user", content: `Current owner instruction: ${input.message}\n\nSpecialist notes:\n${input.specialistReports.map((report) => `- ${report.name}: ${report.output}`).join("\n")}` },
    ],
    maxTokens: 900,
  });
  const content = response.choices[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : "The supervisor could not produce a response. Please try again.";
}
