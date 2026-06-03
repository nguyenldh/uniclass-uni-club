import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { normalizeAuthUser } from "@uniclub/shared";
import { UserService } from "../../services";

const router = Router();

/**
 * GET /api/auth/me
 * Xác thực JWT token từ header Authorization và trả về thông tin người dùng.
 * UniClass WebView sẽ gửi token qua URL param, frontend gắn vào header.
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const rawPayload = jwt.verify(token, env.JWT_SECRET);
    const payload = normalizeAuthUser(rawPayload);

    if (payload.profileId) {
      payload.userId = payload.profileId; // Sử dụng profileId làm userId chính nếu có
    }

    await UserService.upsertUser(payload);

    res.json({
      success: true,
      user: payload,
    });
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      res.status(401).json({ error: "Token expired" });
      return;
    }
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
