import express, {
  Application,
  Request,
  Response
} from "express";

const app: Application = express();

app.use(express.json());

app.use(express.urlencoded({
    extended: true
  }));

app.get("/",(_req: Request, res: Response)=>{
  res.status(200).json({
    success : true,
    message : "Welcome to HRMS SaaS"
  })
});

app.get("/health",(_req: Request, res: Response)=>{
  res.status(200).json({
    success: true,
    message : "HRMS Api Running"
  })
});

export default app;