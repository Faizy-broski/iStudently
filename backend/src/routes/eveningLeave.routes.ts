import { Router } from 'express';
import { EveningLeaveService } from '../services/eveningLeave.service';

const router = Router();

router.post('/', async (req, res) => {
  const leave = await EveningLeaveService.create(req.body);
  res.status(201).json(leave);
});

router.get('/', async (req, res) => {
  const data = await EveningLeaveService.getActive(req.query.date as string);
  res.json(data);
});

export default router;
