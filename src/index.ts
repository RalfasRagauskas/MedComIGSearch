import { Client } from "@elastic/elasticsearch";

const client = new Client({
  node: "http://localhost:9200"
});

async function main() {
  const response = await client.search({
    index: "medcom-crawler-test",
    query: {
      multi_match: {
        query: "observation",
        fields: ["title", "body"]
      }
    },
    size: 5
  });

for (const hit of response.hits.hits) {
  console.log(hit._source);
}
}

main();