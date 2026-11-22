// Error with an HTTP status code, handled by cs_errorHandler
export class Cs_AppError extends Error {
  cs_statusCode: number;

  constructor(cs_statusCode: number, cs_message: string) {
    super(cs_message);
    this.name = "Cs_AppError";
    this.cs_statusCode = cs_statusCode;
  }
}
