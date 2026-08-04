import { RequestContext } from "./request-context.interface";

declare global {
  namespace Express {
    interface Request {
      context:   RequestContext;
      requestId: string;
    }
  }
}

export {};