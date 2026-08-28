import { Router } from 'express'
import * as ctrl from '../../controllers/fina/post.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { finaEnforceScope } from '../../middlewares/fina-enforce-scope.middleware'
import { requireRole } from '../../middlewares/role.middleware'

const router = Router()
// super_admin (the platform vendor's own cross-school account) deliberately
// excluded from every role below — spec §12's permission matrix gives
// SYSADMIN zero content access (Publish/Approve/Comment all ❌), unlike this
// platform's usual "super_admin can do what admin can do" convention.
const COMPOSE_ROLES = ['teacher', 'admin', 'media_officer'] as const
const REVIEWER_ROLES = ['media_officer'] as const
const PRINCIPAL_ROLES = ['admin'] as const

router.use(authenticate)
router.use(finaEnforceScope)

// Literal-segment routes before the generic '/:id/...' routes below.
router.get('/wall', ctrl.listWall)
router.get('/composer-options', requireRole(...COMPOSE_ROLES), ctrl.getComposerOptions)
router.get('/mine', requireRole(...COMPOSE_ROLES), ctrl.listMyPosts)
router.get('/review-queue', requireRole(...REVIEWER_ROLES), ctrl.listReviewQueue)
router.get('/approval-queue', requireRole(...PRINCIPAL_ROLES), ctrl.listApprovalQueue)
router.get('/post-hoc-review-queue', requireRole(...REVIEWER_ROLES, ...PRINCIPAL_ROLES), ctrl.listPostHocReviewQueue)
router.post('/', requireRole(...COMPOSE_ROLES), ctrl.createPost)

router.get('/:id', ctrl.getPostDetail)
router.patch('/:id', requireRole(...COMPOSE_ROLES), ctrl.updatePost)
router.delete('/:id', ctrl.deletePost) // role check done in the service (author-while-draft, principal any time)
router.post('/:id/submit', requireRole(...COMPOSE_ROLES), ctrl.submitPost)
router.post('/:id/review', requireRole(...REVIEWER_ROLES), ctrl.reviewPost)
router.post('/:id/approve', requireRole(...PRINCIPAL_ROLES), ctrl.approvePost)
router.post('/:id/reject-approval', requireRole(...PRINCIPAL_ROLES), ctrl.rejectApproval)
router.post('/:id/post-hoc-review', requireRole(...REVIEWER_ROLES, ...PRINCIPAL_ROLES), ctrl.acknowledgePostHocReview)
router.post('/:id/pin', requireRole(...PRINCIPAL_ROLES), ctrl.pinPost)

router.post('/:id/reactions', ctrl.setReaction)
router.delete('/:id/reactions', ctrl.removeReaction)
router.get('/:id/comments', ctrl.listComments)
router.post('/:id/comments', ctrl.addComment)
router.post('/comments/:commentId/moderate', ctrl.moderateComment)

export default router
