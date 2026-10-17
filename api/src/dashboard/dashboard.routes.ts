import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { getDashboard } from '../items/items.queries';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const teamIds = Array.from(user.memberships.keys());
    const leadAdminTeamIds = Array.from(user.memberships.entries())
      .filter(([, role]) => role === 'lead' || role === 'admin')
      .map(([teamId]) => teamId);

    const data = await getDashboard(user.id, teamIds, leadAdminTeamIds);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export { router as dashboardRoutes };