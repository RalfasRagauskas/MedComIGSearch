import { Meilisearch } from "meilisearch";
import express from "express";
import cors from "cors";

const client = new Meilisearch({
  host: "http://localhost:7700"
});

const app = express();

app.use(cors());

function createSnippet(text: string | undefined, query: string, contentType: string) {
  const cleanText = (text ?? "").replace(/\s+/g, " ").trim();
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
  const currentIg = req.query.ig as string | undefined;

  // the old index from the crawler.ts 
  // const documentIndex = client.index("medcom-documents");

 // The index for the MedCom FHIR documents from the repository crawler
  const documentIndex = client.index("medcom-fhir-documents");

  // Without a known "current IG", a single global search is the best we can
  // do. With one, two separate queries are run so results from the other IG
  // (which may simply have more/better-matching content) can't crowd the
  // current IG's results out of a shared top-50 cut.
  const searches = [
  documentIndex.search(query, { limit: 50 })
];

  const responses = await Promise.all(searches);

  const hits = responses.flatMap((response) => response.hits);

  res.json(
    hits.map((hit: any) => ({
      title: hit.title,
      url: hit.path,
      path: hit.path,
      text: createSnippet(hit.body, query, "html")
    }))
  );
});

app.listen(3000, () => {
  console.log("Search API running on http://localhost:3000");
});