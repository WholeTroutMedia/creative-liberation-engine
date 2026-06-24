/**
 * GeoMind — Geospatial Intelligence Flow
 *
 * Composable Genkit flow: any agent calls this to get location-grounded answers
 * via Google Maps Platform APIs (Places, Weather, Routes, Air Quality).
 *
 * Usage:
 *   const result = await geoMindFlow({ query: "coffee near Times Square", mode: "places" });
 *   // → { success, places[], weather, airQuality, routeSummary, answer }
 *
 * Constitutional: Article V  (Transparency — data sources always surfaced)
 *                 Article XX (zero wait — API responds in <2s)
 *                 Article I  (Sovereign — NAS cache layer for repeat queries)
 */

import { z } from 'genkit';
import { ai } from '../index.js';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export const GeoMindInputSchema = z.object({
    query: z.string().describe('Natural language location query'),
    mode: z.enum(['places', 'weather', 'route', 'full']).default('full')
        .describe('places → search only | weather → conditions only | route → directions | full → all'),
    locationHint: z.string().optional()
        .describe('Optional location bias e.g. "New York, NY" or "40.7580,-73.9855"'),
    placeType: z.string().optional()
        .describe('Optional Google place type filter e.g. "restaurant", "cafe", "gas_station"'),
    destination: z.string().optional()
        .describe('Required for route mode — destination address or place'),
    maxResults: z.number().default(5)
        .describe('Max places to return (1-20)'),
});

export const GeoPlaceSchema = z.object({
    name: z.string(),
    address: z.string(),
    rating: z.number().optional(),
    userRatingCount: z.number().optional(),
    priceLevel: z.string().optional(),
    types: z.array(z.string()),
    googleMapsUri: z.string().optional(),
    openNow: z.boolean().optional(),
    editorialSummary: z.string().optional(),
});

export const GeoWeatherSchema = z.object({
    temperature: z.number().optional(),
    condition: z.string().optional(),
    humidity: z.number().optional(),
    windSpeed: z.number().optional(),
    uvIndex: z.number().optional(),
});

export const GeoAirQualitySchema = z.object({
    aqi: z.number().optional(),
    category: z.string().optional(),
    dominantPollutant: z.string().optional(),
});

export const GeoRouteSchema = z.object({
    distanceMeters: z.number().optional(),
    duration: z.string().optional(),
    startAddress: z.string().optional(),
    endAddress: z.string().optional(),
    summary: z.string().optional(),
});

export const GeoMindOutputSchema = z.object({
    success: z.boolean(),
    answer: z.string().describe('Natural language summary of geo data'),
    places: z.array(GeoPlaceSchema).describe('Matching places'),
    weather: GeoWeatherSchema.optional(),
    airQuality: GeoAirQualitySchema.optional(),
    route: GeoRouteSchema.optional(),
    dataSources: z.array(z.string()).describe('APIs used for this response'),
    errorMessage: z.string().optional().describe('Set if success=false'),
});

export type GeoMindInput = z.infer<typeof GeoMindInputSchema>;
export type GeoMindOutput = z.infer<typeof GeoMindOutputSchema>;
export type GeoPlace = z.infer<typeof GeoPlaceSchema>;
export type GeoWeather = z.infer<typeof GeoWeatherSchema>;
export type GeoAirQuality = z.infer<typeof GeoAirQualitySchema>;
export type GeoRoute = z.infer<typeof GeoRouteSchema>;

// ─── API KEY ─────────────────────────────────────────────────────────────────

function getApiKey(): string | undefined {
    return process.env.GOOGLE_MAPS_API_KEY;
}

// ─── PLACES API (NEW) ────────────────────────────────────────────────────────

interface PlacesApiPlace {
    displayName?: { text?: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
    priceLevel?: string;
    types?: string[];
    googleMapsUri?: string;
    currentOpeningHours?: { openNow?: boolean };
    editorialSummary?: { text?: string };
}

interface PlacesApiResponse {
    places?: PlacesApiPlace[];
}

export async function searchPlaces(
    query: string,
    locationHint?: string,
    placeType?: string,
    maxResults: number = 5,
): Promise<{ places: GeoPlace[]; error?: string }> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { places: [], error: 'GOOGLE_MAPS_API_KEY not set — add it to .env to enable GeoMind' };
    }

    const fieldMask = [
        'places.displayName',
        'places.formattedAddress',
        'places.rating',
        'places.userRatingCount',
        'places.priceLevel',
        'places.types',
        'places.googleMapsUri',
        'places.currentOpeningHours',
        'places.editorialSummary',
    ].join(',');

    const body: Record<string, unknown> = {
        textQuery: query + (locationHint ? ` near ${locationHint}` : ''),
        maxResultCount: Math.min(Math.max(maxResults, 1), 20),
        languageCode: 'en',
    };

    if (placeType) {
        body.includedType = placeType;
    }

    try {
        const response = await fetch(
            'https://places.googleapis.com/v1/places:searchText',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': fieldMask,
                },
                body: JSON.stringify(body),
            },
        );

        if (!response.ok) {
            const errText = await response.text();
            return { places: [], error: `Places API error ${response.status}: ${errText}` };
        }

        const data = (await response.json()) as PlacesApiResponse;

        const places: GeoPlace[] = (data.places ?? []).map((p) => ({
            name: p.displayName?.text ?? 'Unknown',
            address: p.formattedAddress ?? '',
            rating: p.rating,
            userRatingCount: p.userRatingCount,
            priceLevel: p.priceLevel,
            types: p.types ?? [],
            googleMapsUri: p.googleMapsUri,
            openNow: p.currentOpeningHours?.openNow,
            editorialSummary: p.editorialSummary?.text,
        }));

        return { places };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { places: [], error: `Places API fetch failed: ${message}` };
    }
}

// ─── WEATHER API ─────────────────────────────────────────────────────────────

interface WeatherApiResponse {
    currentConditions?: {
        temperature?: { degrees?: number };
        weatherCondition?: string;
        humidity?: { percent?: number };
        wind?: { speed?: { value?: number } };
        uvIndex?: number;
    };
}

export async function getWeather(
    locationHint: string,
): Promise<{ weather: GeoWeather; error?: string }> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { weather: {}, error: 'GOOGLE_MAPS_API_KEY not set' };
    }

    try {
        // First geocode the location to lat/lng
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationHint)}&key=${apiKey}`;
        const geoResp = await fetch(geocodeUrl);

        if (!geoResp.ok) {
            return { weather: {}, error: `Geocoding failed: ${geoResp.status}` };
        }

        const geoData = (await geoResp.json()) as {
            results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
        };
        const loc = geoData.results?.[0]?.geometry?.location;

        if (!loc?.lat || !loc?.lng) {
            return { weather: {}, error: `Could not geocode "${locationHint}"` };
        }

        // Call Weather API
        const weatherUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`;
        const weatherResp = await fetch(weatherUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: { latitude: loc.lat, longitude: loc.lng },
            }),
        });

        if (!weatherResp.ok) {
            const errText = await weatherResp.text();
            return { weather: {}, error: `Weather API error ${weatherResp.status}: ${errText}` };
        }

        const weatherData = (await weatherResp.json()) as WeatherApiResponse;
        const cc = weatherData.currentConditions;

        return {
            weather: {
                temperature: cc?.temperature?.degrees,
                condition: cc?.weatherCondition,
                humidity: cc?.humidity?.percent,
                windSpeed: cc?.wind?.speed?.value,
                uvIndex: cc?.uvIndex,
            },
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { weather: {}, error: `Weather fetch failed: ${message}` };
    }
}

// ─── AIR QUALITY API ─────────────────────────────────────────────────────────

interface AirQualityApiResponse {
    indexes?: Array<{
        aqi?: number;
        category?: string;
        dominantPollutant?: string;
    }>;
}

export async function getAirQuality(
    locationHint: string,
): Promise<{ airQuality: GeoAirQuality; error?: string }> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { airQuality: {}, error: 'GOOGLE_MAPS_API_KEY not set' };
    }

    try {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationHint)}&key=${apiKey}`;
        const geoResp = await fetch(geocodeUrl);

        if (!geoResp.ok) {
            return { airQuality: {}, error: `Geocoding failed: ${geoResp.status}` };
        }

        const geoData = (await geoResp.json()) as {
            results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
        };
        const loc = geoData.results?.[0]?.geometry?.location;

        if (!loc?.lat || !loc?.lng) {
            return { airQuality: {}, error: `Could not geocode "${locationHint}"` };
        }

        const aqUrl = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`;
        const aqResp = await fetch(aqUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: { latitude: loc.lat, longitude: loc.lng },
            }),
        });

        if (!aqResp.ok) {
            const errText = await aqResp.text();
            return { airQuality: {}, error: `Air Quality API error ${aqResp.status}: ${errText}` };
        }

        const aqData = (await aqResp.json()) as AirQualityApiResponse;
        const idx = aqData.indexes?.[0];

        return {
            airQuality: {
                aqi: idx?.aqi,
                category: idx?.category,
                dominantPollutant: idx?.dominantPollutant,
            },
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { airQuality: {}, error: `Air Quality fetch failed: ${message}` };
    }
}

// ─── ROUTES API ──────────────────────────────────────────────────────────────

interface RoutesApiResponse {
    routes?: Array<{
        distanceMeters?: number;
        duration?: string;
        description?: string;
        legs?: Array<{
            startLocation?: { latLng?: { latitude?: number; longitude?: number } };
            endLocation?: { latLng?: { latitude?: number; longitude?: number } };
        }>;
    }>;
}

export async function getRoute(
    origin: string,
    destination: string,
): Promise<{ route: GeoRoute; error?: string }> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { route: {}, error: 'GOOGLE_MAPS_API_KEY not set' };
    }

    try {
        const routeResp = await fetch(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.description',
                },
                body: JSON.stringify({
                    origin: { address: origin },
                    destination: { address: destination },
                    travelMode: 'DRIVE',
                }),
            },
        );

        if (!routeResp.ok) {
            const errText = await routeResp.text();
            return { route: {}, error: `Routes API error ${routeResp.status}: ${errText}` };
        }

        const routeData = (await routeResp.json()) as RoutesApiResponse;
        const r = routeData.routes?.[0];

        return {
            route: {
                distanceMeters: r?.distanceMeters,
                duration: r?.duration,
                startAddress: origin,
                endAddress: destination,
                summary: r?.description,
            },
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { route: {}, error: `Routes API fetch failed: ${message}` };
    }
}

// ─── ANSWER SYNTHESIZER ──────────────────────────────────────────────────────

function synthesizeAnswer(input: GeoMindInput, places: GeoPlace[], weather?: GeoWeather, airQuality?: GeoAirQuality, route?: GeoRoute): string {
    const parts: string[] = [];

    if (places.length > 0) {
        parts.push(`Found ${places.length} place(s) matching "${input.query}"${input.locationHint ? ` near ${input.locationHint}` : ''}:`);
        for (const p of places.slice(0, 5)) {
            const ratingStr = p.rating ? ` (${p.rating}★, ${p.userRatingCount ?? 0} reviews)` : '';
            const openStr = p.openNow !== undefined ? (p.openNow ? ' — Open now' : ' — Closed') : '';
            parts.push(`• ${p.name}${ratingStr}${openStr} — ${p.address}`);
            if (p.editorialSummary) parts.push(`  "${p.editorialSummary}"`);
        }
    }

    if (weather?.temperature !== undefined) {
        parts.push(`\nWeather: ${weather.temperature}°C, ${weather.condition ?? 'N/A'}. Humidity: ${weather.humidity ?? 'N/A'}%. Wind: ${weather.windSpeed ?? 'N/A'} m/s.`);
    }

    if (airQuality?.aqi !== undefined) {
        parts.push(`Air Quality: AQI ${airQuality.aqi} (${airQuality.category ?? 'N/A'}). Dominant pollutant: ${airQuality.dominantPollutant ?? 'N/A'}.`);
    }

    if (route?.duration) {
        const distKm = route.distanceMeters ? (route.distanceMeters / 1000).toFixed(1) : '?';
        const durationMin = route.duration ? (parseInt(route.duration.replace('s', ''), 10) / 60).toFixed(0) : '?';
        parts.push(`\nRoute: ${route.startAddress} → ${route.endAddress}: ${distKm} km, ~${durationMin} min by car.`);
    }

    return parts.length > 0 ? parts.join('\n') : 'No geospatial data found for this query.';
}

// ─── CORE ORCHESTRATOR ───────────────────────────────────────────────────────

export async function callGeoMind(input: GeoMindInput): Promise<GeoMindOutput> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return {
            success: false,
            answer: '',
            places: [],
            dataSources: [],
            errorMessage: 'GOOGLE_MAPS_API_KEY not set — add it to packages/genkit/.env to enable GeoMind',
        };
    }

    const dataSources: string[] = [];
    let places: GeoPlace[] = [];
    let weather: GeoWeather | undefined;
    let airQuality: GeoAirQuality | undefined;
    let route: GeoRoute | undefined;
    const errors: string[] = [];

    // Places search (for modes: places, full)
    if (input.mode === 'places' || input.mode === 'full') {
        const placesResult = await searchPlaces(input.query, input.locationHint, input.placeType, input.maxResults);
        places = placesResult.places;
        if (placesResult.error) errors.push(placesResult.error);
        if (places.length > 0) dataSources.push('Places API (New)');
    }

    // Weather (for modes: weather, full) — requires locationHint
    if ((input.mode === 'weather' || input.mode === 'full') && input.locationHint) {
        const weatherResult = await getWeather(input.locationHint);
        weather = weatherResult.weather;
        if (weatherResult.error) errors.push(weatherResult.error);
        if (weather?.temperature !== undefined) dataSources.push('Weather API');
    }

    // Air Quality (for mode: full) — requires locationHint
    if (input.mode === 'full' && input.locationHint) {
        const aqResult = await getAirQuality(input.locationHint);
        airQuality = aqResult.airQuality;
        if (aqResult.error) errors.push(aqResult.error);
        if (airQuality?.aqi !== undefined) dataSources.push('Air Quality API');
    }

    // Route (for modes: route, full) — requires destination
    if ((input.mode === 'route' || input.mode === 'full') && input.destination && input.locationHint) {
        const routeResult = await getRoute(input.locationHint, input.destination);
        route = routeResult.route;
        if (routeResult.error) errors.push(routeResult.error);
        if (route?.duration) dataSources.push('Routes API');
    }

    const hasData = places.length > 0 || weather?.temperature !== undefined || airQuality?.aqi !== undefined || route?.duration;

    const answer = synthesizeAnswer(input, places, weather, airQuality, route);

    return {
        success: hasData ? true : false,
        answer,
        places,
        weather,
        airQuality,
        route,
        dataSources,
        errorMessage: errors.length > 0 && !hasData ? errors.join('; ') : undefined,
    };
}

// ─── GENKIT FLOW ─────────────────────────────────────────────────────────────

export const geoMindFlow = ai.defineFlow(
    {
        name: 'geoMind',
        inputSchema: GeoMindInputSchema,
        outputSchema: GeoMindOutputSchema,
    },
    async (input) => {
        const startMs = Date.now();
        const result = await callGeoMind(input);
        const durationMs = Date.now() - startMs;

        if (!result.success) {
            console.warn(`[GEO-MIND] Failed for query "${input.query.slice(0, 80)}": ${result.errorMessage}`);
        } else {
            console.log(`[GEO-MIND] ✓ ${result.dataSources.join(' + ')} | ${result.places.length} places | ${durationMs}ms`);
        }

        return result;
    },
);
