/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 *
 * This file is generated from the FastAPI OpenAPI schema.
 * To regenerate, run: npm run codegen
 *
 * Make sure the backend is running first:
 *   docker compose up -d backend
 *   npm run codegen
 *
 * Or if running locally:
 *   cd ../backend && uvicorn app.main:app
 *   npm run codegen
 */

// Placeholder types - run `npm run codegen` to generate actual types
// These will be replaced with types from your OpenAPI schema

export interface HealthResponse {
  status: string
  service: string
}

export interface ItemRead {
  id: string
  name: string
  description: string | null
  price: number
  is_available: boolean
  created_at: string
  updated_at: string
}

export interface ItemCreate {
  name: string
  description?: string | null
  price: number
  is_available?: boolean
}

export interface ItemUpdate {
  name?: string | null
  description?: string | null
  price?: number | null
  is_available?: boolean | null
}

export interface ValidationError {
  loc: (string | number)[]
  msg: string
  type: string
}

export interface HTTPValidationError {
  detail: ValidationError[]
}
