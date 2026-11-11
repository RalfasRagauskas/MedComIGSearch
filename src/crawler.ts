
import * as cheerio from "cheerio";
import { Meilisearch } from "meilisearch";

const meili = new Meilisearch({
  host: "http://localhost:7700",
});

const index = meili.index("medcom-documents");

// Each scope describes one IG that is crawled and indexed. "id" identifies
// the IG in the search index/API (used by the frontend to tell "this IG"
// apart from "other IGs"), and "name" is the human-readable label shown
// alongside results that belong to a different IG than the one being browsed.
const homeCareScope = {
  id: "homecareobservation",
  name: "Home Care Observations",
  baseUrl: "https://medcomfhir.dk/ig/homecareobservation/1.2.2/",
};

const coreScope = {
  id: "core",
  name: "MedCom Core",
  baseUrl: "https://medcomfhir.dk/ig/core/2.2.0/",
};

const scopes = [homeCareScope, coreScope];

const crawlScopes = scopes.map((scope) => scope.baseUrl);
const startUrls = [homeCareScope.baseUrl, `${coreScope.baseUrl}index.html`];

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

    const content = $("#segment-content").clone();

    // Removes CSS, JavaScript and noscript elements from the extracted content.
    // This ensures that only relevant documentation text is indexed.
    content.find("style, script, noscript").remove();

    const body = content.text().replace(/\s+/g, " ").trim();

    const breadcrumb = $("nav a")
      .map((_, element) => $(element).text().trim())
      .get()
      .filter(Boolean);

    const versionMatch = url.match(/\/ig\/[^/]+\/([^/]+)\//);
    const version = versionMatch?.[1];

    // Identifies which IG this page belongs to, so the frontend can tell
    // results from the IG being browsed apart from results from other IGs.
    const scope = scopes.find((scope) => url.startsWith(scope.baseUrl));

    const contentType =
      url.endsWith(".xml") ? "xml" :
      url.endsWith(".json") ? "json" :
      "html";

    await index.addDocuments([
      {
        // Encodes the URL as Base64URL to create a safe, unique document ID.
        // Base64URL avoids problematic characters in Meilisearch document IDs.
        id: Buffer.from(url).toString("base64url"),
        title,
        url,
        body,
        version,
        breadcrumb,
        contentType,
        ig: scope?.id,
        igName: scope?.name,
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

      // Removes URL fragments (#...) so that links to different sections
      // of the same page are treated as one URL and are not crawled as duplicates.
      parsedUrl.hash = "";

      const nextUrl = parsedUrl.href;

      if (crawlScopes.some((scope) => nextUrl.startsWith(scope))) {
        queue.push(nextUrl);
      }
    }
  } catch (error) {
    failedRequests++;
    console.error(`Failed: ${url}`, error);
  }
}

const queue: string[] = [...startUrls];

async function main() {
  console.log("Starting crawler...");

  // "ig" must be a filterable attribute so the search API can run a
  // separate, fair query per IG instead of one global top-N search that lets
  // whichever IG ranks higher for a given term crowd out the other.
  await index.updateFilterableAttributes(["ig"]);

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
