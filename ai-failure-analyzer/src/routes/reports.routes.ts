import { Router } from 'express';
import { deleteReport, getReport, listReports } from '../services/reports.service.js';
import { ApiError } from '../middleware/error.middleware.js';

export const reportsRouter = Router();

reportsRouter.get('/reports', async (_req, res, next) => {
  try {
    res.json({ reports: await listReports() });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get('/reports/:id', async (req, res, next) => {
  try {
    const report = await getReport(req.params.id);
    if (!report) throw new ApiError(404, 'Report not found');
    res.json(report);
  } catch (err) {
    next(err);
  }
});

reportsRouter.delete('/reports/:id', async (req, res, next) => {
  try {
    await deleteReport(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
