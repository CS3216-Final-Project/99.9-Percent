import app from './app.js';

// On Vercel the exported app is used directly; locally we start a server.
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

export default app;
