const API = import.meta.env.VITE_API_URL || '/api';

export async function fetchJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`);
    if (res.ok) return await res.json();
    return null;
  } catch {
    return null;
  }
}

export async function postJSON<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return await res.json();
    return null;
  } catch {
    return null;
  }
}

export { API };
