import { PrismaClient, Trade, TradeStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface CreatePendingTradeInput {
  tradeId: string;
  buyer: string;
  seller: string;
  amountUsdc: string;
}

type TradeDatabase = Pick<PrismaClient, "trade">;

export class TradeService {
  constructor(private readonly db: TradeDatabase = prisma) {}

  public async createPendingTrade(input: CreatePendingTradeInput): Promise<Trade> {
    return this.db.trade.create({
      data: {
        ...input,
        status: TradeStatus.PENDING_SIGNATURE,
      },
    });
  }
}
