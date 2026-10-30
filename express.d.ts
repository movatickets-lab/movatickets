import "express";

declare global {
  namespace Express {
    interface Request {
      body?: any;
      query?: any;
      params?: any;
      path?: string;
      ip?: string;
      protocol?: string;
      headers?: any;
      cookies?: any;
    }
    interface Response {
      status(code: number): this;
      json(body: any): this;
      send(body?: any): this;
      setHeader(name: string, value: string | string[]): this;
      type(type: string): this;
      cookie(name: string, val: string, options?: any): this;
      clearCookie(name: string, options?: any): this;
    }
  }
}