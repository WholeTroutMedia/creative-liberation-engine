import { z } from 'zod';

export const ServicePatchSchema = z.object({
  healthcheck: z.object({
    test: z.array(z.string()).describe("The command to run to check health. E.g. ['CMD-SHELL', 'curl -f http://localhost:80 || exit 1']"),
    interval: z.string().describe("E.g., '30s'"),
    timeout: z.string().describe("E.g., '10s'"),
    retries: z.number().describe("Number of retries before unhealthy, e.g., 3"),
    start_period: z.string().optional().describe("Optional start period, e.g., '40s'")
  }).nullable().describe("Provide a robust healthcheck tailored to the image. If absolutely not applicable, return null."),
  deploy: z.object({
    resources: z.object({
      limits: z.object({
        cpus: z.string().describe("A string representing CPU fraction, e.g., '0.5'"),
        memory: z.string().describe("A string representing max memory, e.g., '512M' or '2G'")
      })
    })
  }).nullable().describe("Provide reasonable resource limits based on typical usage for this image type to prevent host crashes. If not applicable, return null."),
  secretsReplaced: z.record(z.string(), z.string()).optional().describe("A map mapping environment variable keys that contain hardcoded secrets (like passwords, keys) to a secure interpolated string, e.g., '${SECRET_VAR_NAME}'.")
}).describe("The exact configuration patch needed to harden this specific docker service.");

export type ServicePatchData = z.infer<typeof ServicePatchSchema>;
