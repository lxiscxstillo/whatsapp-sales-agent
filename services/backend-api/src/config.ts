import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  WPPCONNECT_URL: z.string().url().default('http://wppconnect:21465'),
  WPPCONNECT_SECRET_KEY: z.string().min(1, 'WPPCONNECT_SECRET_KEY is required'),
  WPPCONNECT_SESSION: z.string().default('my-whatsapp-session'),
  AGENT_URL: z.string().url().default('http://localhost:8000'),
  LANGCHAIN_API_KEY: z.string().optional(),
  LANGSMITH_PROJECT: z.string().default('whatsapp-sales-agent'),
  INTERNAL_API_KEY: z.string().min(1, 'INTERNAL_API_KEY is required'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
