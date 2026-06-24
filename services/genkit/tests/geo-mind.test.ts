/**
 * GeoMind Vitest Suite
 *
 * Covers:
 *  - callGeoMind: orchestrator with mocked fetch for all Google Maps APIs
 *  - searchPlaces: mocked Places API (New) — text search
 *  - getWeather: mocked Geocoding + Weather API
 *  - getAirQuality: mocked Geocoding + Air Quality API
 *  - getRoute: mocked Routes API
 *
 * NOTE: Flow-level tests (geoMindFlow) require a live Genkit context.
 * This unit test suite runs fully offline — no API keys, no Genkit init required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── MOCK GENKIT AI MODULE ────────────────────────────────────────────────────
vi.mock('../src/index.js', () => ({
    ai: {
        defineFlow: vi.fn((_config: unknown, fn: unknown) => fn),
        generate: vi.fn(),
    },
}));

// Import pure functions after mock is set up
import { callGeoMind, searchPlaces, getWeather, getAirQuality, getRoute } from '../src/flows/geo-mind.js';

// ─── MOCK RESPONSES ──────────────────────────────────────────────────────────

const mockPlacesResponse = {
    places: [
        {
            displayName: { text: 'Blue Bottle Coffee' },
            formattedAddress: '1 Rockefeller Plaza, New York, NY 10020',
            rating: 4.5,
            userRatingCount: 1200,
            priceLevel: 'PRICE_LEVEL_MODERATE',
            types: ['cafe', 'food'],
            googleMapsUri: 'https://maps.google.com/?cid=123',
            currentOpeningHours: { openNow: true },
            editorialSummary: { text: 'Specialty coffee roasters with a minimalist vibe.' },
        },
        {
            displayName: { text: 'Stumptown Coffee Roasters' },
            formattedAddress: '18 W 29th St, New York, NY 10001',
            rating: 4.3,
            userRatingCount: 890,
            types: ['cafe'],
        },
    ],
};

const mockGeocodeResponse = {
    results: [{
        geometry: {
            location: { lat: 40.7580, lng: -73.9855 },
        },
    }],
};

const mockWeatherResponse = {
    currentConditions: {
        temperature: { degrees: 18 },
        weatherCondition: 'Partly Cloudy',
        humidity: { percent: 55 },
        wind: { speed: { value: 3.5 } },
        uvIndex: 4,
    },
};

const mockAirQualityResponse = {
    indexes: [{
        aqi: 42,
        category: 'Good',
        dominantPollutant: 'PM2.5',
    }],
};

const mockRoutesResponse = {
    routes: [{
        distanceMeters: 12500,
        duration: '1800s',
        description: 'via FDR Dr',
    }],
};

// ─── SEARCH PLACES — MOCKED FETCH ────────────────────────────────────────────

describe('searchPlaces — mocked Places API (New)', () => {
    beforeEach(() => {
        process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key-abc123';
        global.fetch = vi.fn();
    });

    afterEach(() => {
        delete process.env.GOOGLE_MAPS_API_KEY;
        vi.restoreAllMocks();
    });

    it('returns places with correct structure on success', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => mockPlacesResponse,
        } as Response);

        const result = await searchPlaces('coffee near Times Square');

        expect(result.places).toHaveLength(2);
        expect(result.places[0].name).toBe('Blue Bottle Coffee');
        expect(result.places[0].rating).toBe(4.5);
        expect(result.places[0].openNow).toBe(true);
        expect(result.places[0].editorialSummary).toContain('Specialty coffee');
        expect(result.error).toBeUndefined();
    });

    it('returns empty array + error when API key is missing', async () => {
        delete process.env.GOOGLE_MAPS_API_KEY;

        const result = await searchPlaces('coffee');

        expect(result.places).toEqual([]);
        expect(result.error).toContain('GOOGLE_MAPS_API_KEY not set');
    });

    it('returns error on non-OK HTTP status', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            status: 403,
            text: async () => 'Forbidden',
        } as Response);

        const result = await searchPlaces('coffee');

        expect(result.places).toEqual([]);
        expect(result.error).toContain('403');
    });

    it('handles network failure without throwing', async () => {
        vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network timeout'));

        const result = await searchPlaces('coffee');

        expect(result.places).toEqual([]);
        expect(result.error).toContain('Network timeout');
    });

    it('sends correct X-Goog-Api-Key header', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ places: [] }),
        } as Response);

        await searchPlaces('test query');

        const callArgs = vi.mocked(global.fetch).mock.calls[0];
        const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
        expect(headers['X-Goog-Api-Key']).toBe('test-maps-key-abc123');
    });

    it('handles empty places array gracefully', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ places: [] }),
        } as Response);

        const result = await searchPlaces('nonexistent place xyz');

        expect(result.places).toEqual([]);
        expect(result.error).toBeUndefined();
    });
});

// ─── GET WEATHER — MOCKED FETCH ──────────────────────────────────────────────

describe('getWeather — mocked Geocoding + Weather API', () => {
    beforeEach(() => {
        process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key-abc123';
        global.fetch = vi.fn();
    });

    afterEach(() => {
        delete process.env.GOOGLE_MAPS_API_KEY;
        vi.restoreAllMocks();
    });

    it('returns weather data on success', async () => {
        vi.mocked(global.fetch)
            .mockResolvedValueOnce({ ok: true, json: async () => mockGeocodeResponse } as Response)
            .mockResolvedValueOnce({ ok: true, json: async () => mockWeatherResponse } as Response);

        const result = await getWeather('Times Square, New York');

        expect(result.weather.temperature).toBe(18);
        expect(result.weather.condition).toBe('Partly Cloudy');
        expect(result.weather.humidity).toBe(55);
        expect(result.error).toBeUndefined();
    });

    it('returns error when API key missing', async () => {
        delete process.env.GOOGLE_MAPS_API_KEY;

        const result = await getWeather('New York');

        expect(result.error).toContain('GOOGLE_MAPS_API_KEY not set');
    });

    it('handles geocode failure gracefully', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            status: 500,
        } as Response);

        const result = await getWeather('Invalid Location');

        expect(result.error).toContain('Geocoding failed');
    });
});

// ─── GET AIR QUALITY — MOCKED FETCH ──────────────────────────────────────────

describe('getAirQuality — mocked Geocoding + Air Quality API', () => {
    beforeEach(() => {
        process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key-abc123';
        global.fetch = vi.fn();
    });

    afterEach(() => {
        delete process.env.GOOGLE_MAPS_API_KEY;
        vi.restoreAllMocks();
    });

    it('returns AQI data on success', async () => {
        vi.mocked(global.fetch)
            .mockResolvedValueOnce({ ok: true, json: async () => mockGeocodeResponse } as Response)
            .mockResolvedValueOnce({ ok: true, json: async () => mockAirQualityResponse } as Response);

        const result = await getAirQuality('Times Square, New York');

        expect(result.airQuality.aqi).toBe(42);
        expect(result.airQuality.category).toBe('Good');
        expect(result.airQuality.dominantPollutant).toBe('PM2.5');
        expect(result.error).toBeUndefined();
    });
});

// ─── GET ROUTE — MOCKED FETCH ────────────────────────────────────────────────

describe('getRoute — mocked Routes API', () => {
    beforeEach(() => {
        process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key-abc123';
        global.fetch = vi.fn();
    });

    afterEach(() => {
        delete process.env.GOOGLE_MAPS_API_KEY;
        vi.restoreAllMocks();
    });

    it('returns route data on success', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => mockRoutesResponse,
        } as Response);

        const result = await getRoute('Times Square, NY', 'JFK Airport, NY');

        expect(result.route.distanceMeters).toBe(12500);
        expect(result.route.duration).toBe('1800s');
        expect(result.route.startAddress).toBe('Times Square, NY');
        expect(result.route.endAddress).toBe('JFK Airport, NY');
        expect(result.error).toBeUndefined();
    });

    it('returns error when API key missing', async () => {
        delete process.env.GOOGLE_MAPS_API_KEY;

        const result = await getRoute('A', 'B');

        expect(result.error).toContain('GOOGLE_MAPS_API_KEY not set');
    });
});

// ─── CALL GEO MIND — ORCHESTRATOR ───────────────────────────────────────────

describe('callGeoMind — full orchestrator', () => {
    beforeEach(() => {
        process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key-abc123';
        global.fetch = vi.fn();
    });

    afterEach(() => {
        delete process.env.GOOGLE_MAPS_API_KEY;
        vi.restoreAllMocks();
    });

    it('returns success=false with message when API key missing', async () => {
        delete process.env.GOOGLE_MAPS_API_KEY;

        const result = await callGeoMind({ query: 'coffee', mode: 'places', maxResults: 5 });

        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain('GOOGLE_MAPS_API_KEY not set');
        expect(result.places).toEqual([]);
        expect(result.dataSources).toEqual([]);
    });

    it('returns places in places-only mode', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => mockPlacesResponse,
        } as Response);

        const result = await callGeoMind({
            query: 'coffee near Times Square',
            mode: 'places',
            maxResults: 5,
        });

        expect(result.success).toBe(true);
        expect(result.places).toHaveLength(2);
        expect(result.dataSources).toContain('Places API (New)');
        expect(result.answer).toContain('Blue Bottle Coffee');
    });

    it('populates dataSources for each API called in full mode', async () => {
        vi.mocked(global.fetch)
            // Places API
            .mockResolvedValueOnce({ ok: true, json: async () => mockPlacesResponse } as Response)
            // Geocode for weather
            .mockResolvedValueOnce({ ok: true, json: async () => mockGeocodeResponse } as Response)
            // Weather API
            .mockResolvedValueOnce({ ok: true, json: async () => mockWeatherResponse } as Response)
            // Geocode for air quality
            .mockResolvedValueOnce({ ok: true, json: async () => mockGeocodeResponse } as Response)
            // Air Quality API
            .mockResolvedValueOnce({ ok: true, json: async () => mockAirQualityResponse } as Response);

        const result = await callGeoMind({
            query: 'coffee',
            mode: 'full',
            locationHint: 'Times Square, New York',
            maxResults: 5,
        });

        expect(result.success).toBe(true);
        expect(result.dataSources).toContain('Places API (New)');
        expect(result.dataSources).toContain('Weather API');
        expect(result.dataSources).toContain('Air Quality API');
    });

    it('never throws — graceful degradation on all failures', async () => {
        vi.mocked(global.fetch).mockRejectedValue(new Error('Total network failure'));

        const result = await callGeoMind({
            query: 'coffee',
            mode: 'full',
            locationHint: 'New York',
            maxResults: 5,
        });

        // CRITICAL: must NOT throw
        expect(result.success).toBe(false);
        expect(result.places).toEqual([]);
    });
});
