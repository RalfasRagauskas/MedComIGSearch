import { Meilisearch } from "meilisearch";
import express from "express";
import cors from "cors";

const client = new Meilisearch({
  host: "http://localhost:7700"
});

const app = express();

app.use(cors());

function createSnippet(text: string, query: string, contentType: string) {
  const cleanText = text.replace(/\s+/g, " ").trim();
  const lowerText = cleanText.toLowerCase();
  const lowerQuery = query.toLowerCase();

  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return cleanText.substring(
      0,
      contentType === "html" ? 200 : 100
    );
  }

  const context = contentType === "html" ? 75 : 40;

  const start = Math.max(0, index - context);
  const end = Math.min(
    cleanText.length,
    index + query.length + context
  );

  return (
    (start > 0 ? "..." : "") +
    cleanText.substring(start, end) +
    (end < cleanText.length ? "..." : "")
  );
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
    text: createSnippet(
  hit.body ?? "",
  query,
  hit.contentType || "html"
    ),
    breadcrumb: hit.breadcrumb || [],
    contentType: hit.contentType || "html"
  }))
);
});

app.listen(3000, () => {
  console.log("Search API running on http://localhost:3000");
});