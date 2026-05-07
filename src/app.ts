import express, { Application, Request, Response } from "express";
import cors from "cors";
import router from "./routes";

const app: Application = express();

// app.post(
//   "/webhook",
//   express.raw({ type: "application/json" }),
//   PaymentController.handlerStripeWebshookEvent,
// );

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);


app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use("/api/v1", router);

app.get("/", (req: Request, res: Response) => {
  res.send("Doctrivo Server running...");
});


export default app;
