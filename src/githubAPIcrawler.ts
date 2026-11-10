
// her refrerer vi til repository-ejeren, navnet på repository'et og den branch, vi vil inspicere
const owner = "medcomdk";
const repo = "dk_HomeCareObservations";
const branch = "master";

// hvorfor bruge github trees API? Det giver os et komplet overblik over repository-strukturen uden at klone det

// recursive=1 betyder, at vi henter hele repository-træet, inklusive alle undermapper og filer.

const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

console.log(url);

// Vi opretter en funktion til at inspicere repository-strukturen ved hjælp af GitHub API'et.
async function inspectRepository() {
    const response = await fetch(url);
   if (!response.ok) {
    const errorData = await response.json();
    console.log(errorData);
    throw new Error(`GitHub API error: ${response.status}`);
}
 // her kan vi begynde at arbejde med repository-dataene, efter at vi har hentet dem fra GitHub API'et. vi udskriver antallet af elementer, Github har fundet i repo filtræ, både filer og mapper
const data = await response.json();
console.log(data.tree.length);

// her udskriver vi stien for hver fil og mappe i repository-træet, fx input/pagecontent/index.md
const relevantFiles = data.tree.filter((item: any) => 

     // Trees API: Giver os repositoryets struktur og oversigt over filerne.
     // Blobs API: Giver os adgang til indholdet af en bestemt fil.
    item.type === "blob" && 
    /\.(md|fsh|xml)$/i.test(item.path)
);
console.log(relevantFiles.map((item: any) => item.path));


for (const file of relevantFiles) {
    const fileResponse = await fetch(file.url);
    const fileData = await fileResponse.json();

    console.log(file.path, fileData.size, fileData.encoding);

    const decodedContent = Buffer.from(
        fileData.content,
        "base64"
    ).toString("utf-8");

    console.log(file.path);
    console.log(decodedContent);
}

console.log("Antal relevante filer:", relevantFiles.length);
}
inspectRepository();