import { reportQuerySchema } from "../types/index";
import { ReportService } from "../services/report.service";

export class ReportController {
  static async generate(req, res) {
    const query = reportQuerySchema.parse(req.query);
    const data = await ReportService.generate(query);
    res.json(data);
  }
}
