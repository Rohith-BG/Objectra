import type { AccessTokenPayload } from "../auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload
    }
  }
}