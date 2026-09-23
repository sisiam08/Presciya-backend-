import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import router from "./routes";
import cookieParser from "cookie-parser";
import { notFound } from "./middleware/notFound";
import globalErrorHandler from "./middleware/globalErrorHandler";
import { generalLimiter } from "./middleware/rateLimiter";
import { requestId, requestLogger } from "./middleware/requestContext";
import config from "./config";

const app: Application = express();

app.use(requestId);
app.use(requestLogger);

app.use(helmet());

// CORS must run before the rate limiter so that a 429 (or any error) response
// still carries CORS headers — otherwise the browser reports a misleading
// "Network Error" and the client cannot read the real status.
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  }),
);

app.use(generalLimiter);

app.use(cookieParser());

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use("/api/v1", router);

app.get("/", (req: Request, res: Response) => {
  res.send("Presciya Server running...");
});

app.use(notFound);
app.use(globalErrorHandler);

export default app;
