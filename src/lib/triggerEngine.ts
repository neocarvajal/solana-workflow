import { getPriceData } from "@/lib/price";
import type { FlowNode } from "@/lib/workflow";

export interface TriggerEvaluation {
  triggered: boolean;
  data: Record<string, unknown>;
}

export class TriggerEngine {
  /**
   * Main entry point to validate any trigger node.
   * Kept for callers that only need the boolean result.
   */
  async validateTrigger(node: FlowNode): Promise<boolean> {
    return (await this.evaluateTrigger(node)).triggered;
  }

  /**
   * Evaluate a trigger and return the data that caused it to fire.
   * Alert steps use this data to render `{{price}}`, `{{asset}}`, etc.
   */
  async evaluateTrigger(node: FlowNode): Promise<TriggerEvaluation> {
    const { params } = node;

    switch (node.module.type) {
      case "price_monitor":
        return await this.evaluatePriceMonitor(params);
      case "schedule":
        return await this.evaluateSchedule(params);
      case "webhook":
        return await this.evaluateWebhook(params);
      default:
        console.warn(`Unknown trigger type: ${node.module.type}`);
        return { triggered: false, data: {} };
    }
  }

  private async evaluatePriceMonitor(params: any): Promise<TriggerEvaluation> {
    const { asset, condition, value } = params;

    if (!asset || typeof asset !== "string") {
      console.error("Trigger failed: 'asset' is missing or invalid", asset);
      return { triggered: false, data: { asset } };
    }

    const needsValue = condition === "above" || condition === "below" || condition === "change_pct";
    if (!condition || (needsValue && (value === undefined || value === null || value === ""))) {
      console.error("Price Monitor configuration is missing required fields:", params);
      return { triggered: false, data: { asset, condition, value } };
    }

    const snapshot = await getPriceData(asset);
    const currentPrice = snapshot.price;
    const priceChange24h = snapshot.priceChange24h;
    const numericValue = Number(value);

    const data = {
      asset: asset.toUpperCase(),
      price: currentPrice,
      priceChange24h,
      condition,
      value: Number.isFinite(numericValue) ? numericValue : null,
      threshold: Number.isFinite(numericValue) ? numericValue : null,
    };

    switch (condition) {
      case "price":
        return { triggered: true, data };
      case "above":
        return { triggered: currentPrice > numericValue, data };
      case "below":
        return { triggered: currentPrice < numericValue, data };
      case "change_pct":
        return {
          triggered:
            priceChange24h !== null &&
            Math.abs(priceChange24h) >= Math.abs(numericValue),
          data,
        };
      default:
        return { triggered: false, data };
    }
  }

  private async evaluateSchedule(params: any): Promise<TriggerEvaluation> {
    return {
      triggered: true,
      data: {
        schedule: params.every || params.cron || "manual",
      },
    };
  }

  private async evaluateWebhook(_params: any): Promise<TriggerEvaluation> {
    return { triggered: false, data: {} };
  }
}
