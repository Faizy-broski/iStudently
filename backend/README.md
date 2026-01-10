# Studently Backend API

Backend API for Studently - School Management SaaS Platform

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth + JWT

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── services/        # Business logic
│   ├── middlewares/     # Custom middlewares
│   ├── routes/          # API routes
│   ├── models/          # Data models
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript types
│   └── app.ts           # Entry point
├── package.json
└── tsconfig.json
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your Supabase credentials

4. Run development server:
   ```bash
   npm run dev
   ```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Lint code
