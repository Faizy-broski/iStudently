import { Router } from 'express'
import * as roomsController from '../controllers/rooms.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Rooms addressed by id must belong to the caller's school family.
const roomRow = requireRowInSchoolFamily('rooms')

// ============================================================================
// ROOMS CRUD
// ============================================================================

// GET /rooms                        - List rooms for school/campus
router.get('/', roomsController.getRooms)

// GET /rooms/check-availability     - Check room availability at a slot
router.get('/check-availability', roomsController.checkRoomAvailability)

// GET /rooms/:id                    - Get room by ID
router.get('/:id', roomRow, roomsController.getRoomById)

// POST /rooms                       - Create room (admin)
router.post('/', requireAdmin, roomsController.createRoom)

// PUT /rooms/:id                    - Update room (admin)
router.put('/:id', requireAdmin, roomRow, roomsController.updateRoom)

// DELETE /rooms/:id                 - Delete room (admin)
router.delete('/:id', requireAdmin, roomRow, roomsController.deleteRoom)

export default router
