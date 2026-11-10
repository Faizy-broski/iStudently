import { Router } from 'express'
import * as ctrl from '../controllers/jitsi-room.controller'
import { authenticate, AuthRequest } from '../middlewares/auth.middleware'
import type { NextFunction, Response } from 'express'

const router = Router()
router.use(authenticate)

// Students and parents join rooms; they do not create them.
const notLearnerOrParent = (req: AuthRequest, res: Response, next: NextFunction) =>
  req.profile?.role === 'student' || req.profile?.role === 'parent' ? res.status(403).json({ data: null, error: 'Not allowed' }) : next()

router.post('/', notLearnerOrParent, ctrl.createRoom)
router.get('/mine', ctrl.listMyRooms)
router.get('/school', ctrl.listSchoolRooms)
router.get('/:id', ctrl.getRoom)
router.put('/:id', ctrl.updateRoom)
router.delete('/:id', ctrl.deleteRoom)

router.get('/:id/whiteboard', ctrl.getWhiteboardSnapshot)
router.put('/:id/whiteboard', ctrl.saveWhiteboardSnapshot)

export default router
