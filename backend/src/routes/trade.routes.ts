import { Router } from "express";
import { TradeController } from "../controllers/trade.controller";
import { authMiddleware } from "../middleware/auth.middleware";

export const tradeRoutes = Router();
const tradeController = new TradeController();

tradeRoutes.post("/", authMiddleware, tradeController.createTrade);
