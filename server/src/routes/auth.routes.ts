import { Router } from "express";
import { login, getMe, logout } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// POST /api/auth/login — Authenticate user
router.post("/login", login);

// GET /api/auth/me — Get current user info (requires auth)
router.get("/me", authenticate, getMe);

// POST /api/auth/logout — Logout
router.post("/logout", authenticate, logout);

export default router;
