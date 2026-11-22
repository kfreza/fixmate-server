import "dotenv/config";
import cs_app from "./cs_app";
import { cs_connectDb } from "./config/cs_db";

const cs_port = Number(process.env.PORT) || 5000;

// Local: connect DB then listen. Vercel: export only
if (!process.env.VERCEL) {
  cs_connectDb()
    .then(() => {
      console.log("MongoDB connected");
      cs_app.listen(cs_port, () => {
        console.log(`FixMate server listening on http://localhost:${cs_port}`);
      });
    })
    .catch((cs_error) => {
      console.error("MongoDB connection failed:", cs_error.message);
      process.exit(1);
    });
}

export default cs_app;
