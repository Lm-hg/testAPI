import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRouter from './routes/upload';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: false }));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
  })
);

app.get('/', (_req, res) => res.json({ ok: true, service: 'testapi' }));
app.get('/__routes', (_req, res) => {
  // list mounted routes for debug
  const routes: any[] = [];
  (app as any)._router.stack.forEach((r: any) => {
    if (r.route && r.route.path) {
      routes.push({ path: r.route.path, methods: r.route.methods });
    } else if (r.name === 'router' && r.regexp) {
      routes.push({ name: r.name, regexp: r.regexp.toString() });
    }
  });
  res.json(routes);
});
app.use('/upload', uploadRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: any) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
