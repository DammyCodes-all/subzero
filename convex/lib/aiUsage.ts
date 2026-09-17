import { internal } from "../_generated/api";

export type ProviderUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export async function recordAiUsage(
  ctx: any,
  args: {
    operation: "extraction" | "research";
    provider: string;
    model: string;
    usage?: ProviderUsage;
    latencyMs: number;
    success: boolean;
  },
): Promise<void> {
  try {
    await ctx.runMutation(internal.aiUsage.record, {
      operation: args.operation,
      provider: args.provider,
      model: args.model,
      promptTokens: args.usage?.prompt_tokens,
      completionTokens: args.usage?.completion_tokens,
      totalTokens: args.usage?.total_tokens,
      latencyMs: args.latencyMs,
      success: args.success,
    });
  } catch (error) {
    console.error("recordAiUsage failed", String(error).slice(0, 200));
  }
}
