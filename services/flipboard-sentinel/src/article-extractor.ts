/**
 * Flipboard Sentinel — Article Extractor
 * 
 * Multi-source extraction pipeline:
 * 1. Primary URL fetch (full article text)
 * 2. If thin/paywalled → search DuckDuckGo for related coverage
 * 3. Fetch and combine up to 3 supplemental sources
 * 4. Fall back to RSS description as last resort
 *
 * No external API keys required. DuckDuckGo HTML endpoint is free.
 */

import { CONFIG } from './config.js';
import puppeteer from 'puppeteer-core';
import * as fs from 'fs';
import * as path from 'path';

const PAYWALL_THRESHOLD = 200; // chars — below this triggers supplemental search
const SUPPLEMENTAL_SOURCES = 3;  // how many search results to harvest
const SUPPLEMENTAL_TIMEOUT_MS = 8000;

/**
 * Extract full-text content from an article URL.
 * If the primary source is paywalled or thin, searches for related coverage.
 * Returns a rich synthesized context document for ATHENA.
 */
export async function extractArticleText(url: string, titleOrDescription: string): Promise<string> {
    if (!url) return titleOrDescription;

    // Twitter/X URLs: the tweet text IS the RSS description — no need to scrape
    // Instead: expand any t.co links in the description and fetch those articles
    if (isTwitterUrl(url)) {
        return extractTwitterContent(url, titleOrDescription);
    }

    // Step 1: Try the primary URL
    const primaryText = await fetchAndExtract(url, CONFIG.extractTimeoutMs);

    if (primaryText && primaryText.length >= PAYWALL_THRESHOLD) {
        return primaryText.slice(0, CONFIG.articleMaxChars);
    }

    // Step 2: Primary was thin/blocked — supplement with search
    const reason = primaryText !== null ? `thin (${primaryText.length} chars)` : 'blocked/timeout';
    console.log(`[SENTINEL] 🔍 Primary source ${reason} — searching for supplemental coverage...`);

    const supplementalContext = await buildSupplementalContext(titleOrDescription, url);

    if (supplementalContext.length >= PAYWALL_THRESHOLD) {
        return supplementalContext;
    }

    // Step 3: Absolute fallback — RSS description
    console.log(`[SENTINEL] ⚠️ Supplemental search insufficient, using RSS description`);
    return titleOrDescription;
}

/**
 * Check if a URL is from Twitter or X.
 */
export function isTwitterUrl(url: string): boolean {
    try {
        const host = new URL(url).hostname.replace('www.', '');
        return host === 'twitter.com' || host === 'x.com' || host === 't.co';
    } catch {
        return false;
    }
}

/**
 * Minimum content length to consider a Twitter extraction successful.
 * Anything below this triggers retry or fallback.
 */
const TWITTER_CONTENT_MIN_CHARS = 100;

/**
 * CORTEX Research Agent — Twitter Thread Intelligence Extractor
 * 
 * Architecture: CORTEX maintains a PERSISTENT authenticated X.com session
 * via the headless Chromium instance on the NAS (122.0.3.1:9222).
 * Cookie database at /volume2/docker/cortex-browser-data persists across restarts.
 * 
 * The agent:
 * 1. Navigates to the tweet using the authenticated session (full content access)
 * 2. Extracts thread structure: author, content, engagement, media descriptions
 * 3. Follows embedded links to source articles
 * 4. Researches the subject via supplemental search
 * 5. Returns a comprehensive research document for ATHENA ideation
 */

interface TwitterThreadData {
    author: string;
    handle: string;
    tweetText: string;
    threadReplies: string[];
    engagementMetrics: { likes: string; reposts: string; views: string; replies: string };
    embeddedLinks: string[];
    quotedTweet: string | null;
    mediaDescriptions: string[];
    recoveredTitle: string | null;
    isAuthenticated: boolean;
}

/**
 * Connect to the persistent CORTEX browser instance.
 * This shares the browser's full cookie jar — if X.com is logged in,
 * new pages inherit the authenticated session automatically.
 */
async function connectCortex() {
    let versionRes;
    try {
        versionRes = await fetch('http://122.0.3.1:9224/json/version');
    } catch {
        versionRes = await fetch('http://122.0.3.1:9222/json/version');
    }
    const versionInfo = await versionRes.json();
    const port = versionRes.url.includes('9224') ? '9224' : '9222';
    const wsUrl = versionInfo.webSocketDebuggerUrl || '';
    const wsEndpoint = wsUrl.replace(/127\.0\.0\.1:\d+|localhost:\d+|192\.168\.2\.15:\d+/, `122.0.3.1:${port}`);
    
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null,
    });

    // Self-healing cookie restoration
    try {
        const pages = await browser.pages();
        const page = pages.length > 0 ? pages[0] : await browser.newPage();
        const currentCookies = await page.cookies('https://x.com');
        const hasAuth = currentCookies.some(c => c.name === 'auth_token' && c.value);
        if (!hasAuth) {
            console.log('[SENTINEL] 🔑 X.com session not found in browser. Attempting self-healing recovery...');
            const runtimePath = process.env.NAS_RUNTIME_PATH || '/app/runtime';
            const stateFile = path.join(runtimePath, 'cortex_state.json');
            if (fs.existsSync(stateFile)) {
                const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
                if (stateData && stateData.cookies) {
                    console.log(`[SENTINEL] 🔑 Loading ${stateData.cookies.length} cookies from ${stateFile}...`);
                    await page.setCookie(...stateData.cookies);
                    console.log('[SENTINEL] 🔑 Cookies injected successfully.');
                }
            } else {
                console.log(`[SENTINEL] ⚠️ State backup file not found at ${stateFile}`);
            }
        }
    } catch (cookieErr: any) {
        console.error('[SENTINEL] ⚠️ Failed to verify or inject cookies:', cookieErr.message);
    }

    return browser;
}

/**
 * Full-depth tweet thread extraction via authenticated CORTEX session.
 * Extracts structured data, not just raw text dumps.
 */
async function extractTwitterThread(url: string): Promise<TwitterThreadData | null> {
    console.log(`[SENTINEL] 🧠 CORTEX Research Agent: navigating to ${url}`);
    let browser;
    try {
        browser = await connectCortex();
        const page = await browser.newPage();

        // Inject __name polyfill — tsx ESM transform adds __name references
        // that don't exist in the browser context
        await page.evaluateOnNewDocument(() => {
            // @ts-ignore — polyfill for tsx ESM transform artifact
            if (typeof globalThis.__name === 'undefined') {
                (globalThis as any).__name = (fn: any) => fn;
            }
        });

        // Navigate with networkidle2 — wait for X.com JS hydration
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

        // X.com renders content async — wait for tweet articles to hydrate
        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 20000 }).catch(() => {});
        // Extra stabilization for thread loading
        await new Promise(r => setTimeout(r, 3000));

        const threadData = await page.evaluate(() => {
            // Check authentication state — logged-in users see a "Post" or compose button
            const isAuthenticated = !!(
                document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
                document.querySelector('[data-testid="tweetButtonInline"]') ||
                document.querySelector('a[href="/compose/post"]') ||
                document.querySelector('[aria-label="Post"]')
            );

            const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
            if (articles.length === 0) {
                return {
                    author: '',
                    handle: '',
                    tweetText: document.body?.innerText?.slice(0, 5000) || '',
                    threadReplies: [] as string[],
                    engagementMetrics: { likes: '', reposts: '', views: '', replies: '' },
                    embeddedLinks: [] as string[],
                    quotedTweet: null as string | null,
                    mediaDescriptions: [] as string[],
                    recoveredTitle: document.title?.replace(/\s*\/\s*X$/, '') || null,
                    isAuthenticated,
                };
            }

            // Primary tweet is the first article
            const primaryArticle = articles[0] as HTMLElement;

            // Extract author info
            const authorEl = primaryArticle.querySelector('[data-testid="User-Name"]') as HTMLElement;
            const authorParts = authorEl?.innerText?.split('\n') || [];
            const author = authorParts[0] || '';
            const handle = authorParts.find(p => p.startsWith('@')) || '';

            // Extract primary tweet text
            const tweetTextEl = primaryArticle.querySelector('[data-testid="tweetText"]') as HTMLElement;
            const tweetText = tweetTextEl?.innerText || primaryArticle.innerText || '';

            // Extract engagement metrics
            const getMetric = (testId: string): string => {
                const el = primaryArticle.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
                return el?.getAttribute('aria-label') || el?.innerText || '0';
            };
            const engagementMetrics = {
                likes: getMetric('like'),
                reposts: getMetric('retweet'),
                views: '',
                replies: getMetric('reply'),
            };
            // Views are usually in an analytics link
            const viewEl = primaryArticle.querySelector('a[href*="/analytics"]') as HTMLElement;
            engagementMetrics.views = viewEl?.getAttribute('aria-label') || '';

            // Thread replies (same author continuing a thread)
            const threadReplies: string[] = [];
            for (let i = 1; i < articles.length; i++) {
                const replyArticle = articles[i] as HTMLElement;
                const replyAuthor = replyArticle.querySelector('[data-testid="User-Name"]') as HTMLElement;
                const replyHandle = replyAuthor?.innerText?.split('\n')?.find(p => p.startsWith('@')) || '';
                const replyText = (replyArticle.querySelector('[data-testid="tweetText"]') as HTMLElement)?.innerText || '';

                if (replyHandle === handle && replyText) {
                    // Same author — part of the thread
                    threadReplies.push(replyText);
                } else if (replyText) {
                    // Different author — notable reply
                    threadReplies.push(`[Reply by ${replyHandle}]: ${replyText.slice(0, 300)}`);
                }
            }

            // Extract embedded links (t.co links resolve in the DOM to their display URLs)
            const links: string[] = [];
            const linkEls = primaryArticle.querySelectorAll('a[href]');
            linkEls.forEach(a => {
                const href = a.getAttribute('href') || '';
                // t.co links, or external links that aren't twitter-internal navigation
                if (href.includes('t.co/') || (href.startsWith('http') && !href.includes('x.com') && !href.includes('twitter.com'))) {
                    links.push(href);
                }
            });
            // Also check thread replies for links
            for (let i = 1; i < Math.min(articles.length, 4); i++) {
                const replyLinks = (articles[i] as HTMLElement).querySelectorAll('a[href]');
                replyLinks.forEach(a => {
                    const href = a.getAttribute('href') || '';
                    if (href.includes('t.co/') || (href.startsWith('http') && !href.includes('x.com') && !href.includes('twitter.com'))) {
                        links.push(href);
                    }
                });
            }

            // Quoted tweet content
            let quotedTweet: string | null = null;
            const quoteEl = primaryArticle.querySelector('[data-testid="quoteTweet"]') as HTMLElement;
            if (quoteEl) {
                quotedTweet = quoteEl.innerText || null;
            }

            // Media descriptions (alt text on images)
            const mediaDescriptions: string[] = [];
            const images = primaryArticle.querySelectorAll('img[alt]');
            images.forEach(img => {
                const alt = img.getAttribute('alt') || '';
                if (alt && alt !== 'Image' && !alt.includes('avatar') && alt.length > 5) {
                    mediaDescriptions.push(alt);
                }
            });

            // Title recovery from document.title
            const pageTitle = document.title || '';
            let recoveredTitle: string | null = null;
            const titleMatch = pageTitle.match(/on X:\s*[""](.+?)[""\u201D]\s*\/\s*X/i);
            if (titleMatch) {
                recoveredTitle = titleMatch[1].slice(0, 120);
            } else if (pageTitle && pageTitle !== 'X') {
                recoveredTitle = pageTitle.replace(/\s*\/\s*X$/, '').slice(0, 120);
            }

            return {
                author,
                handle,
                tweetText,
                threadReplies,
                engagementMetrics,
                embeddedLinks: [...new Set(links)],
                quotedTweet,
                mediaDescriptions,
                recoveredTitle,
                isAuthenticated,
            };
        });

        await page.close();
        await browser.disconnect();

        if (!threadData.isAuthenticated) {
            console.log(`[SENTINEL] ⚠️ CORTEX is NOT authenticated to X.com — content may be truncated. Log in via http://122.0.3.1:3100`);
        } else {
            console.log(`[SENTINEL] ✅ CORTEX authenticated session active`);
        }

        console.log(`[SENTINEL] 📊 Thread extracted: @${threadData.handle} | ${threadData.tweetText.length} chars | ${threadData.threadReplies.length} replies | ${threadData.embeddedLinks.length} links`);
        return threadData;

    } catch (err: any) {
        console.error(`[SENTINEL] ❌ CORTEX thread extraction failed: ${err.message}`);
        if (browser) try { await browser.disconnect(); } catch {}
        return null;
    }
}

/**
 * Research the subject matter of a tweet by following embedded links and searching.
 * This is the "IDEATION research" step — not just extraction, but understanding.
 */
async function researchTweetSubject(
    threadData: TwitterThreadData,
    tweetUrl: string,
): Promise<string[]> {
    const researchSections: string[] = [];

    // Step 1: Expand and fetch all embedded links
    const allLinks = [...threadData.embeddedLinks];
    console.log(`[SENTINEL] 🔬 Researching ${allLinks.length} embedded link(s)...`);

    for (const link of allLinks.slice(0, 3)) {
        try {
            // Expand t.co redirects
            let resolvedUrl = link;
            if (link.includes('t.co/')) {
                const expanded = await expandTcoLink(link);
                if (expanded) resolvedUrl = expanded;
            }

            // Skip links back to twitter/x.com (self-references)
            if (isTwitterUrl(resolvedUrl)) {
                console.log(`[SENTINEL] ⏩ Skipping self-reference: ${resolvedUrl}`);
                continue;
            }

            console.log(`[SENTINEL] 📰 Fetching linked source: ${resolvedUrl}`);
            const articleText = await fetchAndExtract(resolvedUrl, CONFIG.extractTimeoutMs);

            if (articleText && articleText.length >= PAYWALL_THRESHOLD) {
                researchSections.push(`--- Linked Source: ${resolvedUrl} ---`);
                researchSections.push(articleText.slice(0, 4000));
                researchSections.push('');
            } else if (articleText && articleText.length > 0) {
                // Paywalled — try supplemental search for the article
                const urlTitle = resolvedUrl.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || '';
                if (urlTitle) {
                    const supp = await buildSupplementalContext(urlTitle, resolvedUrl);
                    if (supp.length > 100) {
                        researchSections.push(`--- Supplemental Coverage: ${resolvedUrl} ---`);
                        researchSections.push(supp.slice(0, 3000));
                        researchSections.push('');
                    }
                }
            }
        } catch (err: any) {
            console.log(`[SENTINEL] ⚠️ Link research failed for ${link}: ${err.message}`);
        }
    }

    // Step 2: If the tweet has substance but no linked articles, research the topic
    const combinedTweetContent = [threadData.tweetText, ...threadData.threadReplies].join(' ');
    if (researchSections.length === 0 && combinedTweetContent.length > 30) {
        console.log(`[SENTINEL] 🔍 No linked articles found — researching tweet subject...`);
        const searchQuery = threadData.recoveredTitle || combinedTweetContent.slice(0, 150);
        const topicContext = await buildSupplementalContext(searchQuery, tweetUrl);
        if (topicContext.length > 100) {
            researchSections.push('--- Subject Research ---');
            researchSections.push(topicContext.slice(0, 4000));
        }
    }

    return researchSections;
}

/**
 * Extract content from a Twitter/X save — full research pipeline.
 * 
 * Pipeline:
 * 1. CORTEX authenticates and extracts full thread structure
 * 2. Follows embedded links to source articles
 * 3. Researches the subject via supplemental search
 * 4. Assembles a comprehensive context document for ATHENA
 */
async function extractTwitterContent(tweetUrl: string, rssDescription: string): Promise<string> {
    console.log(`[SENTINEL] 🐦 Twitter Research Agent activated for: ${tweetUrl}`);

    // Phase 1: Extract full thread via authenticated CORTEX
    const threadData = await extractTwitterThread(tweetUrl);

    if (!threadData || (threadData.tweetText.length < 10 && threadData.threadReplies.length === 0)) {
        // Complete extraction failure — fall back to legacy methods
        console.log(`[SENTINEL] ⚠️ CORTEX thread extraction returned no data. Falling back to oEmbed/RSS.`);
        return await fallbackTwitterExtraction(tweetUrl, rssDescription);
    }

    // Phase 2: Research the subject by following links
    const researchSections = await researchTweetSubject(threadData, tweetUrl);

    // Phase 3: Assemble the comprehensive context document
    const sections: string[] = [
        `=== TWITTER/X RESEARCH DOCUMENT ===`,
        `Tweet URL: ${tweetUrl}`,
        `Author: ${threadData.author} (${threadData.handle})`,
        `Auth Status: ${threadData.isAuthenticated ? 'AUTHENTICATED' : 'GUEST (limited content)'}`,
        ``,
    ];

    // Engagement context (helps ATHENA gauge relevance)
    const { likes, reposts, views, replies } = threadData.engagementMetrics;
    if (likes || reposts || views) {
        sections.push(`--- Engagement ---`);
        if (likes) sections.push(`Likes: ${likes}`);
        if (reposts) sections.push(`Reposts: ${reposts}`);
        if (views) sections.push(`Views: ${views}`);
        if (replies) sections.push(`Replies: ${replies}`);
        sections.push('');
    }

    // Primary tweet content
    sections.push(`--- Primary Tweet ---`);
    sections.push(threadData.tweetText);
    sections.push('');

    // Thread continuation (same author)
    if (threadData.threadReplies.length > 0) {
        sections.push(`--- Thread (${threadData.threadReplies.length} additional posts) ---`);
        threadData.threadReplies.forEach((reply, i) => {
            sections.push(`[${i + 1}] ${reply}`);
        });
        sections.push('');
    }

    // Quoted tweet
    if (threadData.quotedTweet) {
        sections.push(`--- Quoted Tweet ---`);
        sections.push(threadData.quotedTweet);
        sections.push('');
    }

    // Media descriptions
    if (threadData.mediaDescriptions.length > 0) {
        sections.push(`--- Media ---`);
        threadData.mediaDescriptions.forEach(desc => sections.push(`[Image] ${desc}`));
        sections.push('');
    }

    // Research findings
    if (researchSections.length > 0) {
        sections.push(`--- RESEARCH: Linked & Related Sources ---`);
        sections.push(...researchSections);
    }

    const result = sections.join('\n').slice(0, CONFIG.articleMaxChars);

    // Quality assessment
    const qualityPass = result.length >= TWITTER_CONTENT_MIN_CHARS;
    console.log(`[SENTINEL] ${qualityPass ? '✅' : '🚨'} Twitter research document: ${result.length} chars | Quality: ${qualityPass ? 'PASS' : 'FAIL'} | Auth: ${threadData.isAuthenticated}`);

    if (!threadData.isAuthenticated) {
        console.log(`[SENTINEL] 🔑 ACTION NEEDED: Log into X.com via CORTEX at http://122.0.3.1:3100 for full thread access`);
    }

    return result;
}

/**
 * Legacy fallback when CORTEX extraction completely fails.
 * Uses oEmbed API and RSS description as last resort.
 */
async function fallbackTwitterExtraction(tweetUrl: string, rssDescription: string): Promise<string> {
    let content = rssDescription || '';

    // Try oEmbed
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const oembedRes = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (oembedRes.ok) {
            const oembedJson = await oembedRes.json();
            if (oembedJson?.html) {
                const oembedText = htmlToCleanText(oembedJson.html);
                if (oembedText.length > content.length) {
                    content = oembedText;
                    console.log(`[SENTINEL] 🐦 oEmbed fallback: ${content.length} chars`);
                }
            }
        }
    } catch (err: any) {
        console.log(`[SENTINEL] ⚠️ oEmbed fallback failed: ${err.message}`);
    }

    if (!content || content.length < 10) {
        content = rssDescription || '(no content extracted)';
    }

    // Still try to research the subject even with thin primary content
    if (content.length > 20) {
        const topicContext = await buildSupplementalContext(content.slice(0, 150), tweetUrl);
        if (topicContext.length > 100) {
            content = `=== TWITTER/X CONTENT (FALLBACK) ===\nTweet URL: ${tweetUrl}\n\n--- Tweet Text ---\n${content}\n\n--- Related Coverage ---\n${topicContext}`;
        }
    }

    return content.slice(0, CONFIG.articleMaxChars);
}

/**
 * Extract all t.co URLs from text.
 */
function extractTcoLinks(text: string): string[] {
    const matches = text.match(/https?:\/\/t\.co\/[A-Za-z0-9]+/g) || [];
    return [...new Set(matches)];
}

/**
 * Follow a t.co redirect to get the real destination URL.
 * Uses HEAD request to avoid downloading the full page.
 */
async function expandTcoLink(tcoUrl: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(tcoUrl, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; InceptionEngine-Sentinel/1.0)',
            },
        });

        clearTimeout(timeout);
        return response.url !== tcoUrl ? response.url : null;
    } catch {
        return null;
    }
}

/**
 * Build a rich context document from supplemental web searches.
 * Searches for the title, fetches related articles, and combines into one context.
 */
async function buildSupplementalContext(titleOrDescription: string, originalUrl: string): Promise<string> {
    const title = titleOrDescription.length > 150
        ? titleOrDescription.slice(0, 150)
        : titleOrDescription;

    // Extract search keywords from title (remove filler words)
    const keywords = extractKeywords(title);
    console.log(`[SENTINEL] 🔑 Search keywords: ${keywords}`);

    // Run DuckDuckGo searches (title query + keyword query)
    const [titleResults, keywordResults] = await Promise.allSettled([
        searchDuckDuckGo(`"${title.slice(0, 80)}"`),
        searchDuckDuckGo(keywords),
    ]);

    const allResults: SearchResult[] = [
        ...(titleResults.status === 'fulfilled' ? titleResults.value : []),
        ...(keywordResults.status === 'fulfilled' ? keywordResults.value : []),
    ];

    // Deduplicate by URL, skip the original (already tried it)
    const seen = new Set([originalUrl]);
    const uniqueResults = allResults.filter(r => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
    });

    if (uniqueResults.length === 0) {
        console.log(`[SENTINEL] ⚠️ No supplemental sources found`);
        return titleOrDescription;
    }

    console.log(`[SENTINEL] 📰 Found ${uniqueResults.length} supplemental sources — fetching top ${SUPPLEMENTAL_SOURCES}`);

    // Fetch top N results in parallel
    const fetchJobs = uniqueResults
        .slice(0, SUPPLEMENTAL_SOURCES)
        .map(r => fetchAndExtract(r.url, SUPPLEMENTAL_TIMEOUT_MS).then(text => ({ ...r, text })));

    const fetched = await Promise.allSettled(fetchJobs);

    const sections: string[] = [
        `=== SYNTHESIZED CONTEXT: "${title}" ===`,
        `Source: Multi-article aggregation (primary source paywalled/blocked)`,
        `Original URL: ${originalUrl}`,
        ``,
    ];

    let sourcesUsed = 0;
    for (const result of fetched) {
        if (result.status !== 'fulfilled') continue;
        const { url, title: srcTitle, snippet, text } = result.value;

        const content = (text && text.length > 100) ? text : snippet;
        if (!content || content.length < 50) continue;

        sourcesUsed++;
        sections.push(`--- Source ${sourcesUsed}: ${srcTitle || url} ---`);
        sections.push(`URL: ${url}`);
        sections.push(content.slice(0, Math.floor(CONFIG.articleMaxChars / SUPPLEMENTAL_SOURCES)));
        sections.push('');
    }

    if (sourcesUsed === 0) {
        return titleOrDescription;
    }

    console.log(`[SENTINEL] ✅ Supplemental context built from ${sourcesUsed} source(s)`);
    const combined = sections.join('\n').slice(0, CONFIG.articleMaxChars);
    return combined;
}

interface SearchResult {
    url: string;
    title: string;
    snippet: string;
}

/**
 * Search DuckDuckGo (HTML endpoint, no API key required).
 * Returns up to 8 results with URL, title, and snippet.
 */
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(searchUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; InceptionEngine-Sentinel/1.0; +https://inception.engine)',
                'Accept': 'text/html',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        clearTimeout(timeout);

        if (!response.ok) {
            console.log(`[SENTINEL] ⚠️ DuckDuckGo search returned ${response.status}`);
            return [];
        }

        const html = await response.text();
        return parseDuckDuckGoResults(html);
    } catch (err: any) {
        console.log(`[SENTINEL] ⚠️ DuckDuckGo search failed: ${err.message}`);
        return [];
    }
}

/**
 * Parse DuckDuckGo HTML results page.
 * Extracts URLs, titles, and snippets from result divs.
 */
function parseDuckDuckGoResults(html: string): SearchResult[] {
    const results: SearchResult[] = [];

    // DDG HTML result structure: <div class="result"> with anchors and snippets
    const resultBlocks = html.match(/<div class="result[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g) || [];

    for (const block of resultBlocks.slice(0, 10)) {
        // Extract URL from href (DDG wraps with redirect, get uddg param or direct href)
        const urlMatch = block.match(/class="result__url[^"]*"[^>]*>([^<]+)</) ||
                         block.match(/href="(https?:\/\/[^"]+)"/);
        const titleMatch = block.match(/<a class="result__a[^"]*"[^>]*>([^<]+)<\/a>/);
        const snippetMatch = block.match(/<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/);

        let url = urlMatch ? urlMatch[1].trim() : '';
        const title = titleMatch ? htmlDecode(titleMatch[1].trim()) : '';
        const snippet = snippetMatch ? htmlDecode(snippetMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

        // Clean up DDG redirect URLs
        if (url && !url.startsWith('http')) {
            // DDG sometimes shows domain only — skip
            continue;
        }

        // Skip DDG's own pages and known paywalls on retry attempts
        if (!url || url.includes('duckduckgo.com') || url.includes('ad_domain')) continue;

        results.push({ url, title, snippet });
    }

    // Fallback: simpler href extraction if class-based parsing yielded nothing
    if (results.length === 0) {
        const hrefPattern = /href="(https?:\/\/(?!duckduckgo\.com)[^"]+)"[^>]*class="result__a/g;
        let match;
        while ((match = hrefPattern.exec(html)) !== null && results.length < 8) {
            results.push({ url: match[1], title: '', snippet: '' });
        }
    }

    return results;
}

/**
 * Fetch a URL and extract clean text. Returns null on failure.
 */
async function fetchAndExtract(url: string, timeoutMs: number): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
            },
        });

        clearTimeout(timeout);

        if (!response.ok) return null;

        const html = await response.text();
        return htmlToCleanText(html);
    } catch {
        return null;
    }
}

/**
 * Extract meaningful keywords from a title for a supplemental search query.
 * Removes stop words, keeps nouns/verbs, deduplicates.
 */
function extractKeywords(text: string): string {
    const stopWords = new Set([
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
        'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'its', 'it', 'this', 'that', 'these', 'those',
        'as', 'if', 'so', 'but', 'not', 'up', 'out', 'how', 'why', 'what',
        'who', 'which', 'when', 'where', 'can', 'about', 'into', 'than', 'more',
    ]);

    const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s'-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));

    // Deduplicate and take top 6
    const unique = [...new Set(words)].slice(0, 6);
    return unique.join(' ');
}

/**
 * Decode common HTML entities.
 */
function htmlDecode(text: string): string {
    return text
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&nbsp;/gi, ' ')
        .replace(/&mdash;/gi, '—')
        .replace(/&ndash;/gi, '–')
        .replace(/&hellip;/gi, '…');
}

/**
 * Converts HTML to clean readable text.
 * Strips tags, decodes entities, normalizes whitespace.
 */
function htmlToCleanText(html: string): string {
    // Remove script, style, nav, header, footer, aside blocks
    let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

    // Try to find the main content area
    const articleMatch = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);

    if (articleMatch) {
        text = articleMatch[1];
    } else if (mainMatch) {
        text = mainMatch[1];
    }

    // Convert block elements to newlines
    text = text
        .replace(/<\/?(p|div|br|h[1-6]|li|blockquote)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')  // Strip remaining tags
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&mdash;/gi, '—')
        .replace(/&ndash;/gi, '–')
        .replace(/&hellip;/gi, '…')
        .replace(/\n{3,}/g, '\n\n')  // Collapse excessive newlines
        .replace(/[ \t]{2,}/g, ' ')  // Collapse whitespace
        .trim();

    return text;
}

/**
 * Auto-classify article into Creative Liberation Engine relevance categories.
 * Returns categories sorted by relevance.
 */
export function classifyArticle(title: string, text: string): {
    categories: string[];
    inceptionRelevance: number;
} {
    const combined = `${title} ${text}`.toLowerCase();

    const categoryKeywords: Record<string, string[]> = {
        'infrastructure': ['server', 'cloud', 'deploy', 'docker', 'kubernetes', 'container', 'infrastructure', 'devops', 'ci/cd'],
        'sovereignty': ['self-hosted', 'sovereign', 'on-premise', 'local', 'privacy', 'open source', 'open-source', 'decentralized'],
        'edge-ai': ['edge', 'on-device', 'mobile ai', 'jetson', 'neural processing', 'npu', 'qualcomm', 'apple intelligence', 'google ai edge'],
        'local-llm': ['ollama', 'llama', 'mistral', 'local model', 'quantization', 'gguf', 'mlx', 'vllm'],
        'agent': ['agent', 'agentic', 'autonomous', 'tool use', 'function calling', 'mcp', 'a2a'],
        'creative-tools': ['creative', 'design', 'art', 'music', 'video', 'image generation', 'comfyui', 'midjourney', 'stable diffusion', 'flux'],
        'research': ['paper', 'research', 'arxiv', 'benchmark', 'breakthrough', 'novel', 'state-of-the-art'],
        'business': ['startup', 'funding', 'revenue', 'market', 'enterprise', 'saas', 'monetiz'],
        'learning': ['tutorial', 'course', 'learn', 'guide', 'certification', 'nvidia dli', 'training'],
        'competitive-intel': ['openai', 'anthropic', 'google', 'meta ai', 'microsoft', 'amazon', 'apple'],
        'cinematography': ['cinema', 'film', 'broadcast', 'resolve', 'premiere', 'camera', 'color grade', 'lut'],
        'spatial': ['3d', 'gaussian', 'nerf', 'point cloud', 'spatial', 'xr', 'ar', 'vr', 'vision pro'],
    };

    const matchedCategories: string[] = [];
    let relevanceScore = 0;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        const matches = keywords.filter(kw => combined.includes(kw));
        if (matches.length > 0) {
            matchedCategories.push(category);
            const highRelMatches = matches.filter(m =>
                CONFIG.highRelevanceTopics.some(t => m.includes(t) || t.includes(m))
            );
            relevanceScore += matches.length * 10 + highRelMatches.length * 20;
        }
    }

    // Normalize to 0-100
    const inceptionRelevance = Math.min(100, relevanceScore);

    return {
        categories: matchedCategories.length > 0 ? matchedCategories : ['general'],
        inceptionRelevance: 100, // Operator curated = always max relevance
    };
}
