import express, { Request, Response, NextFunction } from 'express'
import path from 'path'

import { config } from './config/env'
import { cronService } from './services/cron.service'
import schoolRoutes from './routes/school.routes'
import dashboardRoutes from './routes/dashboard.routes'
import schoolDashboardRoutes from './routes/school-dashboard.routes'
import studentRoutes from './routes/student.routes'
import parentRoutes from './routes/parent.routes'
import eventRoutes from './routes/event.routes'
import libraryRoutes from './routes/library.routes'
import academicsRoutes from './routes/academics.routes'
import teacherRoutes from './routes/teacher.routes'
import timetableRoutes from './routes/timetable.routes'
import feesRoutes from './routes/fees.routes'
import salaryRoutes from './routes/salary.routes'
import schoolServicesRoutes from './routes/school-services.routes'
import staffRoutes from './routes/staff.routes'
import customFieldsRoutes from './routes/custom-fields.routes'
import defaultFieldOrderRoutes from './routes/default-field-order.routes'
import setupStatusRoutes from './routes/setup-status.routes'
import assignmentsRoutes from './routes/assignments.routes'
import examsRoutes from './routes/exams.routes'
import studentDashboardRoutes from './routes/student-dashboard.routes'
import parentDashboardRoutes from './routes/parent-dashboard.routes'
import learningResourcesRoutes from './routes/learning-resources.routes'

const app = express()

// Trust proxy - Important for cPanel deployments
app.set('trust proxy', 1)

// Comprehensive CORS Headers - Works across all browsers
app.use((req: Request, res: Response, next: NextFunction) => {
  // Get allowed origins from config
  const allowedOrigins = config.cors.origins || ['http://localhost:3000', 'http://localhost:30001']
  const requestOrigin = req.headers.origin
  
  // Check if the request origin is allowed
  const allowedOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0]
  
  // Set universal CORS headers that work with all browsers
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, X-JSON-Response-Count')
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Accept-Language, Content-Language, Content-Type, Authorization, X-Requested-With, X-API-Key, Origin')
  res.setHeader('Access-Control-Max-Age', '86400')
  res.setHeader('Vary', 'Origin')

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', `ALLOW-FROM ${allowedOrigin}`)
  res.setHeader('X-XSS-Protection', '1; mode=block')

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  next()
})

// Old CORS package - removed to avoid conflicts
// app.use(cors({...})) - Replaced with headers above

// Request timeout middleware (30 seconds)
app.use((req: Request, res: Response, next: NextFunction) => {
  // Set timeout for all requests
  req.setTimeout(30000) // 30 seconds
  res.setTimeout(30000)

  // Set a timer to handle timeout
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error(`⏱️ Request timeout: ${req.method} ${req.path}`)
      res.status(504).json({
        success: false,
        error: 'Request timeout - operation took too long'
      })
    }
  }, 30000)

  // Clear timeout when response finishes
  res.on('finish', () => clearTimeout(timeout))
  res.on('close', () => clearTimeout(timeout))

  next()
})

// CORS headers are already set above - don't use cors package to avoid conflicts

// Increase body size limit for file uploads (assignments with attachments)
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  // Only log errors in production, all requests in development
  // Request logging disabled for performance
  next()
})

// Health check endpoint (no auth required)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  })
})

// Debug endpoints disabled in production

// API status endpoint (no auth required)
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    message: 'Studently API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

// Root route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Studently School Management API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      schools: '/api/schools',
      dashboard: '/api/dashboard',
      schoolDashboard: '/api/school-dashboard',
      students: '/api/students',
      parents: '/api/parents',
      events: '/api/events',
      library: '/api/library',
      academics: '/api/academics',
      teachers: '/api/teachers',
      timetable: '/api/timetable'
    }
  })
})

// Helper to register routes at both /api/path and /path for flexibility
const registerRoutes = (path: string, router: any) => {
  app.use(`/api${path}`, router)  // Standard: /api/academics, /api/schools, etc.
  app.use(path, router)            // cPanel/Root: /academics, /schools, etc.
}

// Register all routes using helper for dual-path support
registerRoutes('/schools', schoolRoutes)
registerRoutes('/dashboard', dashboardRoutes)
registerRoutes('/school-dashboard', schoolDashboardRoutes)
registerRoutes('/students', studentRoutes)
registerRoutes('/parents', parentRoutes)
registerRoutes('/events', eventRoutes)
registerRoutes('/library', libraryRoutes)
registerRoutes('/academics', academicsRoutes)
registerRoutes('/teachers', teacherRoutes)
registerRoutes('/timetable', timetableRoutes)
registerRoutes('/fees', feesRoutes)
registerRoutes('/salary', salaryRoutes)
registerRoutes('/school-services', schoolServicesRoutes)
registerRoutes('/staff', staffRoutes)
registerRoutes('/custom-fields', customFieldsRoutes)
registerRoutes('/default-field-orders', defaultFieldOrderRoutes)
registerRoutes('/setup', setupStatusRoutes)
registerRoutes('/assignments', assignmentsRoutes)
registerRoutes('/exams', examsRoutes)
registerRoutes('/learning-resources', learningResourcesRoutes)
registerRoutes('/student-dashboard', studentDashboardRoutes)
registerRoutes('/parent-dashboard', parentDashboardRoutes)

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  })
})

// Global error handler
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  console.error('Global error handler:', err)

  // Prevent sending multiple responses
  if (res.headersSent) {
    return next(err)
  }

  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined
  })
})

// Start server
const PORT = config.port

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  // Don't exit process, just log the error
})

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error)
  // Log but don't exit immediately to allow graceful shutdown
})

app.listen(PORT, () => {
  console.log('=================================')
  console.log('🚀 Studently Backend API')
  console.log('=================================')
  console.log(`📡 Server: http://localhost:${PORT}`)
  console.log(`🌍 Environment: ${config.nodeEnv}`)
  console.log(`🔗 Frontend: ${config.frontend.url}`)
  console.log('=================================')
  
  // Initialize automated cron jobs for payroll
  console.log('\n⏰ Starting automated services...')
  cronService.init()
  console.log('=================================\n')
})

export default app
