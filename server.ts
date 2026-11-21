import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Health & capabilities check (never exposes secret values)
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
    weatherProvider: 'Open-Meteo Live API',
  });
});

interface WeatherDay {
  date: string;
  tempMax: number;
  tempMin: number;
  precipProb: number;
  precipSum: number;
  humidityMax: number;
  windMax: number;
  weatherCode: number;
  condition: string;
}

interface WeatherSuggestionItem {
  name: string;
  category: string;
  quantity: number;
  weightGrams: number;
  reason: string;
}

function describeWmoCode(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Light drizzle';
  if (code >= 61 && code <= 65) return 'Rain showers';
  if (code >= 66 && code <= 67) return 'Freezing rain';
  if (code >= 71 && code <= 77) return 'Snowfall';
  if (code >= 80 && code <= 82) return 'Heavy rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Mixed conditions';
}

function buildWeatherRecommendations(days: WeatherDay[]): WeatherSuggestionItem[] {
  if (days.length === 0) return [];
  const maxTemp = Math.max(...days.map((d) => d.tempMax));
  const minTemp = Math.min(...days.map((d) => d.tempMin));
  const maxPrecipProb = Math.max(...days.map((d) => d.precipProb));
  const totalPrecipMm = days.reduce((acc, d) => acc + d.precipSum, 0);
  const maxHumidity = Math.max(...days.map((d) => d.humidityMax));
  const maxWind = Math.max(...days.map((d) => d.windMax));
  const hasSnow = days.some((d) => (d.weatherCode >= 71 && d.weatherCode <= 77) || d.weatherCode === 85 || d.weatherCode === 86);

  const recs: WeatherSuggestionItem[] = [];

  if (maxPrecipProb >= 40 || totalPrecipMm >= 2) {
    recs.push({
      name: 'Compact travel umbrella',
      category: 'Accessories',
      quantity: 1,
      weightGrams: 260,
      reason: `Rain chance reaches ${Math.round(maxPrecipProb)}% (${totalPrecipMm.toFixed(1)}mm expected).`,
    });
    recs.push({
      name: 'Lightweight waterproof rain jacket',
      category: 'Clothing',
      quantity: 1,
      weightGrams: 340,
      reason: 'Keeps you dry during wet spells without adding heavy bulk.',
    });
    recs.push({
      name: 'Waterproof footwear or shoe covers',
      category: 'Footwear',
      quantity: 1,
      weightGrams: 480,
      reason: 'Protects feet during forecasted showers and wet sidewalks.',
    });
  }

  if (maxTemp >= 28) {
    recs.push({
      name: 'Broad-spectrum SPF 50 sunscreen',
      category: 'Toiletries',
      quantity: 1,
      weightGrams: 120,
      reason: `Daytime highs reach ${Math.round(maxTemp)}°C.`,
    });
    recs.push({
      name: 'UV-protection sunglasses',
      category: 'Accessories',
      quantity: 1,
      weightGrams: 45,
      reason: 'Essential for bright, warm daylight conditions.',
    });
    recs.push({
      name: 'Breathable cotton or linen tops',
      category: 'Clothing',
      quantity: Math.min(5, Math.max(2, days.length)),
      weightGrams: 160,
      reason: `Light, airy fabrics keep you comfortable up to ${Math.round(maxTemp)}°C.`,
    });
  }

  if (maxHumidity >= 75 && maxTemp >= 24) {
    recs.push({
      name: 'Moisture-wicking socks & quick-dry towel',
      category: 'Clothing',
      quantity: 2,
      weightGrams: 180,
      reason: `Humidity peaks near ${Math.round(maxHumidity)}%, so quick-dry fabrics help.`,
    });
    recs.push({
      name: 'Mosquito & insect repellent',
      category: 'Medicines & First Aid',
      quantity: 1,
      weightGrams: 95,
      reason: 'Warm, humid climates often have evening insects.',
    });
  }

  if (minTemp <= 15 && minTemp > 6) {
    recs.push({
      name: 'Packable fleece or light jacket',
      category: 'Clothing',
      quantity: 1,
      weightGrams: 380,
      reason: `Overnight lows dip to ${Math.round(minTemp)}°C.`,
    });
  }

  if (minTemp <= 6) {
    recs.push({
      name: 'Insulated winter coat',
      category: 'Clothing',
      quantity: 1,
      weightGrams: 950,
      reason: `Temperatures drop to ${Math.round(minTemp)}°C.`,
    });
    recs.push({
      name: 'Thermal base layers',
      category: 'Clothing',
      quantity: 2,
      weightGrams: 260,
      reason: 'Retains warmth cleanly under outerwear in cold weather.',
    });
    recs.push({
      name: 'Warm beanie & insulated gloves',
      category: 'Accessories',
      quantity: 1,
      weightGrams: 140,
      reason: 'Prevents heat loss during chilly mornings and nights.',
    });
  }

  if (hasSnow) {
    recs.push({
      name: 'Waterproof insulated snow boots',
      category: 'Footwear',
      quantity: 1,
      weightGrams: 1100,
      reason: 'Snowfall is in the live forecast for your destination.',
    });
  }

  if (maxWind >= 32) {
    recs.push({
      name: 'Windbreaker layer',
      category: 'Clothing',
      quantity: 1,
      weightGrams: 280,
      reason: `Wind gusts up to ${Math.round(maxWind)} km/h are expected.`,
    });
  }

  if (recs.length === 0) {
    recs.push({
      name: 'Versatile light cardigan or overshirt',
      category: 'Clothing',
      quantity: 1,
      weightGrams: 300,
      reason: `Mild ${Math.round(minTemp)}°C–${Math.round(maxTemp)}°C weather suits easy layering.`,
    });
  }

  return recs;
}

// Live Open-Meteo Weather API (zero fabrication; strictly reports live vs out-of-range)
app.get('/api/weather', async (req, res) => {
  try {
    const rawCity = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : '';
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : '';

    if (!rawCity || rawCity.length > 120) {
      return res.status(400).json({ error: 'Please provide a valid city or destination name.' });
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if ((startDate && !datePattern.test(startDate)) || (endDate && !datePattern.test(endDate))) {
      return res.status(400).json({ error: 'Dates must follow YYYY-MM-DD format.' });
    }

    // 1. Geocode destination via hardcoded Open-Meteo HTTPS host
    const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geoUrl.searchParams.set('name', rawCity);
    geoUrl.searchParams.set('count', '1');
    geoUrl.searchParams.set('language', 'en');
    geoUrl.searchParams.set('format', 'json');

    const geoRes = await fetch(geoUrl.toString(), { signal: AbortSignal.timeout(8000) });
    if (!geoRes.ok) {
      return res.status(502).json({ error: 'Weather geocoding service is temporarily unavailable.' });
    }
    const geoData = (await geoRes.json()) as {
      results?: Array<{
        name: string;
        country?: string;
        admin1?: string;
        latitude: number;
        longitude: number;
        timezone?: string;
      }>;
    };

    const place = geoData.results?.[0];
    if (!place) {
      return res.status(404).json({
        error: `Could not find "${rawCity}". Try a major nearby city name (e.g., Kochi, Tokyo, London).`,
      });
    }

    // 2. Fetch live 16-day forecast via hardcoded Open-Meteo Forecast API
    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
    forecastUrl.searchParams.set('latitude', String(place.latitude));
    forecastUrl.searchParams.set('longitude', String(place.longitude));
    forecastUrl.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,relative_humidity_2m_max,wind_speed_10m_max'
    );
    forecastUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m');
    forecastUrl.searchParams.set('forecast_days', '16');
    forecastUrl.searchParams.set('timezone', 'auto');

    const weatherRes = await fetch(forecastUrl.toString(), { signal: AbortSignal.timeout(8000) });
    if (!weatherRes.ok) {
      return res.status(502).json({ error: 'Live weather forecast service could not be reached.' });
    }

    const weatherJson = (await weatherRes.json()) as {
      current?: {
        temperature_2m: number;
        relative_humidity_2m: number;
        weather_code: number;
        wind_speed_10m: number;
      };
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        precipitation_probability_max: number[];
        relative_humidity_2m_max: number[];
        wind_speed_10m_max: number[];
      };
    };

    const daily = weatherJson.daily;
    if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) {
      return res.status(502).json({ error: 'Live forecast data was empty for this destination.' });
    }

    const allDays: WeatherDay[] = daily.time.map((date, idx) => ({
      date,
      tempMax: daily.temperature_2m_max?.[idx] ?? 0,
      tempMin: daily.temperature_2m_min?.[idx] ?? 0,
      precipProb: daily.precipitation_probability_max?.[idx] ?? 0,
      precipSum: daily.precipitation_sum?.[idx] ?? 0,
      humidityMax: daily.relative_humidity_2m_max?.[idx] ?? 50,
      windMax: daily.wind_speed_10m_max?.[idx] ?? 0,
      weatherCode: daily.weather_code?.[idx] ?? 0,
      condition: describeWmoCode(daily.weather_code?.[idx] ?? 0),
    }));

    // Match requested trip window if within live 16-day forecast horizon
    let selectedDays = allDays.slice(0, 5);
    let source: 'live_forecast' | 'current_preview_only' = 'live_forecast';
    let note = 'Live 16-day meteorological forecast from Open-Meteo.';

    if (startDate) {
      const effectiveEnd = endDate && endDate >= startDate ? endDate : startDate;
      const matched = allDays.filter((d) => d.date >= startDate && d.date <= effectiveEnd);
      if (matched.length > 0) {
        selectedDays = matched;
        const requestedSpan =
          Math.round((new Date(effectiveEnd).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
        if (matched.length < requestedSpan) {
          note = `Live forecast covers ${matched.length} of your ${requestedSpan} trip days (Open-Meteo forecasts up to 16 days ahead).`;
        } else {
          note = `Live forecast matched for your exact trip dates (${startDate} to ${effectiveEnd}).`;
        }
      } else {
        source = 'current_preview_only';
        selectedDays = allDays.slice(0, 5);
        note =
          'Your trip dates are outside the live 16-day forecast window. Showing current live weather for this destination — check back within 14 days of departure for exact trip forecasts.';
      }
    }

    const avgHigh = Math.round(selectedDays.reduce((s, d) => s + d.tempMax, 0) / selectedDays.length);
    const avgLow = Math.round(selectedDays.reduce((s, d) => s + d.tempMin, 0) / selectedDays.length);
    const maxRainChance = Math.round(Math.max(...selectedDays.map((d) => d.precipProb)));
    const avgHumidity = Math.round(selectedDays.reduce((s, d) => s + d.humidityMax, 0) / selectedDays.length);

    res.json({
      locationName: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
      shortLocation: place.country ? `${place.name}, ${place.country}` : place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      source,
      note,
      fetchedAt: new Date().toISOString(),
      current: weatherJson.current
        ? {
            temp: Math.round(weatherJson.current.temperature_2m),
            humidity: Math.round(weatherJson.current.relative_humidity_2m),
            windSpeed: Math.round(weatherJson.current.wind_speed_10m),
            condition: describeWmoCode(weatherJson.current.weather_code),
            weatherCode: weatherJson.current.weather_code,
          }
        : null,
      summary: {
        avgHigh,
        avgLow,
        maxRainChance,
        avgHumidity,
        primaryCondition: selectedDays[0]?.condition ?? 'Mixed',
      },
      days: selectedDays,
      recommendations: buildWeatherRecommendations(selectedDays),
    });
  } catch (err) {
    console.error('Weather API error:', err);
    res.status(502).json({
      error: 'Unable to fetch live weather right now. Check your connection and try again.',
    });
  }
});

// Helper to create Gemini client server-side with mandatory telemetry User-Agent
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// PackSmart AI Chat & Contextual Packing Recommendations
app.post('/api/ai/chat', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      code: 'AI_KEY_MISSING',
      error: 'PackSmart AI cloud model is not configured on this server. Switch to Offline Smart Rules Advisor or configure GEMINI_API_KEY in Settings > Secrets.',
    });
  }

  try {
    const body = req.body as {
      message?: unknown;
      listContext?: {
        title?: string;
        destination?: string;
        mode?: string;
        days?: number;
        travellers?: number;
        weatherSummary?: string;
        existingItems?: string[];
      };
    };

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > 1500) {
      return res.status(400).json({ error: 'Please enter a packing question (1–1500 characters).' });
    }

    const ctx = body.listContext;
    const existingList = Array.isArray(ctx?.existingItems)
      ? ctx.existingItems.slice(0, 80).map((s) => String(s).slice(0, 80))
      : [];

    const contextBlock = ctx
      ? `\nActive Packing List Context:\n- Title: ${String(ctx.title || 'Untitled').slice(0, 100)}\n- Mode: ${String(ctx.mode || 'Travel').slice(0, 40)}\n- Destination: ${String(ctx.destination || 'Not specified').slice(0, 100)}\n- Duration: ${Number(ctx.days) || 3} days\n- Travellers: ${Number(ctx.travellers) || 1}\n- Live Weather Context: ${String(ctx.weatherSummary || 'Not loaded').slice(0, 220)}\n- Already on list (DO NOT suggest duplicates of these): ${existingList.join(', ') || 'None yet'}\n`
      : '\nNo specific packing list attached yet.\n';

    const prompt = `${contextBlock}\nUser question: ${message}\n\nRespond as PackSmart AI, a practical, thoughtful packing assistant. Give a clear, concise answer tailored to the user's trip, weather, or situation. Suggest up to 8 high-value packing items that are NOT already in their existing list, explaining specifically WHY each item is recommended, and include up to 3 "commonly forgotten" alerts relevant to their question.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are PackSmart AI, an expert travel, college, work, and emergency packing assistant. Be concise, practical, realistic about weights (in grams), never invent fake weather data if none is provided, and strictly avoid suggesting duplicates of items already in the user list. Categories must be one of: Clothing, Toiletries, Electronics, Documents, Medicines & First Aid, Accessories, Footwear, Miscellaneous.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: 'Helpful, concise conversational advice answering the user question directly.',
            },
            suggestedItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  quantity: { type: Type.INTEGER },
                  weightGrams: { type: Type.INTEGER },
                  reason: { type: Type.STRING },
                },
              },
            },
            forgottenAlerts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText) as {
      reply?: string;
      suggestedItems?: Array<{
        name: string;
        category: string;
        quantity: number;
        weightGrams: number;
        reason: string;
      }>;
      forgottenAlerts?: string[];
    };

    res.json({
      source: 'gemini',
      reply: parsed.reply || 'Here are my tailored packing recommendations.',
      suggestedItems: Array.isArray(parsed.suggestedItems) ? parsed.suggestedItems.slice(0, 10) : [],
      forgottenAlerts: Array.isArray(parsed.forgottenAlerts) ? parsed.forgottenAlerts.slice(0, 4) : [],
    });
  } catch (err) {
    console.error('PackSmart AI chat error:', err);
    res.status(502).json({
      code: 'AI_REQUEST_FAILED',
      error: 'PackSmart AI could not complete the request right now. Please try again or use the Offline Smart Rules Advisor.',
    });
  }
});

// Optional AI enhancement for Smart Packing List Generator
app.post('/api/ai/enhance-list', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      code: 'AI_KEY_MISSING',
      error: 'AI enhancement unavailable without GEMINI_API_KEY.',
    });
  }

  try {
    const body = req.body as {
      destination?: string;
      mode?: string;
      purpose?: string;
      days?: number;
      travellers?: number;
      travelMethod?: string;
      accommodation?: string;
      activities?: string[];
      weatherSummary?: string;
      existingItems?: string[];
    };

    const existing = Array.isArray(body.existingItems) ? body.existingItems.slice(0, 80) : [];
    const prompt = `Destination: ${String(body.destination || 'General').slice(0, 100)}
Mode: ${String(body.mode || 'Travel').slice(0, 40)}
Purpose: ${String(body.purpose || 'Leisure').slice(0, 60)}
Duration: ${Number(body.days) || 3} days, Travellers: ${Number(body.travellers) || 1}
Travel Method: ${String(body.travelMethod || 'Flight').slice(0, 40)}
Accommodation: ${String(body.accommodation || 'Hotel').slice(0, 40)}
Activities: ${(Array.isArray(body.activities) ? body.activities : []).slice(0, 10).join(', ') || 'General sightseeing'}
Weather: ${String(body.weatherSummary || 'Not specified').slice(0, 200)}
Already included (DO NOT repeat): ${existing.join(', ')}

Suggest 5 to 7 smart, destination-specific or activity-specific items that would noticeably improve comfort or preparedness for this exact trip.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are PackSmart AI. Return practical, non-duplicate packing items with accurate gram weights and concise reasons. Use only categories: Clothing, Toiletries, Electronics, Documents, Medicines & First Aid, Accessories, Footwear, Miscellaneous.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  quantity: { type: Type.INTEGER },
                  weightGrams: { type: Type.INTEGER },
                  reason: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      items?: Array<{
        name: string;
        category: string;
        quantity: number;
        weightGrams: number;
        reason: string;
      }>;
    };

    res.json({
      source: 'gemini',
      items: Array.isArray(parsed.items) ? parsed.items.slice(0, 8) : [],
    });
  } catch (err) {
    console.error('AI list enhancement error:', err);
    res.status(502).json({ error: 'Could not fetch AI enhancements.' });
  }
});

// ==================== AI OUTFIT MATCHER: REAL MULTIMODAL VISION ANALYSIS ====================
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VALID_WARDROBE_CATEGORIES = new Set([
  'Tops',
  'Bottoms',
  'Dresses',
  'Footwear',
  'Accessories',
  'Outerwear',
]);
const VALID_WARMTH = new Set(['Warm Weather', 'All-Season', 'Cool & Cold']);

app.post('/api/ai/analyze-clothing', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      code: 'AI_KEY_MISSING',
      error:
        'AI Vision analysis requires GEMINI_API_KEY configured on the server (Settings > Secrets).',
    });
  }

  try {
    const body = req.body as {
      imageBase64?: unknown;
      mimeType?: unknown;
      fileName?: unknown;
    };

    const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';

    if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
      return res.status(400).json({
        error: 'Unsupported image format. Please upload a JPEG, PNG, or WebP photo.',
      });
    }
    if (!imageBase64 || imageBase64.length < 100 || imageBase64.length > 6_000_000) {
      return res.status(400).json({
        error: 'Image payload is empty or too large (max ~4 MB compressed).',
      });
    }

    const imagePart = {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    };

    const textPart = {
      text: `Analyze this uploaded photograph as an expert fashion stylist building a digital travel wardrobe.
1. First determine whether the photo shows a wearable clothing item, shoe, jacket/outerwear, or wearable fashion accessory (isClothing).
2. Identify the exact garment cleanly (name), its strict category (one of: Tops, Bottoms, Dresses, Footwear, Accessories, Outerwear), primary colorName and accurate CSS hex colorHex (e.g. #2A3B5C), secondaryColors array, pattern (e.g. Solid, Striped, Floral, Plaid, Ribbed, Graphic), style (e.g. Smart Casual, Minimalist, Streetwear, Tailored, Resort, Athleisure, Evening), likely fabric, thermal suitability warmth (strictly one of: Warm Weather, All-Season, Cool & Cold), best occasions array (2-4 tags), realistic estimatedWeightGrams (integer), estimatedVolumeLiters (number between 0.2 and 5.5), and a brief 1-sentence stylingNote.`,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction:
          'You are an editorial fashion stylist and computer vision garment analyst. Always inspect the actual image carefully and truthfully. Never fabricate garments if the photo does not contain clothing, footwear, outerwear, or accessories — set isClothing to false and explain briefly in stylingNote.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isClothing: { type: Type.BOOLEAN },
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            colorName: { type: Type.STRING },
            colorHex: { type: Type.STRING },
            secondaryColors: { type: Type.ARRAY, items: { type: Type.STRING } },
            pattern: { type: Type.STRING },
            style: { type: Type.STRING },
            fabric: { type: Type.STRING },
            warmth: { type: Type.STRING },
            occasions: { type: Type.ARRAY, items: { type: Type.STRING } },
            estimatedWeightGrams: { type: Type.INTEGER },
            estimatedVolumeLiters: { type: Type.NUMBER },
            stylingNote: { type: Type.STRING },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      isClothing?: boolean;
      name?: string;
      category?: string;
      colorName?: string;
      colorHex?: string;
      secondaryColors?: string[];
      pattern?: string;
      style?: string;
      fabric?: string;
      warmth?: string;
      occasions?: string[];
      estimatedWeightGrams?: number;
      estimatedVolumeLiters?: number;
      stylingNote?: string;
    };

    if (parsed.isClothing === false) {
      return res.status(422).json({
        code: 'NOT_CLOTHING',
        error:
          parsed.stylingNote ||
          'This photo does not appear to show a clothing item, shoe, jacket, or accessory. Please upload a clear garment photo.',
      });
    }

    const safeCategory = VALID_WARDROBE_CATEGORIES.has(String(parsed.category || ''))
      ? (parsed.category as string)
      : 'Tops';
    const safeWarmth = VALID_WARMTH.has(String(parsed.warmth || ''))
      ? (parsed.warmth as string)
      : 'All-Season';
    const safeHex = /^#[0-9A-Fa-f]{6}$/.test(String(parsed.colorHex || '').trim())
      ? String(parsed.colorHex).trim()
      : '#3A4259';

    res.json({
      source: 'gemini_vision',
      detected: {
        name: String(parsed.name || 'Detected Garment').slice(0, 80),
        category: safeCategory,
        colorName: String(parsed.colorName || 'Neutral').slice(0, 40),
        colorHex: safeHex,
        secondaryColors: Array.isArray(parsed.secondaryColors)
          ? parsed.secondaryColors.slice(0, 4).map((c) => String(c).slice(0, 30))
          : [],
        pattern: String(parsed.pattern || 'Solid').slice(0, 40),
        style: String(parsed.style || 'Casual').slice(0, 40),
        fabric: String(parsed.fabric || 'Cotton Blend').slice(0, 40),
        warmth: safeWarmth,
        occasions: Array.isArray(parsed.occasions)
          ? parsed.occasions.slice(0, 5).map((o) => String(o).slice(0, 35))
          : ['Everyday', 'Travel'],
        estimatedWeightGrams: Math.max(30, Math.min(2500, Math.round(Number(parsed.estimatedWeightGrams) || 220))),
        estimatedVolumeLiters: Math.max(0.2, Math.min(6.0, Number(parsed.estimatedVolumeLiters) || 1.0)),
        stylingNote: String(parsed.stylingNote || '').slice(0, 220),
      },
    });
  } catch (err) {
    console.error('AI clothing vision error:', err);
    res.status(502).json({
      code: 'VISION_FAILED',
      error: 'AI Vision could not analyze this photo right now. Please retry with a clear, well-lit image.',
    });
  }
});

// ==================== AI OUTFIT MATCHER: OWNED-WARDROBE COMBINATION ENGINE ====================
app.post('/api/ai/match-outfits', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      code: 'AI_KEY_MISSING',
      error:
        'AI Outfit Matcher requires GEMINI_API_KEY configured on the server (Settings > Secrets).',
    });
  }

  try {
    const body = req.body as {
      destination?: unknown;
      startDate?: unknown;
      endDate?: unknown;
      durationDays?: unknown;
      weatherSummary?: unknown;
      occasions?: unknown;
      wardrobeItems?: Array<{
        id: string;
        name: string;
        category: string;
        colorName: string;
        pattern?: string;
        style?: string;
        fabric?: string;
        warmth: string;
        occasions?: string[];
      }>;
    };

    const rawItems = Array.isArray(body.wardrobeItems) ? body.wardrobeItems.slice(0, 60) : [];
    if (rawItems.length < 2) {
      return res.status(400).json({
        error: 'Upload or select at least 2 clothing items in your wardrobe to generate outfit combinations.',
      });
    }

    const ownedIdSet = new Set<string>();
    const catalogLines = rawItems
      .filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string')
      .map((item) => {
        ownedIdSet.add(item.id);
        return `- ID: "${item.id}" | ${item.name} | Category: ${item.category} | Color: ${item.colorName} | Pattern: ${item.pattern || 'Solid'} | Style: ${item.style || 'Casual'} | Fabric: ${item.fabric || 'Standard'} | Warmth: ${item.warmth}`;
      });

    if (ownedIdSet.size < 2) {
      return res.status(400).json({
        error: 'At least 2 valid owned wardrobe items are required.',
      });
    }

    const destination = String(body.destination || 'Upcoming Trip').trim().slice(0, 100);
    const durationDays = Math.max(1, Math.min(10, Math.round(Number(body.durationDays) || 4)));
    const weatherSummary = String(body.weatherSummary || 'Mild & versatile weather').trim().slice(0, 260);
    const occasions = Array.isArray(body.occasions)
      ? body.occasions.slice(0, 8).map((o) => String(o).slice(0, 40))
      : ['City Exploring', 'Dinner'];

    const prompt = `Design a ${durationDays}-day capsule travel wardrobe plan for ${destination}.
Travel Dates: ${String(body.startDate || '').slice(0, 20)} to ${String(body.endDate || '').slice(0, 20)} (${durationDays} days)
Weather Conditions: ${weatherSummary}
Trip Occasions: ${occasions.join(', ')}

OWNED WARDROBE INVENTORY (YOU MUST STRICTLY USE ONLY THESE ITEM IDs — NEVER INVENT OR REFERENCE ANY UNOWNED ITEM):
${catalogLines.join('\n')}

STRICT STYLING RULES:
1. Generate ${durationDays} daily outfit combinations (one per day, dayIndex 1 through ${durationDays}).
2. Every outfit's "itemIds" array MUST contain ONLY exact ID strings copied verbatim from the OWNED WARDROBE INVENTORY above.
3. Maximize outfit variety while minimizing total unique clothing pieces packed (intelligently reuse versatile bottoms, outerwear, shoes, and accessories across different tops/dresses).
4. NEVER repeat the exact same combination of itemIds on two different days (if the wardrobe is very small, vary layers, footwear, or accessories cleanly).
5. Ensure every outfit suits the destination weather and aligns with one of the requested occasions.
6. For each outfit, provide a brief, genuine editorial "whyItWorks" explanation (color harmony, proportion, fabric/weather logic) and a short "stylingTip" (e.g., French tuck, rolled sleeves, layering).
7. Separately in "missingPieces", suggest 2 to 4 strategic missing clothing pieces (NOT currently in the owned wardrobe) that would unlock multiple new outfit combinations for this trip.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an editorial capsule wardrobe stylist for PackSmart. You strictly build outfits ONLY from the exact owned wardrobe IDs provided. Your tone is refined, concise, and practical.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            capsuleSummary: {
              type: Type.STRING,
              description: '2-sentence editorial summary of how this minimal capsule achieves maximum variety.',
            },
            outfits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dayIndex: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  occasion: { type: Type.STRING },
                  weatherFit: { type: Type.STRING },
                  itemIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  whyItWorks: { type: Type.STRING },
                  stylingTip: { type: Type.STRING },
                },
              },
            },
            missingPieces: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  colorSuggestion: { type: Type.STRING },
                  impactSummary: { type: Type.STRING },
                  unlockedCombosCount: { type: Type.INTEGER },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      capsuleSummary?: string;
      outfits?: Array<{
        dayIndex: number;
        title: string;
        occasion: string;
        weatherFit: string;
        itemIds: string[];
        whyItWorks: string;
        stylingTip: string;
      }>;
      missingPieces?: Array<{
        name: string;
        category: string;
        colorSuggestion: string;
        impactSummary: string;
        unlockedCombosCount: number;
      }>;
    };

    // Strict server-side ownership enforcement & deduplication
    const seenSignatures = new Set<string>();
    const verifiedOutfits = (Array.isArray(parsed.outfits) ? parsed.outfits : [])
      .map((o, idx) => {
        const validIds = Array.from(
          new Set((Array.isArray(o.itemIds) ? o.itemIds : []).filter((id) => ownedIdSet.has(id)))
        );
        return {
          dayIndex: Number(o.dayIndex) || idx + 1,
          title: String(o.title || `Day ${idx + 1} Capsule Look`).slice(0, 90),
          occasion: String(o.occasion || occasions[idx % occasions.length] || 'Travel Day').slice(0, 50),
          weatherFit: String(o.weatherFit || weatherSummary).slice(0, 60),
          itemIds: validIds,
          whyItWorks: String(o.whyItWorks || 'Balanced silhouette and color pairing suited to your trip weather.').slice(0, 260),
          stylingTip: String(o.stylingTip || 'Layer cleanly for temperature shifts.').slice(0, 180),
        };
      })
      .filter((o) => {
        if (o.itemIds.length === 0) return false;
        const sig = [...o.itemIds].sort().join('|');
        if (seenSignatures.has(sig)) return false;
        seenSignatures.add(sig);
        return true;
      })
      .map((o, idx) => ({ ...o, dayIndex: idx + 1 }));

    if (verifiedOutfits.length === 0) {
      return res.status(422).json({
        error:
          'Could not form complete outfits from the selected items alone. Try uploading at least one top/dress and one bottom or footwear piece.',
      });
    }

    const usageCounts = new Map<string, number>();
    verifiedOutfits.forEach((o) =>
      o.itemIds.forEach((id) => usageCounts.set(id, (usageCounts.get(id) || 0) + 1))
    );
    const uniquePiecesUsed = usageCounts.size;
    const reusedPiecesCount = Array.from(usageCounts.values()).filter((c) => c > 1).length;

    const missingPieces = (Array.isArray(parsed.missingPieces) ? parsed.missingPieces : [])
      .slice(0, 4)
      .map((m) => ({
        name: String(m.name || '').slice(0, 80),
        category: VALID_WARDROBE_CATEGORIES.has(String(m.category || '')) ? m.category : 'Outerwear',
        colorSuggestion: String(m.colorSuggestion || 'Neutral').slice(0, 40),
        impactSummary: String(m.impactSummary || 'Pairs effortlessly across multiple tops and bottoms.').slice(0, 220),
        unlockedCombosCount: Math.max(2, Math.min(12, Math.round(Number(m.unlockedCombosCount) || 3))),
      }))
      .filter((m) => m.name.length > 0);

    res.json({
      source: 'gemini_stylist',
      capsuleSummary:
        String(parsed.capsuleSummary || '').slice(0, 340) ||
        `Created ${verifiedOutfits.length} distinct outfits using ${uniquePiecesUsed} owned pieces, reusing ${reusedPiecesCount} versatile staples to keep your luggage light.`,
      outfits: verifiedOutfits,
      missingPieces,
      stats: {
        totalOutfits: verifiedOutfits.length,
        uniquePiecesUsed,
        reusedPiecesCount,
      },
    });
  } catch (err) {
    console.error('AI outfit matcher error:', err);
    res.status(502).json({
      code: 'MATCH_FAILED',
      error: 'AI Outfit Matcher could not generate combinations right now. Please try again shortly.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PackSmart server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
