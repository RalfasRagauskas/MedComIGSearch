
import * as cheerio from "cheerio";
import { Meilisearch } from "meilisearch";

const meili = new Meilisearch({
  host: "http://localhost:7700",
});

const index = meili.index("medcom-documents");

const startUrl =
  "https://medcomfhir.dk/ig/homecareobservation/1.2.2/";

const visited = new Set<string>();

// Counters
let successfullyFetched = 0;
let indexedDocuments = 0;
let failedRequests = 0;

async function crawl(url: string) {
  if (visited.has(url)) return;

  visited.add(url);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      failedRequests++;
      console.log(`Skipped ${url} (${response.status})`);
      return;
    }

    successfullyFetched++;

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $("title").text().trim();

    const content = $("#segment-content").text();
    const body = content.replace(/\s+/g, " ").trim();

    const breadcrumb = $("nav a")
      .map((_, element) => $(element).text().trim())
      .get()
      .filter(Boolean);

    const versionMatch = url.match(/\/ig\/[^/]+\/([^/]+)\//);
    const version = versionMatch?.[1];

    const contentType =
      url.endsWith(".xml") ? "xml" :
      url.endsWith(".json") ? "json" :
      "html";

    await index.addDocuments([
      {
        id: Buffer.from(url).toString("base64url"),
        title,
        url,
        body,
        version,
        breadcrumb,
        contentType,
      },
    ]);

    indexedDocuments++;

    console.log(`Indexed: ${title}`);

    const links = $("a")
      .map((_, element) => $(element).attr("href"))
      .get();

    for (const link of links) {
      if (!link) continue;

      const parsedUrl = new URL(link, url);
      parsedUrl.hash = "";

      const nextUrl = parsedUrl.href;

      if (
        nextUrl.startsWith(
          "https://medcomfhir.dk/ig/homecareobservation/1.2.2/"
        )
      ) {
        queue.push(nextUrl);
      }
    }
  } catch (error) {
    failedRequests++;
    console.error(`Failed: ${url}`, error);
  }
}

const queue: string[] = [startUrl];

async function main() {
  console.log("Starting crawler...");

  const startTime = performance.now();

  while (queue.length > 0) {
    const url = queue.shift();

    if (!url) continue;

    await crawl(url);
  }

  const endTime = performance.now();
  const duration = (endTime - startTime) / 1000;

  console.log("--------------------------------");
  console.log("Crawl finished!");
  console.log(`Visited URLs: ${visited.size}`);
  console.log(`Successfully fetched: ${successfullyFetched}`);
  console.log(`Indexed documents: ${indexedDocuments}`);
  console.log(`Failed requests: ${failedRequests}`);
  console.log(`Total crawl time: ${duration.toFixed(2)} seconds`);
  console.log("--------------------------------");
}

main();
