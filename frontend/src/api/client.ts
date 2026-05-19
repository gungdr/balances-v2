// Thin fetch wrapper. Adds JSON content-type for requests with a body,
// throws ApiError on non-2xx, and returns null for 204 No Content. All API
// calls go through the same-origin Vite proxy so the session cookie travels
// automatically.

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export async function api<T = unknown>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(input, { ...init, headers })

  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      try {
        body = await res.text()
      } catch {
        /* swallow */
      }
    }
    throw new ApiError(res.status, res.statusText || `request failed (${res.status})`, body)
  }

  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}
