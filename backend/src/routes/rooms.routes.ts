import { Router } from 'express'
import * as roomsController from '../controllers/rooms.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// ROOMS CRUD
// ============================================================================

// GET /rooms                        - List rooms for school/campus
router.get('/', roomsController.getRooms)

// GET /rooms/check-availability     - Check room availability at a slot
router.get('/check-availability', roomsController.checkRoomAvailability)

// GET /rooms/:id                    - Get room by ID
router.get('/:id', roomsController.getRoomById)

// POST /rooms                       - Create room (admin)
router.post('/', requireAdmin, roomsController.createRoom)

// PUT /rooms/:id                    - Update room (admin)
router.put('/:id', requireAdmin, roomsController.updateRoom)

// DELETE /rooms/:id                 - Delete room (admin)
router.delete('/:id', requireAdmin, roomsController.deleteRoom)

export default router
