// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  // No sessions needed (auth is Cloudflare Access) -> no KV binding required
  session: false,
  security: { checkOrigin: true },
});
