import type { Context, Next } from "hono";

type EnvWithApiKey = {
  API_KEY?: string;
};

export async function auth(c: Context<{ Bindings: EnvWithApiKey }>, next: Next) {
  const providedKey = c.req.header("api-key");
  const expectedKey = c.env.API_KEY;

  if (!expectedKey || providedKey !== expectedKey) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return next();
}
