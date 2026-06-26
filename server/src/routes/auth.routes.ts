import { Router } from "express";
import { login, getMe, updateMe, logout } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// POST /api/auth/login — Authenticate user
router.post("/login", login);

// GET /api/auth/me — Get current user info (requires auth)
router.get("/me", authenticate, getMe);

// PUT /api/auth/me — Update own profile (requires auth)
router.put("/me", authenticate, updateMe);

// POST /api/auth/logout — Logout
router.post("/logout", authenticate, logout);

export default router;
