export type ApiResponse<T = any> = { status: number; body: T };

// a tiny HTTP client that keeps cookies between calls, like a browser,
// so every role in the tests has its own session
export class ApiClient {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  async call<T = any>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        Cookie: [...this.cookies]
          .map(([name, value]) => `${name}=${value}`)
          .join('; '),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const header of res.headers.getSetCookie()) {
      const [pair] = header.split(';');
      const [name, value] = pair.split('=');
      this.cookies.set(name, value);
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  get<T = any>(path: string) {
    return this.call<T>('GET', path);
  }

  post<T = any>(path: string, body?: unknown) {
    return this.call<T>('POST', path, body ?? {});
  }

  patch<T = any>(path: string, body?: unknown) {
    return this.call<T>('PATCH', path, body ?? {});
  }

  put<T = any>(path: string, body?: unknown) {
    return this.call<T>('PUT', path, body ?? {});
  }
}
