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

  res.json(response.hits.hits);
});

app.listen(3000, () => {
  console.log("Search API running on http://localhost:3000");
});