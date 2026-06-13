import { getPrice } from "@/lib/price";
import { toast } from "sonner";
import type { FlowNode } from "@/lib/workflow";

export class TriggerEngine {
  /**
   * Main entry point to validate any trigger node.
   */
  async validateTrigger(node: FlowNode): Promise<boolean> {
    const { params } = node;

    console.log(`Evaluating trigger: ${node.module.type}`, params);

    switch (node.module.type) {
      case "price_monitor":
        return await this.evaluatePriceMonitor(params);
      case "schedule":
        return await this.evaluateSchedule(params);
      case "webhook":
        return await this.evaluateWebhook(params);
      default:
        console.warn(`Unknown trigger type: ${node.module.type}`);
        return false;
    }
  }

  private async evaluatePriceMonitor(params: any): Promise<boolean> {
    // console.log("Evaluating Price Monitor with params:", JSON.stringify(params, null, 2));
    const { asset, condition, value } = params;

    if (!asset || typeof asset !== 'string') {
      console.error("Trigger failed: 'asset' is missing or invalid", asset);
      return false;
    }

    if (!asset || value === undefined || !condition) {
      console.error("Price Monitor configuration is missing required fields:", params);
      return false;
    }

    const currentPrice = await getPrice(asset);
    console.log(`Current ${asset} price: ${currentPrice}. Target: ${value}`);

    switch (condition) {
      case "above":
        return currentPrice > value;
      case "below":
        return currentPrice < value;
      case "change_pct":
        // Implementation for percentage change logic
        return false; 
      default:
        return false;
    }
  }

  private async evaluateSchedule(params: any): Promise<boolean> {
    // Logic for time-based triggers (e.g., cron verification)
    console.log("Evaluating schedule trigger:", params.every);
    return true; 
  }

  private async evaluateWebhook(params: any): Promise<boolean> {
    // Logic for HTTP endpoint triggers
    console.log("Waiting for webhook on path:", params.path);
    return false; // Webhooks usually wait for external signal
  }
}