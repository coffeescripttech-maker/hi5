import { Router } from "express";
import { login, getMe, updateMe, logout, forgotPassword, resetPassword } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// POST /api/auth/login — Authenticate user
router.post("/login", login);

// POST /api/auth/forgot-password — Request a password reset code (public)
router.post("/forgot-password", forgotPassword);

// POST /api/auth/reset-password — Reset password with the code (public)
router.post("/reset-password", resetPassword);

// GET /api/auth/me — Get current user info (requires auth)
router.get("/me", authenticate, getMe);

// PUT /api/auth/me — Update own profile (requires auth)
router.put("/me", authenticate, updateMe);

// POST /api/auth/logout — Logout
router.post("/logout", authenticate, logout);

export default router;
