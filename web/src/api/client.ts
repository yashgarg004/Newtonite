export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('auth_token');
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network error: unable to reach the server');
  }

  if (!res.ok) {
    let body: ErrorBody;
    try {
      body = (await res.json()) as ErrorBody;
    } catch {
      throw new ApiError(res.status, 'INTERNAL', 'Unexpected error response');
    }

    if (res.status === 401) {
      clearToken();
      window.location.href = '/login';
    }

    throw new ApiError(
      res.status,
      body.error.code,
      body.error.message,
      body.error.details,
    );
  }

  return (await res.json()) as T;
}
