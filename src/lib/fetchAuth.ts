export async function fetchAuth<T>(url: string): Promise<T> {
  const token = localStorage.getItem('jarvis_token') || '';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
