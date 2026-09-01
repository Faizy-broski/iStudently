import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { quranReferenceService } from '../../services/quran/quran-reference.service'
import { supabase } from '../../config/supabase'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('not found') || msg.includes('Unknown') ? 404 : msg.includes('requires') ? 400 : 500
  return res.status(status).json({ success: false, error: msg })
}

export const listRiwayat = async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase.from('quran_riwayat').select('*').eq('is_active', true).order('sort_order')
    if (error) throw new Error(error.message)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listEditions = async (req: AuthRequest, res: Response) => {
  try {
    const riwayahCode = req.query.riwayah as string | undefined
    let query = supabase.from('quran_editions').select('*, quran_riwayat!inner(code)').eq('is_active', true)
    if (riwayahCode) query = query.eq('quran_riwayat.code', riwayahCode)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const resolveRange = async (req: AuthRequest, res: Response) => {
  try {
    const { riwayah, unitType, number, editionCode, startSurah, startAyah, endSurah, endAyah } = req.query as Record<string, string>
    const range = await quranReferenceService.resolveRange(riwayah, {
      unitType: unitType as any,
      number: number ? Number(number) : undefined,
      editionCode,
      startAyah: startSurah && startAyah ? { surahNumber: Number(startSurah), ayahNumber: Number(startAyah) } : undefined,
      endAyah: endSurah && endAyah ? { surahNumber: Number(endSurah), ayahNumber: Number(endAyah) } : undefined,
    })
    return res.json({ success: true, data: range })
  } catch (error: any) { return handleError(res, error) }
}

export const ayatOnPage = async (req: AuthRequest, res: Response) => {
  try {
    const data = await quranReferenceService.ayatOnPage(req.params.edition, Number(req.params.page))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const ayahsInRange = async (req: AuthRequest, res: Response) => {
  try {
    const { riwayah, start, end } = req.query as Record<string, string>
    const data = await quranReferenceService.ayahsInRange(riwayah, { riwayahCode: riwayah, startAyahId: start, endAyahId: end })
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const similarPassages = async (req: AuthRequest, res: Response) => {
  try {
    const { riwayah, surah, ayah } = req.query as Record<string, string>
    const data = await quranReferenceService.similarPassagesFor(riwayah, { surahNumber: Number(surah), ayahNumber: Number(ayah) })
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
