#!/usr/bin/env node

// Phusion Passenger entry point
// This file is required for cPanel Node.js applications using Passenger

// Load environment variables
require('dotenv').config();

// Check for required environment variables before starting
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ CRITICAL: Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease set these variables in cPanel:');
  console.error('cPanel → Node.js Apps → Edit → Environment Variables\n');
  process.exit(1);
}
// Import and start the Express app
const app = require('./dist/app.js').default || require('./dist/app.js');

// For Passenger, we need to export the app
// Passenger will handle the actual server listening
if (typeof PhusionPassenger !== 'undefined') {
  module.exports = app;
} else {
  // For local testing or non-Passenger environments
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log('=================================');
    console.log('🚀 Studently Backend API');
    console.log('=================================');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('=================================');
  });
}
