import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";

import { testConnection } from "./config/database";
import authRoutes from "./routes/auth.routes";
import usersRoutes from "./routes/users.routes";
import studentsRoutes from "./routes/students.routes";
import sectionsRoutes from "./routes/sections.routes";
import subjectsRoutes from "./routes/subjects.routes";
import settingsRoutes from "./routes/settings.routes";
import logsRoutes from "./routes/logs.routes";
import enrollmentsRoutes from "./routes/enrollments.routes";
import gradesRoutes from "./routes/grades.routes";
import correctionsRoutes from "./routes/corrections.routes";
import promotionsRoutes from "./routes/promotions.routes";
import atRiskRoutes from "./routes/atRisk.routes";
import formsRoutes from "./routes/forms.routes";
import documentsRoutes from "./routes/documents.routes";
import schoolYearsRoutes from "./routes/schoolYears.routes";
import backupsRoutes from "./routes/backups.routes";
import notificationsRoutes from "./routes/notifications.routes";
import sectioningRoutes from "./routes/sectioning.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

// Load .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = parseInt(process.env.PORT || "3001");

// ─── Middleware ─────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL || "http://localhost:5173"
    : ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Routes ─────────────────────────────────────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/sections", sectionsRoutes);
app.use("/api/subjects", subjectsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/enrollments", enrollmentsRoutes);
app.use("/api/grades", gradesRoutes);
app.use("/api/grades/corrections", correctionsRoutes);
app.use("/api/promotions", promotionsRoutes);
app.use("/api/at-risk", atRiskRoutes);
app.use("/api/forms", formsRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/school-years", schoolYearsRoutes);
app.use("/api/backups", backupsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/sectioning", sectioningRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Error Handling ─────────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────────────────────

async function start() {
  const dbConnected = await testConnection();

  if (!dbConnected) {
    console.warn("⚠️  Starting server without database connection.");
    console.warn("   Make sure MySQL is running and the .env file is configured.");
  }

  app.listen(PORT, () => {
    console.log(`🚀 HI5 Portal API running at http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
}

start();
