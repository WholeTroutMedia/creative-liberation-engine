// using native fetch

async function getEmbedding(text: string) {
    const res = await fetch('http://127.0.0.1:11434/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "nomic-embed-text",
            prompt: text
        })
    });
    const data: any = await res.json();
    return data.embedding;
}

getEmbedding("hello world").then(e => console.log(e.slice(0, 5), e.length)).catch(console.error);
