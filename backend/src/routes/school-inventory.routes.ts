import { Router } from 'express'
import { SchoolInventoryController } from '../controllers/school-inventory.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
const controller = new SchoolInventoryController()

router.use(authenticate)

// ---- Categories ----

router.get('/categories', (req, res) => controller.listCategories(req, res))
router.put('/categories/bulk-save', requireRole('admin'), (req, res) => controller.bulkSaveCategories(req, res))
router.post('/categories', requireRole('admin'), (req, res) => controller.createCategory(req, res))
router.put('/categories/:id', requireRole('admin'), (req, res) => controller.updateCategory(req, res))
router.delete('/categories/:id', requireRole('admin'), (req, res) => controller.deleteCategory(req, res))

// ---- Items ----

router.get('/items', (req, res) => controller.listItems(req, res))
router.get('/items/:id', (req, res) => controller.getItem(req, res))
router.put('/items/bulk-save', requireRole('admin'), (req, res) => controller.bulkSaveItems(req, res))
router.post('/items', requireRole('admin'), (req, res) => controller.createItem(req, res))
router.put('/items/:id', requireRole('admin'), (req, res) => controller.updateItem(req, res))
router.delete('/items/:id', requireRole('admin'), (req, res) => controller.deleteItem(req, res))

// ---- Snapshots ----

router.get('/snapshots', (req, res) => controller.listSnapshots(req, res))
router.get('/snapshots/:id', (req, res) => controller.getSnapshot(req, res))
router.post('/snapshots', requireRole('admin'), (req, res) => controller.createSnapshot(req, res))
router.delete('/snapshots/:id', requireRole('admin'), (req, res) => controller.deleteSnapshot(req, res))

export default router
