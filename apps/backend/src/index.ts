import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import swaggerUi from "swagger-ui-express";
import authRouter from "./routes/api/auth";
import syncRouter from "./routes/api/sync";
import adminRouter from "./routes/api/admin";
import partnerRouter from "./routes/api/partner";
import poisRouter from "./routes/api/pois";
import toursRouter from "./routes/api/tours";
import userRouter from "./routes/api/userRouter";
import analyticsRouter from "./routes/api/analytics";
import usersRouter from "./routes/api/users";
import searchRouter from "./routes/api/search";
import prisma from "./lib/prisma";
import {
  errorHandlingMiddleware,
  notFoundMiddleware,
} from "./middlewares/errorHandlingMiddleware";
import {
  initializeTtsWorker,
  validateTtsRuntimeConfig,
} from "./services/ttsService";
import { initializePoiSoftDeleteCleanupScheduler } from "./services/poiAdminService";

dotenv.config();

const app = express();
const parsedPort = Number(process.env.PORT);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
const OPENAPI_FILE_PATH = path.resolve(process.cwd(), "openapi.json");

async function validateAuthRoleSchema(): Promise<void> {
  const missing = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT required.column_name
    FROM (VALUES ('role'), ('token_invalid_before')) AS required(column_name)
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public'
      AND c.table_name = 'users'
      AND c.column_name = required.column_name
    WHERE c.column_name IS NULL
  `;

  if (missing.length > 0) {
    const columns = missing.map((item: any) => item.column_name).join(", ");
    throw new Error(
      `Thiếu cột bắt buộc trong bảng users: ${columns}. Hãy chạy migration mới nhất trước khi khởi động server.`,
    );
  }
}

function loadOpenApiSpec() {
  if (!fs.existsSync(OPENAPI_FILE_PATH)) {
    return {
      openapi: "3.0.0",
      info: {
        title: "PhoAmThuc API",
        version: "1.0.0",
        description:
          "OpenAPI file not generated yet. Run: npm run openapi:generate",
      },
      paths: {},
    };
  }

  return JSON.parse(fs.readFileSync(OPENAPI_FILE_PATH, "utf8"));
}

app.use(cors());
app.use(helmet());
app.use(compression({ threshold: 0 }));
app.use(express.json());
app.use("/api/v1/users", userRouter);
app.use("/audio", express.static(path.resolve(process.cwd(), "public/audio")));
app.get("/api-docs/swagger.json", (_req, res) => {
  return res.status(200).json(loadOpenApiSpec());
});
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(undefined, { swaggerUrl: "/api-docs/swagger.json" }),
);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/sync", syncRouter);
app.use("/api/v1/partner", partnerRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/pois", poisRouter);
app.use("/api/v1/tours", toursRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/search", searchRouter);

app.get("/", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      message: "Mobile Backend is running!",
      service: "Node.js + Express",
      db_status: "Connected",
      db_type: "PostgreSQL + PostGIS",
    });
  } catch (error) {
    res.status(500).json({
      message: "Backend running but DB connection failed",
      error: error,
    });
  }
});

app.use(notFoundMiddleware);
app.use(errorHandlingMiddleware);

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    await prisma.$connect();
    console.log("Database connected successfully");

    await validateAuthRoleSchema();
    console.log("Auth role schema preflight passed");

    const ttsValidation = validateTtsRuntimeConfig();
    if (!ttsValidation.ok) {
      console.error("TTS runtime configuration invalid:", ttsValidation.errors);
      if (process.env.TTS_STRICT_CONFIG === "true") {
        throw new Error("TTS runtime configuration is invalid in strict mode.");
      }
    }
    if (ttsValidation.warnings.length > 0) {
      console.warn(
        "TTS runtime configuration warnings:",
        ttsValidation.warnings,
      );
    }

    await initializeTtsWorker();
    console.log("TTS worker initialized");

    const cleanupTimer = initializePoiSoftDeleteCleanupScheduler();
    if (cleanupTimer) {
      console.log("POI soft-delete cleanup scheduler initialized");
    }
  } catch (error) {
    console.error("Database connection failed:", error);
  }
});
// Thêm vào cuối file index.ts
process.on("unhandledRejection", (reason, p) => {
  console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
