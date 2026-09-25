import express from "express";

const app = express();

app.get("/search", (req, res) => {
  res.json({ message: "Search API works" });
});

app.listen(3000, () => {
  console.log("Search API running on http://localhost:3000");
});