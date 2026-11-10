
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { Meilisearch } from "meilisearch";

// Meilisearch connection
const meili = new Meilisearch({
    host: "http://localhost:7700",
});

const index = meili.index("medcom-documents");

// Repository settings
const repositoryUrl =
    "https://github.com/medcomdk/dk_HomeCareObservations.git";

const branch = "master";

const relevantExtensions = [
    ".md",
    ".fsh",
    ".xml",
    ".pdf",
    ".docx",
];

const textExtensions = [
    ".md",
    ".fsh",
    ".xml",
    ".txt",
    ".html",
];

// Create a snapshot of repository files
function createSnapshot(repositoryPath: string) {
    const snapshot = new Map<string, string>();

    function scanDirectory(directory: string) {
        const entries = fs.readdirSync(directory, {
            withFileTypes: true,
        });

        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                if (entry.name === ".git") continue;

                scanDirectory(fullPath);
            } else {
                const extension = path.extname(entry.name).toLowerCase();

                if (!relevantExtensions.includes(extension)) continue;

                const content = fs.readFileSync(fullPath);

                const hash = crypto
                    .createHash("sha256")
                    .update(content)
                    .digest("hex");

                const relativePath = path.relative(
                    repositoryPath,
                    fullPath
                );

                snapshot.set(relativePath, hash);
            }
        }
    }

    scanDirectory(repositoryPath);

    return snapshot;
}

// Count files and text content
function inspectRepository(repositoryPath: string) {
    const fileTypes = new Map<string, number>();

    let relevantFiles = 0;
    let totalCharacters = 0;

    function scanDirectory(directory: string) {
        const entries = fs.readdirSync(directory, {
            withFileTypes: true,
        });

        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                if (entry.name === ".git") continue;

                scanDirectory(fullPath);
            } else {
                const extension =
                    path.extname(entry.name).toLowerCase() || "[ingen]";

                fileTypes.set(
                    extension,
                    (fileTypes.get(extension) || 0) + 1
                );

                if (!relevantExtensions.includes(extension)) continue;

                relevantFiles++;

                if (textExtensions.includes(extension)) {
                    const content = fs.readFileSync(
                        fullPath,
                        "utf-8"
                    );

                    totalCharacters += content.length;
                }
            }
        }
    }

    const startTime = performance.now();

    scanDirectory(repositoryPath);

    const endTime = performance.now();

    return {
        relevantFiles,
        totalCharacters,
        fileTypes,
        scanTime: endTime - startTime,
    };
}

// Simulate repository changes
function simulateChanges(repositoryPath: string) {
    const newFile = path.join(
        repositoryPath,
        "benchmark-new.md"
    );

    const modifiedFile = path.join(
        repositoryPath,
        "input",
        "pagecontent",
        "index.md"
    );

    const deletedFile = path.join(
        repositoryPath,
        "input",
        "pagecontent",
        "testProtocolTestExample.md"
    );

    fs.writeFileSync(
        newFile,
        "# Benchmark test\nNew file"
    );

    if (fs.existsSync(modifiedFile)) {
        fs.appendFileSync(
            modifiedFile,
            "\nBenchmark modification"
        );
    }

    if (fs.existsSync(deletedFile)) {
        fs.unlinkSync(deletedFile);
    }
}

// Compare two repository snapshots
function detectChanges(
    before: Map<string, string>,
    after: Map<string, string>
) {
    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    for (const [file, hash] of after) {
        if (!before.has(file)) {
            added.push(file);
        } else if (before.get(file) !== hash) {
            modified.push(file);
        }
    }

    for (const file of before.keys()) {
        if (!after.has(file)) {
            deleted.push(file);
        }
    }

    return { added, modified, deleted };
}

// Meilisearch CRUD test
async function waitForTask(taskUid: number) {
    await meili.tasks.waitForTask(taskUid);
}

async function testMeiliCrud() {
    console.log("\n========== MEILISEARCH CRUD TEST ==========");

    const testId = `repository-benchmark-${Date.now()}`;

    const startTime = performance.now();

    try {
        // CREATE
        const createTask = await index.addDocuments([
            {
                id: testId,
                title: "Repository benchmark test",
                url: "repository://benchmark/test",
                body: "Original test content",
                version: "1.2.2",
                breadcrumb: ["Benchmark"],
                contentType: "markdown",
            },
        ]);

        await waitForTask(createTask.taskUid);

        const createdDocument = await index.getDocument(testId);

        console.log(
            "CREATE:",
            createdDocument ? "Dokument oprettet" : "Fejl"
        );

        // UPDATE
        const updateTask = await index.updateDocuments([
            {
                id: testId,
                body: "Updated test content",
            },
        ]);

        await waitForTask(updateTask.taskUid);

        const updatedDocument = await index.getDocument(testId);

        console.log(
            "UPDATE:",
            updatedDocument.body === "Updated test content"
                ? "Dokument opdateret"
                : "Fejl"
        );

        // DELETE
        const deleteTask = await index.deleteDocument(testId);

        await waitForTask(deleteTask.taskUid);

        let deleted = false;

        try {
            await index.getDocument(testId);
        } catch {
            deleted = true;
        }

        console.log(
            "DELETE:",
            deleted ? "Dokument slettet" : "Fejl"
        );

    } catch (error) {
        console.error("Meilisearch CRUD test fejlede:", error);
    }

    const duration = (performance.now() - startTime) / 1000;

    console.log(`Samlet CRUD-tid: ${duration.toFixed(3)} sekunder`);
    console.log("===========================================\n");
}

// Main benchmark
async function main() {
    const temporaryDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), "repository-benchmark-")
    );

    const repositoryPath = path.join(
        temporaryDirectory,
        "repository"
    );

    try {
        console.log("========== REPOSITORY BENCHMARK ==========");

        const memoryBefore = process.memoryUsage().rss / 1024 / 1024;

        // Clone repository
        const cloneStart = performance.now();

        execFileSync(
            "git",
            [
                "clone",
                "--depth",
                "1",
                "--branch",
                branch,
                repositoryUrl,
                repositoryPath,
            ],
            { stdio: "ignore" }
        );

        const cloneTime =
            (performance.now() - cloneStart) / 1000;

        // Inspect repository
        const inspection = inspectRepository(repositoryPath);

        // Create initial snapshot
        const beforeSnapshot = createSnapshot(repositoryPath);

        // Simulate changes
        simulateChanges(repositoryPath);

        // Create updated snapshot
        const afterSnapshot = createSnapshot(repositoryPath);

        // Detect changes
        const changeStart = performance.now();

        const changes = detectChanges(
            beforeSnapshot,
            afterSnapshot
        );

        const changeTime = performance.now() - changeStart;

        const memoryAfter = process.memoryUsage().rss / 1024 / 1024;

        console.log(`Clone-tid: ${cloneTime.toFixed(2)} sek.`);
        console.log(
            `Lokal scanning: ${inspection.scanTime.toFixed(2)} ms`
        );

        console.log(
            `Samlet tid inkl. ændringstest: ${(
                cloneTime * 1000 +
                inspection.scanTime +
                changeTime
            ).toFixed(2)} ms`
        );

        console.log(`Relevante filer: ${inspection.relevantFiles}`);
        console.log(`Samlet antal tegn: ${inspection.totalCharacters}`);

        console.log(
            `Tekststørrelse: ${(
                inspection.totalCharacters / 1024
            ).toFixed(2)} KB`
        );

        console.log("\nFiltyper:", inspection.fileTypes);

        console.log("\nRessourceforbrug:");
        console.log(`RAM før: ${memoryBefore.toFixed(2)} MB`);
        console.log(`RAM efter: ${memoryAfter.toFixed(2)} MB`);

        console.log("\nOpdatering og sletning:");
        console.log("Nye filer:", changes.added);
        console.log("Ændrede filer:", changes.modified);
        console.log("Slettede filer:", changes.deleted);

        console.log(
            `Tid til ændringsdetektion: ${changeTime.toFixed(2)} ms`
        );

        console.log("==========================================\n");

        // Test actual Meilisearch operations
        await testMeiliCrud();

    } catch (error) {
        console.error("Benchmark fejlede:", error);
    } finally {
        // Remove temporary repository
        fs.rmSync(temporaryDirectory, {
            recursive: true,
            force: true,
        });

        console.log("Midlertidigt repository slettet.");
    }
}

main();
