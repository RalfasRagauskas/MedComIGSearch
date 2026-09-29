import * as cheerio from "cheerio";
import { Meilisearch } from "meilisearch";

const meili = new Meilisearch({
  host: "http://localhost:7700",
});

const index = meili.index("medcom-documents");

const startUrl =
  "https://medcomfhir.dk/ig/homecareobservation/1.2.2/";

const visited = new Set<string>();

async function crawl(url: string) {
  if (visited.has(url)) return;

  visited.add(url);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`Skipped ${url} (${response.status})`);
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $("title").text().trim();

   const content = $("#segment-content").text();
    const body = content.replace(/\s+/g, " ").trim();
    
    const versionMatch = url.match(/\/ig\/[^/]+\/([^/]+)\//);
    const version = versionMatch?.[1];

    await index.addDocuments([
      {
        id: Buffer.from(url).toString("base64"),
        title,
        url,
        body,
        version,
      },
    ]);

    console.log(`Indexed: ${title}`);

    const links = $("a")
      .map((_, element) => $(element).attr("href"))
      .get();

    for (const link of links) {
      if (!link) continue;

      const nextUrl = new URL(link, url).href;

      if (
        nextUrl.startsWith(
          "https://medcomfhir.dk/ig/homecareobservation/1.2.2/"
        )
      ) {
        await crawl(nextUrl);
      }
    }
  } catch (error) {
    console.error(`Failed: ${url}`, error);
  }
}

async function main() {
  console.log("Starting crawler...");

  await crawl(startUrl);

  console.log(`Crawl finished. Visited ${visited.size} pages.`);
}
main();