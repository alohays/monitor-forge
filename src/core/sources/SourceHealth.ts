export interface SourceHealth {
  status: 'online' | 'degraded' | 'offline';
  lastSuccess: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
}
