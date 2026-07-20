import { Router } from 'express'
import * as ctrl from '../controllers/jitsi-room.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()
router.use(authenticate)

router.post('/', ctrl.createRoom)
router.get('/mine', ctrl.listMyRooms)
router.get('/:id', ctrl.getRoom)
router.put('/:id', ctrl.updateRoom)
router.delete('/:id', ctrl.deleteRoom)

router.get('/:id/whiteboard', ctrl.getWhiteboardSnapshot)
router.put('/:id/whiteboard', ctrl.saveWhiteboardSnapshot)

export default router
