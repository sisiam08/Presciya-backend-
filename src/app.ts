import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import router from "./routes";
import cookieParser from "cookie-parser";
import { notFound } from "./middleware/notFound";
import globalErrorHandler from "./middleware/globalErrorHandler";
import { generalLimiter } from "./middleware/rateLimiter";

const app: Application = express();

app.use(helmet());
app.use(generalLimiter);

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

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
