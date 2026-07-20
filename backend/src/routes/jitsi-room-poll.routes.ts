import { Router } from 'express'
import * as ctrl from '../controllers/jitsi-room-poll.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/room/:roomId', ctrl.listPollsForRoom)
router.post('/room/:roomId', ctrl.launchPoll)
router.post('/:pollId/close', ctrl.closePoll)
router.post('/:pollId/responses', ctrl.submitPollResponse)
router.get('/:pollId/results', ctrl.getPollResults)

export default router
