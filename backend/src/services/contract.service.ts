import * as StellarSdk from "@stellar/stellar-sdk";

const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";
const DEFAULT_TIMEOUT_SECONDS = 300;
const USDC_DECIMALS = 7n;
const USDC_BASE = 10n ** USDC_DECIMALS;

export interface BuildCreateTradeTxInput {
  buyerAddress: string;
  sellerAddress: string;
  amountUsdc: string;
}

export interface BuildCreateTradeTxResult {
  tradeId: string;
  unsignedXdr: string;
}

export class ContractService {
  private readonly rpcServer: StellarSdk.rpc.Server;
  private readonly contractId: string;
  private readonly networkPassphrase: string;

  constructor(
    rpcUrl: string = process.env.STELLAR_RPC_URL || DEFAULT_RPC_URL,
    contractId: string = process.env.CONTRACT_ID || "",
    stellarNetwork: string = process.env.STELLAR_NETWORK || "TESTNET"
  ) {
    this.rpcServer = new StellarSdk.rpc.Server(rpcUrl);
    this.contractId = contractId;
    this.networkPassphrase = this.resolveNetworkPassphrase(stellarNetwork);
  }

  public async buildCreateTradeTx(
    input: BuildCreateTradeTxInput
  ): Promise<BuildCreateTradeTxResult> {
    if (!this.contractId) {
      throw new Error("CONTRACT_ID is not configured");
    }

    const account = await this.rpcServer.getAccount(input.buyerAddress);
    const contract = new StellarSdk.Contract(this.contractId);
    const amount = this.toContractAmount(input.amountUsdc);

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          "create_trade",
          StellarSdk.Address.fromString(input.buyerAddress).toScVal(),
          StellarSdk.Address.fromString(input.sellerAddress).toScVal(),
          StellarSdk.nativeToScVal(amount, { type: "i128" })
        )
      )
      .setTimeout(DEFAULT_TIMEOUT_SECONDS)
      .build();

    const simulation = await this.rpcServer.simulateTransaction(transaction);
    const tradeId = this.extractTradeId(simulation);
    const preparedTransaction = await this.rpcServer.prepareTransaction(transaction);

    return {
      tradeId,
      unsignedXdr: preparedTransaction.toXDR(),
    };
  }

  private resolveNetworkPassphrase(network: string): string {
    if (network.toUpperCase() === "PUBLIC") {
      return StellarSdk.Networks.PUBLIC;
    }

    return StellarSdk.Networks.TESTNET;
  }

  private toContractAmount(amountUsdc: string): bigint {
    const [wholePart, fractionPart = ""] = amountUsdc.split(".");
    const paddedFraction = `${fractionPart}0000000`.slice(0, Number(USDC_DECIMALS));

    return BigInt(wholePart) * USDC_BASE + BigInt(paddedFraction);
  }

  private extractTradeId(
    simulation: StellarSdk.rpc.Api.SimulateTransactionResponse
  ): string {
    if ("error" in simulation && typeof simulation.error === "string") {
      throw new Error(`Failed to simulate create_trade transaction: ${simulation.error}`);
    }

    if (!("result" in simulation) || !simulation.result) {
      throw new Error("Trade simulation did not return a tradeId");
    }

    return String(StellarSdk.scValToNative(simulation.result.retval));
  }
}
