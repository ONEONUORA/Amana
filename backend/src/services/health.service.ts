import { prisma as defaultPrisma } from "../lib/db";
import { redis } from "../lib/redis";
import { appLogger } from "../middleware/logger";
import { AlertService, alertService as defaultAlertService } from "./alert.service";

interface HealthIndicatorResult {
    status: "up" | "down";
    message: string;
    responseTime: number;
}

interface HealthCheckResponse {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    uptime: number;
    checks: {
        database: HealthIndicatorResult;
        redis: HealthIndicatorResult;
        indexer: HealthIndicatorResult;
    };
    details: {
        databaseLatency: number;
        redisLatency: number;
        indexerLagSeconds: number;
        lastProcessedLedger: number | null;
    };
}

type HealthDatabase = any;
interface HealthRedis {
    ping(): Promise<string>;
}

export class HealthService {
    private startTime: number = Date.now();

    constructor(
        private readonly prisma: HealthDatabase = defaultPrisma,
        private readonly cacheClient: HealthRedis = redis as unknown as HealthRedis,
        private readonly alerts: AlertService = defaultAlertService,
    ) { }

    /**
     * Check database connectivity and query performance
     * Ensures TypeORM-like deep introspection with ~200ms bounds
     */
    private async checkDatabase(): Promise<HealthIndicatorResult> {
        const startTime = Date.now();
        const timeout = 200; // 200ms threshold

        try {
            // Execute a simple query to verify database access
            await Promise.race([
                this.prisma.$queryRaw`SELECT 1 as health_check`,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Database query timeout")), timeout)
                ),
            ]);

            const responseTime = Date.now() - startTime;

            if (responseTime > timeout) {
                return {
                    status: "down",
                    message: `Database query exceeded ${timeout}ms threshold`,
                    responseTime,
                };
            }

            return {
                status: "up",
                message: "Database connection healthy",
                responseTime,
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            appLogger.error({ error }, "Database health check failed");
            return {
                status: "down",
                message: `Database check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                responseTime,
            };
        }
    }

    /**
     * Check Redis cache connectivity and response time
     */
    private async checkRedis(): Promise<HealthIndicatorResult> {
        const startTime = Date.now();
        const timeout = 200;

        try {
            await Promise.race([
                this.cacheClient.ping(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Redis ping timeout")), timeout)
                ),
            ]);

            const responseTime = Date.now() - startTime;

            if (responseTime > timeout) {
                return {
                    status: "down",
                    message: `Redis ping exceeded ${timeout}ms threshold`,
                    responseTime,
                };
            }

            return {
                status: "up",
                message: "Redis cache connection healthy",
                responseTime,
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            appLogger.error({ error }, "Redis health check failed");
            return {
                status: "down",
                message: `Redis check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                responseTime,
            };
        }
    }

    /**
     * Check indexer service health
     * Validates that the indexer has processed a ledger within the last 15 seconds
     * Ensures no background task halting
     */
    private async checkIndexer(): Promise<HealthIndicatorResult> {
        const startTime = Date.now();
        const maxLagSeconds = 15;

        try {
            // Fetch the most recent processed ledger
            const latestLedger = await this.prisma.processedLedger.findFirst({
                orderBy: { ledgerSequence: "desc" },
                take: 1,
            });

            const responseTime = Date.now() - startTime;

            if (!latestLedger) {
                return {
                    status: "down",
                    message: "No processed ledgers found - indexer may not have started",
                    responseTime,
                };
            }

            // Check if the ledger was processed within the last 15 seconds
            const ledgerAge = (Date.now() - latestLedger.processedAt.getTime()) / 1000;

            if (ledgerAge > maxLagSeconds) {
                return {
                    status: "down",
                    message: `Indexer lag exceeds ${maxLagSeconds}s threshold (current: ${ledgerAge.toFixed(1)}s)`,
                    responseTime,
                };
            }

            return {
                status: "up",
                message: `Indexer healthy - last ledger processed ${ledgerAge.toFixed(1)}s ago`,
                responseTime,
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            appLogger.error({ error }, "Indexer health check failed");
            return {
                status: "down",
                message: `Indexer check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                responseTime,
            };
        }
    }

    private async dispatchAlerts(
        databaseCheck: HealthIndicatorResult,
        redisCheck: HealthIndicatorResult,
    ): Promise<void> {
        if (databaseCheck.status === "down") {
            await this.alerts.dispatch("db_connection_failure", databaseCheck.message, {
                responseTime: databaseCheck.responseTime,
            });
        }

        if (redisCheck.status === "down") {
            await this.alerts.dispatch("redis_connection_failure", redisCheck.message, {
                responseTime: redisCheck.responseTime,
            });
        }
    }

    /**
     * Perform comprehensive health check
     * Returns detailed status for uptime integrations (Datadog, UptimeRobot, etc.)
     */
    async performHealthCheck(): Promise<HealthCheckResponse> {
        const timestamp = new Date().toISOString();
        const uptime = Date.now() - this.startTime;

        // Run checks in parallel
        const [databaseCheck, redisCheck, indexerCheck] = await Promise.all([
            this.checkDatabase(),
            this.checkRedis(),
            this.checkIndexer(),
        ]);

        await this.dispatchAlerts(databaseCheck, redisCheck);

        // Determine overall status
        let status: "healthy" | "degraded" | "unhealthy" = "healthy";
        if (
            databaseCheck.status === "down"
            || redisCheck.status === "down"
            || indexerCheck.status === "down"
        ) {
            status = "unhealthy";
        } else if (
            databaseCheck.responseTime > 150
            || redisCheck.responseTime > 150
            || indexerCheck.responseTime > 150
        ) {
            status = "degraded";
        }

        // Fetch latest ledger for details
        let latestLedger: { ledgerSequence: number; processedAt: Date } | null = null;
        try {
            latestLedger = await this.prisma.processedLedger.findFirst({
                orderBy: { ledgerSequence: "desc" },
                take: 1,
            });
        } catch (error) {
            appLogger.error({ error }, "Failed to fetch latest ledger for health details");
        }

        const indexerLagSeconds = latestLedger
            ? (Date.now() - latestLedger.processedAt.getTime()) / 1000
            : -1;

        return {
            status,
            timestamp,
            uptime,
            checks: {
                database: databaseCheck,
                redis: redisCheck,
                indexer: indexerCheck,
            },
            details: {
                databaseLatency: databaseCheck.responseTime,
                redisLatency: redisCheck.responseTime,
                indexerLagSeconds: indexerLagSeconds > 0 ? indexerLagSeconds : 0,
                lastProcessedLedger: latestLedger?.ledgerSequence ?? null,
            },
        };
    }
}
