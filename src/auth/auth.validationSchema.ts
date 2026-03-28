import z from "zod";

export const LoginUserBodySchema = z.object({
    name: z
        .string({error: "Name is required" })
        .trim()
        .min(3, "Name must be at least 3 characters long"),
    
    password: z
        .string({error: "Password is required" })
        .trim()
        .min(8, "Password must be at least 8 characters long")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
            "Password must contain uppercase, lowercase, number, and special character"
        ),
})


export const refreshTokenCookieSchema = z.object({
  refreshToken: z
    .string({error: "Refresh token is required" })
    .min(1, "Refresh token cannot be empty")
    .refine(
      (token) => {
        const dotIndex = token.indexOf(".");
        return dotIndex > 0 && token.length > dotIndex + 1;
      },
      { message: "Malformed refresh token" }
    ),
});
