import { Meilisearch } from "meilisearch";
import express from "express";

const client = new Meilisearch({
  host: "http://localhost:7700"
});

const app = express();

app.get("/search", async (req, res) => {
  const query = req.query.q as string;

  const response = await client
    .index("medcom-documents")
    .search(query, {
      limit: 5
    });

  res.json(
    response.hits.map((hit: any) => ({
      title: hit.title,
      url: hit.url,
      version: hit.version,
      snippet: hit.body?.substring(0, 200)
    }))
  );
});

app.listen(3000, () => {
  console.log("Search API running on http://localhost:3000");
});