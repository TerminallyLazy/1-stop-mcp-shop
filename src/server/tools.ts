import fetch from 'node-fetch';
import { z } from 'zod';

const BRAVE_API_BASE = 'https://api.search.brave.com/res/v1';

// Common types for Brave API responses
interface BraveErrorResponse {
  error: {
    code: number;
    message: string;
  };
}

interface BraveWebResult {
  title: string;
  url: string;
  description: string;
}

interface BraveNewsResult {
  title: string;
  url: string;
  description: string;
  published_time: string;
  source: string;
}

interface BraveImageResult {
  title: string;
  url: string;
  source_url: string;
  width: number;
  height: number;
}

// Helper function to make authenticated requests to Brave API
async function braveFetch(endpoint: string, params: Record<string, string>) {
  const queryString = new URLSearchParams(params).toString();
  const url = `${BRAVE_API_BASE}${endpoint}?${queryString}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': process.env.BRAVE_API_KEY!
      }
    });

    if (!response.ok) {
      const error = await response.json() as BraveErrorResponse;
      throw new Error(`Brave API error: ${error.error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch from Brave API: ${error.message}`);
    }
    throw error;
  }
}

// Tool implementations
export async function braveWebSearch(params: {
  query: string;
  country?: string;
  results_count?: number;
}) {
  const searchParams = {
    q: params.query,
    country: params.country || 'US',
    count: String(params.results_count || 10)
  };

  const data = await braveFetch('/search', searchParams) as { web: { results: BraveWebResult[] } };
  return {
    results: data.web.results.map((result: BraveWebResult) => ({
      title: result.title,
      url: result.url,
      description: result.description
    }))
  };
}

export async function braveNewsSearch(params: {
  query: string;
  time_range?: 'day' | 'week' | 'month' | 'year';
  results_count?: number;
}) {
  const searchParams = {
    q: params.query,
    type: 'news',
    time_range: params.time_range || 'week',
    count: String(params.results_count || 5)
  };

  const data = await braveFetch('/news', searchParams) as { news: { results: BraveNewsResult[] } };
  return {
    results: data.news.results.map((result: BraveNewsResult) => ({
      title: result.title,
      url: result.url,
      description: result.description,
      published_time: result.published_time,
      source: result.source
    }))
  };
}

export async function braveImageSearch(params: {
  query: string;
  image_size?: 'small' | 'medium' | 'large' | 'any';
  results_count?: number;
}) {
  const searchParams = {
    q: params.query,
    type: 'images',
    size: params.image_size || 'any',
    count: String(params.results_count || 10)
  };

  const data = await braveFetch('/images', searchParams) as { images: { results: BraveImageResult[] } };
  return {
    results: data.images.results.map((result: BraveImageResult) => ({
      title: result.title,
      url: result.url,
      source_url: result.source_url,
      dimensions: {
        width: result.width,
        height: result.height
      }
    }))
  };
}