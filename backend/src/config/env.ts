import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'production',
  supabase: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  frontend: {
    // Development URL as default, production URL for production
    url: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://demo.istudent.ly' : 'http://localhost:3000'),
  },
  cors: {
    // Parse comma-separated CORS origins from environment variable
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
      : (process.env.NODE_ENV === 'production' 
          ? ['https://demo.istudent.ly', 'https://www.demo.istudent.ly']
          : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']
        ),
  },
}