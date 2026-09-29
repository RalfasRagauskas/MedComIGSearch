import { Meilisearch } from "meilisearch";
import express from "express";
import cors from "cors";

const client = new Meilisearch({
  host: "http://localhost:7700"
});

const app = express();

app.use(cors());

function createSnippet(text: string, query: string) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) {
    return text?.substring(0, 300);
  }
  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + query.length + 50);
  return (start > 0 ? "..." : "") + text.substring(start, end)
   + (end < text.length ? "..." : "");
}

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
    type: hit.type || "pages",
    path: hit.url,
    text: createSnippet(hit.body ?? "", query)
  }))
);
});

app.listen(3000, () => {
  console.log("Search API running on http://localhost:3000");
});