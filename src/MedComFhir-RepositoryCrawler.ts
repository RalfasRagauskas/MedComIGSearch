
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

// the folders within the repository that are relevant for indexing
const relevantFolder = [
    "ig"
]

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
    return {
        title: $("title").text(),
        body: $("body").text(),
    };
};

// Extract content from all HTML files
const documents = htmlFiles.map((file) => {
    const { title, body } = extract(file);
    return {
        id: crypto.createHash("sha256").update(file).digest("hex"),
        title,
        body,
        path: file,
    };
});

// Index documents in Meilisearch
index.addDocuments(documents).then((response) => {
    console.log("Documents indexed:", response);
});