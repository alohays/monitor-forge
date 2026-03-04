import { corsHeaders } from './cors.js';

export function errorResponse(status: number, message: string, headers?: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...headers },
    },
  );
}

export function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...headers },
    },
  );
}
