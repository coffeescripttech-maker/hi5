import { Request, Response, NextFunction } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Fail fast in production: a missing JWT secret must never silently fall back
// to a known dev value where real tokens are issued.
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET must be set in the environment when NODE_ENV=production."
  );
}
const JWT_SECRET = process.env.JWT_SECRET || "fallback_dev_secret_do_not_use_in_prod";

export interface JwtPayload {
  userId: number;
  username: string;
  role: "admin" | "teacher" | "registrar" | "principal";
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Verify JWT token from Authorization header or cookie
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  } else if (typeof req.query.token === "string") {
    // window.open download links can't set headers — token passed as query param
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: "Authentication required. Please log in." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token. Please log in again." });
  }
}

/**
 * Generate a JWT token
 */
export function generateToken(payload: JwtPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || "8h") as SignOptions["expiresIn"];
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
