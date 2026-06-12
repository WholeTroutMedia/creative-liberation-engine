import { buildIdeationEmailHtml } from './src/email-dispatcher';
import * as fs from 'fs';
import * as path from 'path';

const mockManifest = {
    jobId: 'IE-IDX-9824',
    sourceArticle: {
        title: 'The Future of Spatial Computing in Web Design',
        url: 'https://flipboard.com/@curator/tech-future',
        excerpt: 'Spatial computing is moving beyond headsets. It is reshaping how we build 2D web interfaces by introducing depth, physics, and new interactive paradigms that break the flat-screen mold.',
    },
    categories: ['Design', 'Technology', 'UI/UX'],
    athenaOutput: {
        strategicContext: 'Exploring how 3D interfaces map to modern web capabilities.',
        options: [
            {
                title: 'Depth-First Navigation Structures',
                description: 'Implement z-axis navigation menus where depth dictates hierarchy. As users scroll, primary elements remain in the foreground while secondary elements recede, creating an intuitive, physics-based UI that mimics real-world object permanence.',
                tradeoffs: 'Higher rendering cost, potential accessibility issues with screen readers navigating the z-axis context.',
                recommendation: 'preferred',
                realWorldExamples: [
                    'Apple Vision Pro window management applied to standard web viewports.',
                    'Stripe’s animated global navigation that simulates depth and physical cards.'
                ],
                implementationDetails: 'Use CSS `transform: translateZ` paired with Intersection Observers to manage depth on scroll. A lightweight Three.js wrapper can provide smoother physics for the interactive elements without fully committing to WebGL for the entire site.'
            },
            {
                title: 'Spatially Aware Notifications',
                description: 'Notifications that do not just pop up, but enter the viewport from contextual origins (e.g., sliding out from the relevant data point rather than the screen corner).',
                tradeoffs: 'Complex to calculate origin points dynamically on fluid responsive layouts.',
                recommendation: 'viable',
                realWorldExamples: [
                    'Figma multiplayer cursors and contextual comment popovers.',
                    'Linear’s command-k menu that physically overlays the active context.'
                ],
                implementationDetails: 'Compute bounding client rects of the trigger element and use Framer Motion for spring-physics based entry and exit animations. Fallback to standard absolute positioning if calculation fails.'
            }
        ]
    }
};

const mockCrossRefs = [
    {
        jobId: 'IE-IDX-1234',
        topic: 'Spatial Design Systems',
        relevanceScore: 0.92,
        notes: 'Aligns with our V6 spatial UI goals.',
        url: 'https://flipboard.com/xyz'
    },
    {
        jobId: 'IE-IDX-5678',
        topic: 'WebGL Performance',
        relevanceScore: 0.85,
        notes: 'Critical to monitor if we adopt z-axis scrolling.',
        url: 'https://flipboard.com/abc'
    }
];

const html = buildIdeationEmailHtml(mockManifest as any, mockCrossRefs as any);

const outPath = path.join(process.cwd(), 'test-email-output.html');
fs.writeFileSync(outPath, html, 'utf-8');
console.log('HTML generated at', outPath);
