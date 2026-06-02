import { Request, Response } from 'express';
import * as quotesService from '../services/quotes.service';

export class QuotesController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const data = await quotesService.getAllQuotes();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const data = await quotesService.getQuoteSettings();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getCurrent(req: Request, res: Response): Promise<void> {
    try {
      const data = await quotesService.getCurrentQuote();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { text_en, text_ar, sort_order, is_active } = req.body;
      if (!text_en?.trim() || !text_ar?.trim()) {
        res.status(400).json({ success: false, error: 'text_en and text_ar are required' });
        return;
      }
      const data = await quotesService.createQuote({ text_en, text_ar, sort_order, is_active });
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { text_en, text_ar, sort_order, is_active } = req.body;
      const data = await quotesService.updateQuote(id, { text_en, text_ar, sort_order, is_active });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await quotesService.deleteQuote(id);
      res.json({ success: true, data: { deleted: true } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async reorder(req: Request, res: Response): Promise<void> {
    try {
      const { ordered_ids } = req.body;
      if (!Array.isArray(ordered_ids)) {
        res.status(400).json({ success: false, error: 'ordered_ids must be an array' });
        return;
      }
      await quotesService.reorderQuotes(ordered_ids);
      res.json({ success: true, data: { reordered: true } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const { rotation } = req.body;
      if (!['weekly', 'monthly'].includes(rotation)) {
        res.status(400).json({ success: false, error: 'rotation must be weekly or monthly' });
        return;
      }
      const data = await quotesService.updateQuoteSettings(rotation);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export const quotesController = new QuotesController();
