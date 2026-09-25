import { Client } from "@elastic/elasticsearch";

const client = new Client({
  node: "http://localhost:9200"
});

async function main() {
  const response = await client.info();

  console.log(response);
}

main();