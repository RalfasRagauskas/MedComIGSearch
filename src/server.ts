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

const filters: string[] = [];
if (currentIg) {
  filters.push(`ig = "${currentIg}"`);
}
const version = req.query.version as string | undefined;
if (version) {
  filters.push(`version = "${version}"`);
}
const filterString = filters.join(" AND ");

 // The index for the MedCom FHIR documents from the repository crawler
  const documentIndex = client.index("medcom-fhir-documents");

 

 
const searchOptions: { limit: number; filter?: string } = {
  limit: 50
};

if (filterString) {
  searchOptions.filter = filterString;
}

const response = await documentIndex.search(query, searchOptions);

const hits = response.hits;

  res.json(
    hits.map((hit: any) => ({
      title: hit.title,
      url: hit.url,
      path: hit.path,
      text: createSnippet(hit.body, query, "html"),
      ig: hit.ig,
      version: hit.version
    }))
  );
});

app.listen(3000, () => {
  console.log("Search API running on http://localhost:3000");
});