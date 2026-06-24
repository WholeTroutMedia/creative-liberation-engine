import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';
import { trackEvent } from '../analytics/posthog.js';

const router: express.Router = express.Router();


// Ensure staging paths exist
const LABS_STAGING_ROOT = path.join(process.cwd(), '../../_assets/labs');
const STAGING_DIRS = {
    visual: path.join(LABS_STAGING_ROOT, 'visual'),
    structural: path.join(LABS_STAGING_ROOT, 'structural'),
    spatial: path.join(LABS_STAGING_ROOT, 'spatial')
};

Object.values(STAGING_DIRS).forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Setup Multer for file drops
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Default to structural if none provided
        const vector = (req.body.vector as keyof typeof STAGING_DIRS) || 'structural';
        const destDir = STAGING_DIRS[vector] || STAGING_DIRS.structural;
        cb(null, destDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        cb(null, `${name}_${Date.now()}${ext}`);
    }
});

const upload = multer({ storage });

/**
 * POST /api/intake/labs
 * Accepts files from Google Labs tools (Mixboard images, NotebookLM markdown, etc.)
 * Routes them to their targeted staging director for Creative Liberation Engine workflows.
 */
router.post('/', upload.single('artifact'), (req: Request, res: Response) => {
    try {
        const { client_email, client_name, vector, notes } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No artifact file provided.' });
        }

        // Trigger telemetry
        const email = client_email || 'anonymous-lab-intake@zeroday.io';
        trackEvent(email, 'labs_artifact_ingested', { 
            client_name: client_name || 'Anonymous',
            vector: vector || 'unknown',
            filename: file.filename,
            size: file.size
        });

        console.log(`[ZERO-DAY] Labs Artifact Ingested: ${file.filename} -> ${vector}`);

        return res.json({
            success: true,
            message: 'Artifact ingested successfully.',
            staged_at: file.path,
            vector: vector,
            trigger_command: `/labs-ingest`
        });

    } catch (e: unknown) {
        console.error('[ZERO-DAY] Labs intake failed:', e);
        return res.status(500).json({ error: (e as Error).message });
    }
});

export default router;
