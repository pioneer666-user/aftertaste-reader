import type { ReaderProblem } from '../application/file-reader.js';

class RequestFailure extends Error {
  constructor(readonly problem: ReaderProblem) { super(problem.code); }
}

export async function request<T>(route: string, init?: RequestInit): Promise<T> {
  const response = await fetch(route, { ...init, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new RequestFailure(data.error);
  return data as T;
}

export function failed(error: unknown): ReaderProblem {
  return error instanceof RequestFailure ? error.problem : {
    code: 'NETWORK_ERROR', message: '', nextStep: '', context: {},
  };
}
