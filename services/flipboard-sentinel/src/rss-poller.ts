/**
 * Flipboard Sentinel — RSS Poller
 * Fetches and parses the Flipboard magazine RSS feed.
 */

import Parser from 'rss-parser';
import { CONFIG } from './config.js';

export interface FeedArticle {
    guid: string;
    title: string;
    link: string;
    description: string;
    pubDate: string;
    author: string;
    categories: string[];
    imageUrl: string | null;
    contentSnippet: string;
}

const parser = new Parser();

// Browser-like User Agent to avoid rate-limiting or CloudFront blocking
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Fetch feed XML using native fetch with retry and timeout.
 */
async function fetchFeedWithRetry(url: string, retries = 3, delay = 2000): Promise<string> {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout per request

            const response = await fetch(url, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            return await response.text();
        } catch (err: any) {
            const isLast = i === retries - 1;
            if (isLast) throw err;
            console.warn(`[SENTINEL] 📡 RSS fetch attempt ${i + 1} failed: ${err.message}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('RSS fetch failed after all retries');
}

/**
 * Fetch and parse the RSS feed, returning structured articles.
 */
export async function pollRSSFeed(): Promise<FeedArticle[]> {
    console.log(`[SENTINEL] 📡 Polling RSS: ${CONFIG.rssUrl}`);

    const xml = await fetchFeedWithRetry(CONFIG.rssUrl);
    const feed = await parser.parseString(xml);
    const articles: FeedArticle[] = [];

    for (const item of feed.items) {
        // Extract image from media content, enclosure, or description HTML
        let imageUrl: string | null = null;
        if ((item as any)['media:content']?.['$']?.url) {
            imageUrl = (item as any)['media:content']['$'].url;
        } else if (item.enclosure?.url) {
            imageUrl = item.enclosure.url;
        } else {
            const imgMatch = item.content?.match(/<img[^>]+src="([^"]+)"/);
            if (imgMatch) imageUrl = imgMatch[1];
        }

        articles.push({
            guid: item.guid || item.link || item.title || '',
            title: item.title || 'Untitled',
            link: item.link || '',
            description: item.contentSnippet || item.content || '',
            pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
            author: item.creator || item.author || 'Unknown',
            categories: item.categories || [],
            imageUrl,
            contentSnippet: (item.contentSnippet || '').slice(0, 500),
        });
    }

    console.log(`[SENTINEL] ✅ Parsed ${articles.length} articles from feed`);
    return articles;
}

/**
 * Check RSS feed health — returns error message or null if healthy.
 */
export async function checkFeedHealth(): Promise<string | null> {
    try {
        const xml = await fetchFeedWithRetry(CONFIG.rssUrl, 2, 1000); // 2 attempts for health check
        const feed = await parser.parseString(xml);
        if (!feed.items || feed.items.length === 0) {
            return 'RSS feed returned 0 items — may be stale or broken';
        }
        return null;
    } catch (err: any) {
        return `RSS feed error: ${err.message}`;
    }
}
