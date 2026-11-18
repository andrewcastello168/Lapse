import { createNotificationsHandler } from "./handler.ts";
Deno.serve(
  createNotificationsHandler({
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    jwtSecret: Deno.env.get("JWT_SECRET") ?? "",
    cronSecret: Deno.env.get("CRON_SECRET"),
    scheduledEnabled: Deno.env.get("SCHEDULED_PUSH_ENABLED") === "true",
    expoAccessToken: Deno.env.get("EXPO_ACCESS_TOKEN"),
  }),
);
