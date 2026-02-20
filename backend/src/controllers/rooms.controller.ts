import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as roomsService from '../services/rooms.service'
import type { CreateRoomDTO, UpdateRoomDTO } from '../types/scheduling.types'

// ============================================================================
// ROOMS CONTROLLER
// ============================================================================

export const getRooms = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const campusId = req.query.campus_id as string | undefined
    const activeOnly = req.query.active_only !== 'false'

    const result = await roomsService.getRooms(schoolId, campusId, activeOnly)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getRoomById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await roomsService.getRoomById(id)
    if (!result.success) return res.status(404).json(result)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createRoom = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const userId = (req as AuthRequest).user?.id
    const dto: CreateRoomDTO = req.body

    const result = await roomsService.createRoom(schoolId, dto, userId)
    if (!result.success) return res.status(400).json(result)
    res.status(201).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const dto: UpdateRoomDTO = req.body

    const result = await roomsService.updateRoom(id, dto)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await roomsService.deleteRoom(id)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const checkRoomAvailability = async (req: Request, res: Response) => {
  try {
    const roomId = req.query.room_id as string
    const dayOfWeek = parseInt(req.query.day_of_week as string)
    const periodId = req.query.period_id as string
    const academicYearId = req.query.academic_year_id as string
    const excludeEntryId = req.query.exclude_entry_id as string | undefined

    if (!roomId || isNaN(dayOfWeek) || !periodId || !academicYearId) {
      return res.status(400).json({ success: false, error: 'room_id, day_of_week, period_id, academic_year_id required' })
    }

    const result = await roomsService.checkRoomAvailability(roomId, dayOfWeek, periodId, academicYearId, excludeEntryId)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}
