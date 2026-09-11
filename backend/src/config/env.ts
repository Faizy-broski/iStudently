import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  frontend: {
    // If FRONTEND_URL is in .env, use it. 
    // Otherwise, default based on mode.
    url: process.env.FRONTEND_URL || (isProduction 
      ? 'http://102.213.183.100:8080' 
      : 'http://localhost:3000'),
  },

  cors: {
    // 1. If CORS_ORIGINS exists in .env, split it into an array
    // 2. Otherwise, use the smart defaults below
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
      : (isProduction
          ? [
              'http://102.213.183.100:8080',
              'http://102.213.183.100',
              'https://istudent.ly', // Add your domain here if you have one
              'https://demo.istudent.ly',
            ]
          : [
              'http://localhost:3000',
              'http://localhost:3005',
              'http://127.0.0.1:3000'
            ]
        ),
  },

  miqat: {
    // Platform enrolment-authority keypair — signs device certificates
    // (Layer 4). PEM strings with literal \n escapes, matching the common
    // convention for multi-line PEM values in single-line .env files.
    authorityPrivateKey: (process.env.MIQAT_AUTHORITY_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    authorityPublicKey: (process.env.MIQAT_AUTHORITY_PUBLIC_KEY || '').replace(/\\n/g, '\n'),
    // AES-256-GCM master key (base64, 32 raw bytes) encrypting card-signing
    // keys and other Miqat secrets at rest — see services/miqat/key-management.ts.
    masterKeyBase64: process.env.MIQAT_MASTER_KEY || '',
  },
};

if (isProduction && (!config.miqat.authorityPrivateKey || !config.miqat.masterKeyBase64)) {
  console.warn('⚠️ WARNING: MIQAT_AUTHORITY_PRIVATE_KEY / MIQAT_MASTER_KEY are not set in production — Miqat device enrolment and key storage will fail closed.');
}

// Simple validation to warn you if critical keys are missing
if (!config.supabase.url || !config.supabase.anonKey) {
  console.warn('⚠️ WARNING: Supabase configuration is incomplete in .env file');
}