type CostChangeCallback = (sessionId: string, cost: string) => void;

const costs = new Map<string, string>();
const listeners: CostChangeCallback[] = [];

// Strip ANSI escape codes and search for dollar cost patterns
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?(?:\x07|\x1b\\)/g;
const COST_RE = /\$(\d+\.\d{2,})/g;

export function parseCost(sessionId: string, rawData: string): void {
  const clean = rawData.replace(ANSI_RE, '');
  let match: RegExpExecArray | null;
  let lastCost: string | null = null;

  while ((match = COST_RE.exec(clean)) !== null) {
    lastCost = match[0];
  }

  if (lastCost && lastCost !== costs.get(sessionId)) {
    costs.set(sessionId, lastCost);
    for (const cb of listeners) cb(sessionId, lastCost);
  }
}

export function getCost(sessionId: string): string | null {
  return costs.get(sessionId) ?? null;
}

export function onChange(callback: CostChangeCallback): void {
  listeners.push(callback);
}

export function removeSession(sessionId: string): void {
  costs.delete(sessionId);
}
