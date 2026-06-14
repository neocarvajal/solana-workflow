import { getPrice } from "@/lib/price";
import { toast } from "sonner";
import type { FlowNode } from "@/lib/workflow";

export class TriggerEngine {
  /**
   * Main entry point to validate any trigger node.
   */
  async validateTrigger(node: FlowNode): Promise<boolean> {
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
        return false;
    }
  }

  private async evaluatePriceMonitor(params: any): Promise<boolean> {
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

    switch (condition) {
      case "above":
        return currentPrice > value;
      case "below":
        return currentPrice < value;
      case "change_pct":
        return false; 
      default:
        return false;
    }
  }

  private async evaluateSchedule(params: any): Promise<boolean> {
    return true; 
  }

  private async evaluateWebhook(params: any): Promise<boolean> {
    return false; // Webhooks usually wait for external signal
  }
}