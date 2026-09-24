import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dns from "node:dns";

import { testConnection } from "./config/database";
import authRoutes from "./routes/auth.routes";
import publicRoutes from "./routes/public.routes";
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
import sectionTypesRoutes from "./routes/sectionTypes.routes";
import certificatesRoutes from "./routes/certificates.routes";
import pdfRoutes from "./routes/pdf.routes";
import strandTracksRoutes from "./routes/strandTracks.routes";
import schedulesRoutes from "./routes/schedules.routes";
import roomsRoutes from "./routes/rooms.routes";
import lisRoutes from "./routes/lis.routes";
import rbacRoutes from "./routes/rbac.routes";
import presenceRoutes from "./routes/presence.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { startUserStatusCron } from "./cron/userStatusCron";
import { startBackupCron } from "./cron/backupCron";
import { startActivityLogCron } from "./cron/activityLogCron";

// Load .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = parseInt(process.env.PORT || "3001");

// Trust the first reverse-proxy hop (the Railway/Vercel load balancer populates
// X-Forwarded-For). Without this, express-rate-limit validation throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and 500s every login / password-reset
// request when deployed behind a proxy.
app.set("trust proxy", 1);

// Prefer IPv4 DNS resolution: hosted platforms frequently have no IPv6 egress,
// so resolving smtp.gmail.com to an AAAA record first fails the SMTP connect
// with ENETUNREACH (forgot-password email never sends). This forces the
// nodemailer socket to dial the IPv4 address instead.
dns.setDefaultResultOrder("ipv4first");

// ─── Middleware ─────────────────────────────────────────────────────────────────

// Capacitor/Cordova webview origins (the packaged app calls the API from localhost)
const MOBILE_ORIGINS = [
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
  "http://127.0.0.1",
  "https://127.0.0.1",
];

// Comma-separated extra origins (e.g. Vercel preview domains) via FRONTEND_ORIGINS.
const EXTRA_ORIGINS = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// The Vercel deployment may be reached from hi5-six.vercel.app and its branch
// preview subdomains (hi5-six-git-<branch>-<hash>-<team>.vercel.app). Token
// auth means the allowlist is a convenience boundary, not the security one.
const isAllowedOrigin = (origin: string): boolean =>
  origin === (process.env.FRONTEND_URL || "http://localhost:5173") ||
  EXTRA_ORIGINS.includes(origin) ||
  MOBILE_ORIGINS.includes(origin) ||
  (process.env.NODE_ENV !== "production" && ["http://localhost:3000"].includes(origin)) ||
  /^https:\/\/hi5-six[\w-]*\.vercel\.app$/.test(origin);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin (curl, server-to-server) and known origins
    if (!origin) return callback(null, true);
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
}));

// ─── Security hardening ─────────────────────────────────────────────────────
// IP-level rate limits on the credential endpoints. Per-account lockout
// (5 attempts / 5 minutes) already exists in the auth controller; these add a
// network-level backstop for login / password-reset abuse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  limit: 30,                   // 30 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a few minutes." },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a few minutes." },
});

// Basic security headers (CSP off — this is a JSON API, no HTML served).
app.use(helmet({ contentSecurityPolicy: false }));

// gzip compression for large payloads (LIS exports, report JSON).
app.use(compression());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Routes ─────────────────────────────────────────────────────────────────────

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/forgot-password", resetLimiter);
app.use("/api/auth/reset-password", resetLimiter);
app.use("/api/auth", authRoutes);
app.use("/api", publicRoutes);
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
app.use("/api/section-types", sectionTypesRoutes);
app.use("/api/certificates", certificatesRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/strand-tracks", strandTracksRoutes);
app.use("/api/schedules", schedulesRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/lis", lisRoutes);
app.use("/api/rbac", rbacRoutes);
app.use("/api/presence", presenceRoutes);

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

  // Start background cron jobs
  if (dbConnected) {
    startUserStatusCron();
    startBackupCron();
    startActivityLogCron();
  }
}

start();
