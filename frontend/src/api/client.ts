/**
 * Type-safe API client using generated types from OpenAPI schema.
 *
 * Usage:
 *   import { api } from '@/api/client'
 *   import type { ItemRead, ItemCreate } from '@/api/types'
 *
 *   // List items
 *   const items = await api.items.list()
 *
 *   // Create item
 *   const newItem = await api.items.create({ name: 'Test', price: 9.99 })
 *
 *   // Get item
 *   const item = await api.items.get('uuid-here')
 */

import type {
  HealthResponse,
  ItemRead,
  ItemCreate,
  ItemUpdate,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(`API Error: ${status} ${statusText}`)
    this.name = 'ApiError'
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }

  const response = await fetch(url, config)

  if (!response.ok) {
    let data
    try {
      data = await response.json()
    } catch {
      data = undefined
    }
    throw new ApiError(response.status, response.statusText, data)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

/**
 * Type-safe API client with methods for each resource.
 */
// Chat types
interface ChatMessage {
  message: string
  conversation_history?: Array<{ role: string; content: string }>
}

interface ChatResponse {
  response: string
  tool_calls: Array<{
    tool: string
    arguments: Record<string, unknown>
    result: unknown
  }>
}

interface ChatStatus {
  configured: boolean
  model: string
}

export const api = {
  /**
   * Health check endpoints
   */
  health: {
    check: () => request<HealthResponse>('/health'),
  },

  /**
   * Chat with AI assistant
   */
  chat: {
    send: (message: string, history?: Array<{ role: string; content: string }>) =>
      request<ChatResponse>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message,
          conversation_history: history,
        } as ChatMessage),
      }),
    status: () => request<ChatStatus>('/api/chat/status'),
  },

  /**
   * Items CRUD operations
   */
  items: {
    list: (params?: { skip?: number; limit?: number }) => {
      const searchParams = new URLSearchParams()
      if (params?.skip) searchParams.set('skip', String(params.skip))
      if (params?.limit) searchParams.set('limit', String(params.limit))
      const query = searchParams.toString()
      return request<ItemRead[]>(`/items${query ? `?${query}` : ''}`)
    },

    get: (id: string) => request<ItemRead>(`/items/${id}`),

    create: (data: ItemCreate) =>
      request<ItemRead>('/items', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: ItemUpdate) =>
      request<ItemRead>(`/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      request<void>(`/items/${id}`, {
        method: 'DELETE',
      }),
  },
}

/**
 * Generic request helpers for custom endpoints
 */
export const apiRequest = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  put: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  patch: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, {
      method: 'DELETE',
    }),
}

export { ApiError }
