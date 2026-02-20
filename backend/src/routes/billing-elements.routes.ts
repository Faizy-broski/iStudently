import { Router, Response } from 'express'
import { billingElementsService } from '../services/billing-elements.service'
import { authenticate, AuthRequest } from '../middlewares/auth.middleware'

const router = Router()
router.use(authenticate)

// ============================================================================
// CATEGORIES
// ============================================================================

router.get('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const data = await billingElementsService.getCategories(schoolId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching billing categories:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const { title, sort_order } = req.body
    if (!title) return res.status(400).json({ success: false, error: 'Title is required' })

    const data = await billingElementsService.createCategory({
      school_id: schoolId,
      title,
      sort_order: sort_order ?? 0
    })
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error creating billing category:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/categories/:id', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const { id } = req.params
    const data = await billingElementsService.updateCategory(id, schoolId, req.body)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating billing category:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/categories/:id', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    await billingElementsService.deleteCategory(req.params.id, schoolId)
    res.json({ success: true, message: 'Category deleted' })
  } catch (error: any) {
    console.error('Error deleting billing category:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================================================
// ELEMENTS
// ============================================================================

router.get('/elements', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const categoryId = req.query.category_id as string | undefined
    const data = await billingElementsService.getElements(schoolId, categoryId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching billing elements:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/elements/:id', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const data = await billingElementsService.getElementById(req.params.id, schoolId)
    if (!data) return res.status(404).json({ success: false, error: 'Element not found' })
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching billing element:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/elements', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const { category_id, title, amount, course_period_section_id, course_period_subject_id, grade_level_id, comment, sort_order } = req.body
    if (!category_id || !title) {
      return res.status(400).json({ success: false, error: 'Category and title are required' })
    }

    const data = await billingElementsService.createElement({
      school_id: schoolId,
      category_id,
      title,
      amount: amount || 0,
      course_period_section_id: course_period_section_id || null,
      course_period_subject_id: course_period_subject_id || null,
      grade_level_id: grade_level_id || null,
      comment: comment || null,
      sort_order: sort_order ?? 0
    })
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error creating billing element:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/elements/:id', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const data = await billingElementsService.updateElement(req.params.id, schoolId, req.body)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating billing element:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/elements/:id', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    await billingElementsService.deleteElement(req.params.id, schoolId)
    res.json({ success: true, message: 'Element deleted' })
  } catch (error: any) {
    console.error('Error deleting billing element:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================================================
// STUDENT BILLING ELEMENTS
// ============================================================================

router.get('/student-elements', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const { student_id, status, category_id, from_date, to_date } = req.query as any
    const data = await billingElementsService.getStudentElements(schoolId, student_id, {
      status, category_id, from_date, to_date
    })
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching student elements:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/student-elements', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const { student_id, billing_element_id, element_title, amount, due_date, comment } = req.body
    if (!student_id || !element_title) {
      return res.status(400).json({ success: false, error: 'Student ID and element title are required' })
    }

    const data = await billingElementsService.assignElement({
      school_id: schoolId,
      student_id,
      billing_element_id: billing_element_id || null,
      element_title,
      amount: amount || 0,
      due_date: due_date || null,
      comment: comment || null
    })
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error assigning element:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/student-elements/mass-assign', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const { student_ids, billing_element_id, element_title, amount, due_date, comment } = req.body
    if (!student_ids?.length || !element_title) {
      return res.status(400).json({ success: false, error: 'Student IDs and element title are required' })
    }

    const data = await billingElementsService.massAssignElement({
      school_id: schoolId,
      student_ids,
      billing_element_id: billing_element_id || null,
      element_title,
      amount: amount || 0,
      due_date: due_date || null,
      comment: comment || null
    })
    res.json({ success: true, data, count: data.length })
  } catch (error: any) {
    console.error('Error mass assigning elements:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/student-elements/:id', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const data = await billingElementsService.updateStudentElement(req.params.id, schoolId, req.body)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating student element:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/student-elements/:id', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    await billingElementsService.deleteStudentElement(req.params.id, schoolId)
    res.json({ success: true, message: 'Student element deleted' })
  } catch (error: any) {
    console.error('Error deleting student element:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================================================
// TRANSACTIONS
// ============================================================================

router.post('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const { student_billing_element_id, student_id, amount, transaction_date, payment_method, comment } = req.body
    if (!student_billing_element_id || !student_id || !amount) {
      return res.status(400).json({ success: false, error: 'Element ID, student ID, and amount are required' })
    }

    const data = await billingElementsService.recordTransaction({
      school_id: schoolId,
      student_billing_element_id,
      student_id,
      amount,
      transaction_date,
      payment_method,
      comment,
      created_by: req.profile?.id
    })
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error recording transaction:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const { from_date, to_date, category_id, student_id } = req.query as any
    const data = await billingElementsService.getTransactions(schoolId, {
      from_date, to_date, category_id, student_id
    })
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching transactions:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================================================
// REPORTS
// ============================================================================

router.get('/reports/category-breakdown', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const { category_id, from_date, to_date, breakdown_by_grade, metric } = req.query as any
    const data = await billingElementsService.getCategoryBreakdown(schoolId, {
      category_id,
      from_date,
      to_date,
      breakdown_by_grade: breakdown_by_grade === 'true',
      metric: metric || 'number'
    })
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching category breakdown:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================================================
// STUDENTS (for mass assign dropdown)
// ============================================================================

router.get('/students', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

    const { grade_id, section_id } = req.query as any
    const data = await billingElementsService.getStudentsByGradeAndSection(schoolId, grade_id, section_id)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching students:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
