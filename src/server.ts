import { Meilisearch } from "meilisearch";
import express from "express";
import cors from "cors";

const client = new Meilisearch({
  host: "http://localhost:7700"
});

const app = express();

app.use(cors());

app.get("/search", async (req, res) => {
  const query = req.query.q as string;

  const response = await client
    .index("medcom-documents")
    .search(query, {
      limit: 50
    });

  res.json(
    response.hits.map((hit: any) => ({
      title: hit.title,
      url: hit.url,
      version: hit.version,
      text: hit.body || "",
      type: "pages",
      path: ""
    }))
  );
});

app.listen(3000, () => {
  console.log("Search API running on http://localhost:3000");
});