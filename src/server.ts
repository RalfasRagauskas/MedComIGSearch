import { Client } from "@elastic/elasticsearch"
import express from "express";

const client = new Client({
  node: "http://localhost:9200"
});

const app = express();

app.get("/search",  async (req, res) => {
  const query = req.query.q;

  const response = await client.search({
    index: "medcom-crawler-test",
    query: {
        multi_match: {
            query: query as string,
            fields: ["title", "body"]
        }
    },
    size: 5
  });

  res.json(
    response.hits.hits.map(hit =>{
        const source = hit._source as {
            title?: string;
            url?: string;
            body?: string;
            headings?: string[];
            url_path_dir3?: string;
        };
        return {
            title: source.title,
            url: source.url,
            version: source.url_path_dir3,
            snippet: source.body?.substring(0,200)
        };
    })
);
});

app.listen(3000, () => {
  console.log("Search API running on http://localhost:3000");
});