import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.send("API working 🚀");
});

export default router;