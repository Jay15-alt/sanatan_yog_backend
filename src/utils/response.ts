// =============================================================
// src/utils/response.ts
// =============================================================

import { Response } from 'express';

export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

interface SuccessEnvelope {
  success: true;
  data: unknown;
  message?: string;
}

interface ErrorEnvelope {
  success: false;
  error: string;
  statusCode: number;
}

export function sendSuccess(res: Response, data: unknown, statusCode: number = 200, message?: string): void {
  const body: SuccessEnvelope = { success: true, data };
  if (message) body.message = message;
  res.status(statusCode).json(body);
}

export function sendError(res: Response, error: string, statusCode: number = 400): void {
  const body: ErrorEnvelope = { success: false, error, statusCode };
  res.status(statusCode).json(body);
}
