import "dotenv/config";
import cs_app from "./cs_app";

const cs_port = Number(process.env.PORT) || 5000;

// On Vercel the app is exported and run as a serverless function;
// locally we start a normal HTTP server.
if (!process.env.VERCEL) {
  cs_app.listen(cs_port, () => {
    console.log(`FixMate server listening on http://localhost:${cs_port}`);
  });
}

export default cs_app;
