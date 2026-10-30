export {};

declare global {
  namespace Express {
    interface Request {
      cookies?: any;
    }
  }
}