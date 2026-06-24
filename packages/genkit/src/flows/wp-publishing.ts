/**
 * WP MCP + Agentic Memory — Publishing Framework
 * Connects the Creative Liberation Engine's deep memory to WordPress.com for
 * autonomous content drafting, scheduling, and monetization.
 *
 * Capabilities:
 *  - Pull relevant memory context via memoryBus (SCRIBE / KEEPER)
 *  - Draft posts informed by engine's institutional knowledge
 *  - Publish / schedule / update via WordPress.com REST API (v2)
 *  - Register as Genkit tools so any agent can invoke them directly
 *
 * Auth: WordPress.com OAuth 2.1 token stored in Vault or WP_ACCESS_TOKEN env var.
 * Site: Configured via WP_SITE_ID env var (numeric ID or site URL slug).
 *
 * REST base: https://public-api.wordpress.com/rest/v1.2/sites/{site}
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import { memoryBus } from '@cle/memory';

// ── Config ────────────────────────────────────────────────────────────────────

const WP_BASE = 'https://public-api.wordpress.com/rest/v1.2/sites';
const SITE_ID = process.env.WP_SITE_ID ?? '';

function wpHeaders(): Record<string, string> {
    const token = process.env.WP_ACCESS_TOKEN ?? '';
    if (!token) throw new Error('[wp-publishing] WP_ACCESS_TOKEN is not set — add it to .env or the Vault');
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

async function wpFetch(path: string, options: RequestInit = {}): Promise<unknown> {
    if (!SITE_ID) throw new Error('[wp-publishing] WP_SITE_ID is not set');
    const url = `${WP_BASE}/${SITE_ID}${path}`;
    const res = await fetch(url, { ...options, headers: { ...wpHeaders(), ...(options.headers as Record<string, string> ?? {}) } });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`WP API error ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json();
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const DraftPostInput = z.object({
    title:   z.string().describe('Post title'),
    topic:   z.string().describe('Topic or angle to write about — memory context is pulled automatically'),
    tags:    z.array(z.string()).default([]).describe('Tag slugs to apply'),
    categories: z.array(z.string()).default([]).describe('Category slugs to apply'),
    format:  z.enum(['standard', 'aside', 'gallery', 'link', 'image', 'quote', 'status', 'video', 'audio', 'chat'])
               .default('standard'),
    tone:    z.string().default('professional').describe('Voice/tone: professional, casual, technical, narrative'),
    wordCount: z.number().default(600).describe('Target word count'),
    sessionId: z.string().optional(),
});

const PostRecord = z.object({
    id:     z.number(),
    title:  z.string(),
    status: z.string(),
    url:    z.string(),
    excerpt: z.string().optional(),
    date:   z.string(),
});

const PublishPostInput = z.object({
    postId: z.number().describe('Draft post ID returned from draft_post or list_posts'),
    scheduledDate: z.string().optional().describe('ISO-8601 future date to schedule — omit for immediate publish'),
});

const ListPostsInput = z.object({
    status: z.enum(['publish', 'draft', 'scheduled', 'trash', 'any']).default('draft'),
    number: z.number().default(10),
    search: z.string().optional(),
});

const UpdatePostInput = z.object({
    postId:  z.number(),
    title:   z.string().optional(),
    content: z.string().optional(),
    status:  z.enum(['publish', 'draft', 'scheduled', 'private']).optional(),
    tags:    z.array(z.string()).optional(),
});

// ── Genkit Tools (callable by any agent) ─────────────────────────────────────

/**
 * draft_post — pull memory context, generate post content, save as WP draft.
 * The memory retrieval gives the post institutional grounding in the engine's knowledge.
 */
export const draftPostTool = ai.defineTool(
    {
        name:        'draft_post',
        description: 'Draft a WordPress post grounded in the engine\'s agentic memory. Returns the post ID and URL.',
        inputSchema:  DraftPostInput,
        outputSchema: PostRecord,
    },
    async (input) => {
        console.log(`[wp-publishing] Drafting post: "${input.title}"`);

        // Pull relevant engine memory for context richness
        const memories = await memoryBus.recall({
            query:       `${input.title} ${input.topic}`,
            tags:        ['knowledge', 'done', input.topic],
            limit:       8,
            successOnly: false,
        });

        const memoryContext = memories.length > 0
            ? memories.map(m => `• ${m.pattern ?? m.task}`).join('\n')
            : 'No prior engine knowledge on this topic — writing from scratch.';

        // Generate post content with Gemini
        const { text: content } = await ai.generate({
            model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
            system: `You are a professional content author for the Creative Liberation Engine publication.
Write high-quality, SEO-optimized WordPress posts. Use proper heading hierarchy (H2, H3).
Never use filler phrases. Be direct, informed, and authoritative.
Tone: ${input.tone}. Target length: ~${input.wordCount} words.
Format the output as clean HTML suitable for WordPress (use <h2>, <h3>, <p>, <ul>, <strong>).
Do NOT include an <h1> — the title is set separately.`,
            prompt: `Write a ${input.tone} post titled "${input.title}" covering: ${input.topic}

Engine knowledge context (use these insights where relevant):
${memoryContext}

Produce the full post body as HTML. Include:
- An engaging opening paragraph
- 2-3 H2 sections with supporting detail
- A concrete takeaway or CTA closing paragraph`,
            config: { temperature: 0.4, maxOutputTokens: 2000 },
        });

        // Save as WordPress draft
        const wpPost = await wpFetch('/posts/new', {
            method:  'POST',
            body:    JSON.stringify({
                title:      input.title,
                content:    content ?? '',
                status:     'draft',
                format:     input.format,
                tags:       input.tags.join(','),
                categories: input.categories.join(','),
            }),
        }) as any;

        console.log(`[wp-publishing] Draft created: ID=${wpPost.ID} URL=${wpPost.URL}`);

        return {
            id:      wpPost.ID,
            title:   wpPost.title,
            status:  wpPost.status,
            url:     wpPost.URL,
            excerpt: wpPost.excerpt,
            date:    wpPost.date,
        };
    }
);

/**
 * publish_post — publish or schedule a draft post.
 */
export const publishPostTool = ai.defineTool(
    {
        name:        'publish_post',
        description: 'Publish an existing WordPress draft immediately or schedule it for a future date.',
        inputSchema:  PublishPostInput,
        outputSchema: PostRecord,
    },
    async (input) => {
        const body: Record<string, string> = {
            status: input.scheduledDate ? 'future' : 'publish',
        };
        if (input.scheduledDate) body.date = input.scheduledDate;

        const wpPost = await wpFetch(`/posts/${input.postId}`, {
            method: 'POST',
            body:   JSON.stringify(body),
        }) as any;

        console.log(`[wp-publishing] Post ${input.postId} ${body.status === 'future' ? `scheduled for ${input.scheduledDate}` : 'published'}`);

        return {
            id:      wpPost.ID,
            title:   wpPost.title,
            status:  wpPost.status,
            url:     wpPost.URL,
            excerpt: wpPost.excerpt,
            date:    wpPost.date,
        };
    }
);

/**
 * list_posts — query existing WP posts.
 */
export const listPostsTool = ai.defineTool(
    {
        name:        'list_posts',
        description: 'List WordPress posts by status (draft, publish, scheduled, etc.).',
        inputSchema:  ListPostsInput,
        outputSchema: z.object({ posts: z.array(PostRecord), found: z.number() }),
    },
    async (input) => {
        const params = new URLSearchParams({
            status: input.status,
            number: String(input.number),
            fields: 'ID,title,status,URL,excerpt,date',
            ...(input.search ? { search: input.search } : {}),
        });

        const data = await wpFetch(`/posts?${params}`) as any;

        return {
            posts: (data.posts ?? []).map((p: any) => ({
                id:      p.ID,
                title:   p.title,
                status:  p.status,
                url:     p.URL,
                excerpt: p.excerpt,
                date:    p.date,
            })),
            found: data.found ?? 0,
        };
    }
);

/**
 * update_post — patch an existing post (content, tags, status).
 */
export const updatePostTool = ai.defineTool(
    {
        name:        'update_post',
        description: 'Update an existing WordPress post — title, content, status, or tags.',
        inputSchema:  UpdatePostInput,
        outputSchema: PostRecord,
    },
    async (input) => {
        const body: Record<string, unknown> = {};
        if (input.title)   body.title = input.title;
        if (input.content) body.content = input.content;
        if (input.status)  body.status = input.status;
        if (input.tags)    body.tags = input.tags.join(',');

        const wpPost = await wpFetch(`/posts/${input.postId}`, {
            method: 'POST',
            body:   JSON.stringify(body),
        }) as any;

        return {
            id:      wpPost.ID,
            title:   wpPost.title,
            status:  wpPost.status,
            url:     wpPost.URL,
            excerpt: wpPost.excerpt,
            date:    wpPost.date,
        };
    }
);

// ── High-Level Genkit Flows ───────────────────────────────────────────────────

const PublishingFlowInput = z.object({
    instruction: z.string().describe('What to write and publish — e.g. "Write a post about our new dispatch server architecture"'),
    sessionId:   z.string().optional(),
    publishImmediately: z.boolean().default(false).describe('Publish immediately vs. save as draft'),
    scheduledDate:      z.string().optional().describe('ISO-8601 date to schedule if not publishing immediately'),
});

const PublishingFlowOutput = z.object({
    action:  z.string(),
    postId:  z.number().optional(),
    postUrl: z.string().optional(),
    title:   z.string().optional(),
    status:  z.string().optional(),
    summary: z.string(),
});

/**
 * WPPublishingFlow — the master orchestrator flow.
 * Takes a natural language instruction, plans the post, drafts it with memory
 * grounding, then publishes or schedules according to the instruction.
 *
 * Any agent that has `engine-pipeline` capability can invoke this.
 */
export const WPPublishingFlow = ai.defineFlow(
    {
        name:        'WPPublishing',
        inputSchema:  PublishingFlowInput,
        outputSchema: PublishingFlowOutput,
    },
    async (input): Promise<z.infer<typeof PublishingFlowOutput>> => {
        console.log(`[wp-publishing] Flow started: "${input.instruction.slice(0, 80)}"`);

        // Step 1 — Plan the post (title, topic, tags, tone)
        const { output: plan } = await ai.generate({
            model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
            system: `You are an editorial planner. Given a publishing instruction, return a structured post plan.
Current date: ${new Date().toISOString().slice(0, 10)}`,
            prompt: input.instruction,
            output: {
                schema: z.object({
                    title:     z.string(),
                    topic:     z.string(),
                    tags:      z.array(z.string()),
                    categories: z.array(z.string()),
                    tone:      z.string(),
                    wordCount: z.number(),
                }),
            },
            config: { temperature: 0.2 },
        });

        if (!plan) return { action: 'error', summary: 'Planning step failed — no plan generated.' };

        // Step 2 — Draft with memory grounding
        const draft = await draftPostTool({
            title:      plan.title,
            topic:      plan.topic,
            tags:       plan.tags,
            categories: plan.categories,
            tone:       plan.tone,
            wordCount:  plan.wordCount,
            format:     'standard',
            sessionId:  input.sessionId,
        });

        // Step 3 — Publish or schedule
        let finalPost = draft;
        let action = 'drafted';

        if (input.publishImmediately || input.scheduledDate) {
            finalPost = await publishPostTool({
                postId:        draft.id,
                scheduledDate: input.scheduledDate,
            });
            action = input.scheduledDate ? 'scheduled' : 'published';
        }

        // Step 4 — Commit action to memory for future context
        await memoryBus.commit({
            agentName:  'WP_PUBLISHER',
            sessionId:  input.sessionId ?? 'wp-publisher',
            task:       `WP Publishing: ${draft.title}`,
            outcome:    `${action} post ID=${finalPost.id} at ${finalPost.url}`,
            tags:       ['wp-publishing', 'content', action, ...plan.tags],
            success:    true,
        });

        return {
            action,
            postId:  finalPost.id,
            postUrl: finalPost.url,
            title:   finalPost.title,
            status:  finalPost.status,
            summary: `${action.charAt(0).toUpperCase() + action.slice(1)} "${finalPost.title}" (ID: ${finalPost.id}) → ${finalPost.url}`,
        };
    }
);
