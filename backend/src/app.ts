import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { config } from './config/env'
import schoolRoutes from './routes/school.routes'
import dashboardRoutes from './routes/dashboard.routes'

const app = express()

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

// Middleware
app.use(cors({
  origin: config.frontend.url,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// Routes
app.use('/api/schools', schoolRoutes)
app.use('/api/dashboard', dashboardRoutes)

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Studently Backend API is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  })
})

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Studently School Management API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      schools: '/api/schools'
    }
  })
})

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  })
})

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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
})

export default app
