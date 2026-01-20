import type { Context, Next } from "hono";

type EnvWithApiKey = {
  API_KEY?: string;
};

export async function auth(c: Context<{ Bindings: EnvWithApiKey }>, next: Next) {
  const providedKey = c.req.header("api-key");
  const expectedKey = c.env.API_KEY;

  if (!expectedKey || providedKey !== expectedKey) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid api-key header.",
          hint: "Provide the api-key header with your API key."
        }
      },
      401
    );
  }

  return next();
}
