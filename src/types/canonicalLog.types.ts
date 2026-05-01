export interface CanonicalOperation {
  name: string;
  result: "success" | "failure" | "skipped";
  durationMs?: number;
  detail?: string;
}

export interface CanonicalLogContext {
  requestId: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;

  userId?: string;
  userRole?: string;
  authStatus?: "authenticated" | "unauthenticated" | "token_expired" | "token_invalid";

  statusCode?: number;
  contentLength?: string;
  durationMs?: number;

  operations: CanonicalOperation[];

  resourceIds?: Record<string, string>;

  db?: {
    queriesExecuted: number;
    totalDbDurationMs: number;
  };
  cache?: {
    hits: number;
    misses: number;
  };
  s3?: {
    presignedUrlsGenerated: number;
  };

  error?: {
    name: string;
    message: string;
    stack?: string;
    isOperational: boolean;
  };
}
