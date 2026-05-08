
export interface IAppErrorType extends Error {
  statusCode: number;
  isOperational: boolean;
}
export interface IErrorSource {
  path: string;
  message: string;
}