import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { Meilisearch } from "meilisearch";
import * as cheerio from "cheerio";

// Meilisearch localhost connection for temporary use
const meili = new Meilisearch({
    host: "http://localhost:7700",
});

const index = meili.index("medcom-fhir-documents");

// the URL of the repository to be cloned which contains all of the IG in the ig folder
const repositoryUrl =
    "https://github.com/medcomdk/medcomfhir-website.git";

const tempDir = path.join(os.tmpdir(), crypto.randomUUID());
fs.mkdirSync(tempDir);

// Relevant folders within the repository
const relevantFolder = ["ig"];

// Clone repository into temporary directory
execFileSync("git", ["clone", "--depth", "1", repositoryUrl, tempDir], {
    stdio: "inherit",
});

// Path to relevant documentation
const igPath = path.join(tempDir, ...relevantFolder);


// find all of the html files recursively within the relevant folders
function findHtmlFiles(dir: string): string[] {
    let htmlFiles: string[] = [];
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            htmlFiles = htmlFiles.concat(findHtmlFiles(fullPath));
        } else if (stat.isFile() && file.endsWith(".html")) {
            htmlFiles.push(fullPath);
        }
    }
    return htmlFiles;
}

const htmlFiles = findHtmlFiles(igPath);
console.log("Found HTML files:", htmlFiles);

const extract = (htmlFile: string) => {
    const content = fs.readFileSync(htmlFile, "utf-8");
    const $ = cheerio.load(content);

    $("script, style, noscript, nav, footer, header").remove();

    return {
        title: $("title").text().trim(),
        body: $("body").text().replace(/\s+/g, " ").trim(),
    };
};

// Extract content from all HTML files
const documents = htmlFiles.map((file) => {
    const { title, body } = extract(file);

    const relativePath = path.relative(igPath, file).replace(/\\/g, "/");
    const pathParts = relativePath.split("/");

    return {
        id: crypto.createHash("sha256")
            .update(relativePath)
            .digest("hex"),

        title,
        body,
        path: relativePath,

        ig: pathParts[0],
        version: pathParts.length > 2 ? pathParts[1] : null,
    };
});

// Wait for Meilisearch task to finish
async function waitForMeiliTask(taskUid: number) {
    while (true) {
        const response = await fetch(
            `http://localhost:7700/tasks/${taskUid}`
        );

        if (!response.ok) {
            throw new Error(
                `Task check failed: ${response.status}`
            );
        }

        const task = await response.json();

        if (task.status === "succeeded") {
            return;
        }

        if (task.status === "failed" || task.status === "canceled") {
            throw new Error(
                `Task ${taskUid} ${task.status}: ${JSON.stringify(task.error)}`
            );
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Index documents in Meilisearch
async function indexDocuments() {
    try {
        // Make IG metadata filterable in Meilisearch
        await index.updateFilterableAttributes(["ig", "version"]);

        // Batch size
        const batchSize = 200;

        for (let i = 0; i < documents.length; i += batchSize) {
            const batch = documents.slice(i, i + batchSize);

            console.log(
                `Indexing documents ${i + 1} to ${i + batch.length} of ${documents.length}`
            );

            const response = await index.addDocuments(batch);

            // Wait for Meilisearch to finish indexing
            await waitForMeiliTask(response.taskUid);

            console.log(
                `Successfully indexed ${i + batch.length} documents`
            );
        }

        const stats = await index.getStats();

        console.log("Indexing completed!");
        console.log("Documents indexed:", stats.numberOfDocuments);

    } catch (error) {
        console.error("Indexing failed:", error);
    }
}

indexDocuments();