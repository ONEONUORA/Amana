import { Response } from "express";
import * as StellarSdk from "@stellar/stellar-sdk";
import { AuthRequest } from "../middleware/auth.middleware";
import { ContractService } from "../services/contract.service";
import { TradeService } from "../services/trade.service";

const AMOUNT_USDC_PATTERN = /^\d+(?:\.\d{1,7})?$/;

interface CreateTradeBody {
  sellerAddress?: unknown;
  amountUsdc?: unknown;
}

export class TradeController {
  constructor(
    private readonly tradeService: TradeService = new TradeService(),
    private readonly contractService: ContractService = new ContractService()
  ) {}

  public createTrade = async (
    req: AuthRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const buyerAddress = req.user?.walletAddress;
      if (!buyerAddress) {
        return res.status(400).json({ error: "Wallet address not found in token" });
      }

      if (!this.isValidPublicKey(buyerAddress)) {
        return res.status(400).json({ error: "Invalid buyer wallet address" });
      }

      const { sellerAddress, amountUsdc } = req.body as CreateTradeBody;
      if (!this.isValidPublicKey(sellerAddress)) {
        return res.status(400).json({ error: "Invalid sellerAddress" });
      }

      const normalizedAmountUsdc = this.normalizeAmountUsdc(amountUsdc);
      if (!normalizedAmountUsdc) {
        return res.status(400).json({ error: "Invalid amountUsdc" });
      }

      const { tradeId, unsignedXdr } =
        await this.contractService.buildCreateTradeTx({
          buyerAddress,
          sellerAddress,
          amountUsdc: normalizedAmountUsdc,
        });

      await this.tradeService.createPendingTrade({
        tradeId,
        buyer: buyerAddress,
        seller: sellerAddress,
        amountUsdc: normalizedAmountUsdc,
      });

      return res.status(201).json({ tradeId, unsignedXdr });
    } catch (error) {
      console.error("Trade creation failed:", error);
      return res.status(500).json({ error: "Failed to create trade" });
    }
  };

  private isValidPublicKey(value: unknown): value is string {
    return (
      typeof value === "string" &&
      StellarSdk.StrKey.isValidEd25519PublicKey(value)
    );
  }

  private normalizeAmountUsdc(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number") {
      return null;
    }

    const normalized = String(value).trim();
    if (!AMOUNT_USDC_PATTERN.test(normalized)) {
      return null;
    }

    if (Number(normalized) <= 0) {
      return null;
    }

    return normalized;
  }
}
