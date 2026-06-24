"""Proxy-Pointer RAG indexer for Flipboard AI Magazine.
Creates structure-aware embeddings in ChromaDB using breadcrumbs."""

import os
import json
import chromadb

CHROMA_HOST = "cle-v6-chromadb-1"
CHROMA_PORT = 8000
COLLECTION_NAME = "cortex_flipboard_magazine"
INPUT_FILE = "/workspace/rag_data/ingest/flipboard/ai_magazine.json"

def main():
    print(f"Connecting to ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}...")
    client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    
    try:
        collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"description": "Flipboard AI Magazine Proxy-Pointer Index"}
        )
    except Exception as e:
        print(f"Error connecting to ChromaDB: {e}")
        return

    print(f"Loading data from {INPUT_FILE}...")
    if not os.path.exists(INPUT_FILE):
        print("Data file not found!")
        return
        
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    articles = data.get("articles", [])
    if not articles:
        print("No articles found.")
        return
        
    documents = []
    metadatas = []
    ids = []
    
    print("Building Proxy-Pointer breadcrumb structure...")
    for i, article in enumerate(articles):
        title = article.get("title", "Untitled")
        categories = article.get("categories", [])
        desc = article.get("description", "")
        author = article.get("author", "")
        date = article.get("published", "")
        
        cat_path = " > ".join(categories) if categories else "General"
        breadcrumb = f"Flipboard AI Magazine > {cat_path} > {title}"
        
        content = f"{breadcrumb}\n\nTitle: {title}\nAuthor: {author}\nDate: {date}\n\n{desc}"
        
        metadata = {
            "breadcrumb": breadcrumb,
            "source_url": article.get("source_url", ""),
            "flipboard_url": article.get("flipboard_url", ""),
            "title": title,
            "type": "proxy-pointer"
        }
        
        documents.append(content)
        metadatas.append(metadata)
        ids.append(f"flipboard_ai_{i}_{date}")

    print(f"Upserting {len(documents)} structured nodes to ChromaDB...")
    batch_size = 100
    for i in range(0, len(documents), batch_size):
        collection.upsert(
            documents=documents[i:i+batch_size],
            metadatas=metadatas[i:i+batch_size],
            ids=ids[i:i+batch_size]
        )
        
    print(f"✅ Successfully indexed {len(documents)} articles using Proxy-Pointer RAG.")
    print(f"Collection: {COLLECTION_NAME}")

if __name__ == "__main__":
    main()
