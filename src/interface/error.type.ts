
export interface IAppErrorType extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
}
export interface IErrorSource {
  path: string;
  message: string;
}