import { TradeStatus } from "@prisma/client";
import { TradeService } from "../services/trade.service";

describe("TradeService", () => {
  it("stores a pending trade with PENDING_SIGNATURE status", async () => {
    const create = jest.fn().mockResolvedValue({});
    const tradeService = new TradeService({
      trade: { create },
    } as any);

    await tradeService.createPendingTrade({
      tradeId: "4294967297",
      buyer: "buyer-address",
      seller: "seller-address",
      amountUsdc: "15.5000000",
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        tradeId: "4294967297",
        buyer: "buyer-address",
        seller: "seller-address",
        amountUsdc: "15.5000000",
        status: TradeStatus.PENDING_SIGNATURE,
      },
    });
  });
});
