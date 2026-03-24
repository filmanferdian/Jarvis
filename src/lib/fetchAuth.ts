export async function fetchAuth<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    let message = `${res.status}`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch { /* use status code */ }
    throw new Error(message);
  }
  return res.json();
}
