const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    let message: string;
    if (Array.isArray(body.detail)) {
      // Pydantic validation errors: [{ loc: [...], msg: "...", type: "..." }]
      message = body.detail
        .map((e: { loc?: string[]; msg?: string }) => {
          const field = e.loc ? e.loc.filter((s) => s !== "body").join(".") : "";
          return field ? `${field}: ${e.msg}` : (e.msg ?? "Error de validación");
        })
        .join(" · ");
    } else {
      message = typeof body.detail === "string" ? body.detail : `Error ${res.status}`;
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
