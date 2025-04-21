const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function getParticipants(): Promise<string[]> {
  const res = await fetch(`${API_URL}/participants`);
  if (!res.ok) throw new Error('Failed to fetch participants');
  return res.json();
}

export async function getPending(): Promise<{ name: string; amount: number }[]> {
  const res = await fetch(`${API_URL}/pending`);
  if (!res.ok) throw new Error('Failed to fetch pending');
  return res.json();
}

export async function spinWheel(): Promise<{ success: boolean; winner?: string; message?: string }> {
  const res = await fetch(`${API_URL}/spin`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to spin wheel');
  return res.json();
}

export async function getWinners(): Promise<string[]> {
  const res = await fetch(`${API_URL}/winners`);
  if (!res.ok) throw new Error('Failed to fetch winners');
  return res.json();
}

export async function getPrizepool(): Promise<{ total: number }> {
  const res = await fetch(`${API_URL}/prizepool`);
  if (!res.ok) throw new Error('Failed to fetch prize pool');
  return res.json();
}

export async function getTimer(): Promise<{ secondsRemaining: number }> {
  const res = await fetch(`${API_URL}/timer`);
  if (!res.ok) throw new Error('Failed to fetch timer');
  return res.json();
}
