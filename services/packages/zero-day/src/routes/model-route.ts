/**
 * POST /api/route
 * Returns the best model for a given task profile (for AVERI gateway / model arbitrage callers).
 */
import express, { Router, Request, Response } from 'express';
import { ModelRouter, type TaskProfile } from '../utils/model-router.js';

const router: Router = express.Router();
const VALID_PROFILES: TaskProfile[] = ['fast_extraction', 'creative_synthesis', 'legal_reasoning'];

router.post('/', (req: Request, res: Response) => {
    const profile: TaskProfile =
        req.body?.profile && VALID_PROFILES.includes(req.body.profile)
            ? req.body.profile
            : 'creative_synthesis';
    const model = ModelRouter.resolve(profile);
    return res.json({ model, profile });
});

export default router;

