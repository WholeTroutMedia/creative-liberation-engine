#!/usr/bin/env python3
"""
Creative Liberation Engine V6: CPU-Bound RAG Ingestion (Sovereign Media Mesh)

This script parses Blackmagic API Docs, Lua scripts, and industry guidelines
using ONLY the local CPU. It completely bypasses the RTX 4090 VRAM, ensuring
active DaVinci Resolve and Ollama instances are not impacted.
"""

import os
import argparse
import time

try:
    from langchain_community.document_loaders import DirectoryLoader, TextLoader, UnstructuredMarkdownLoader
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from langchain_chroma import Chroma
    from langchain_huggingface import HuggingFaceEmbeddings
except ImportError as e:
    print(f"[!] Missing required langchain dependencies: {e}")
    print("    pip install langchain-chroma langchain-huggingface langchain-community pypdf")
    import sys
    sys.exit(1)

# Absolute path bindings
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
NAS_ROOT = r"\\127.0.0.1\docker\genesis-deploy"
INTAKE_DIR = os.path.join(NAS_ROOT, "media_intake", "Resolve_RAG_Data")
CHROMA_PERSIST_DIR = os.path.join(NAS_ROOT, "media_intake", "chroma_db_cpu")

def init_environment():
    """Ensure staging directories exist."""
    os.makedirs(INTAKE_DIR, exist_ok=True)
    os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
    
    print(f"[*] Staging Directory : {INTAKE_DIR}")
    print(f"[*] DB Persist Target : {CHROMA_PERSIST_DIR}")

def ingest_to_chroma(collection_name: str = "resolve_api_logic"):
    """Parses docs and injects them into the local ChromaDB via CPU."""
    print(f"\n[*] Scanning for documents in '{INTAKE_DIR}'...")
    
    # We will load various file types common in scripting/docs
    glob_patterns = ["**/*.txt", "**/*.md", "**/*.lua", "**/*.dctl", "**/*.py"]
    documents = []
    
    from langchain_core.documents import Document
    import glob

    for pattern in glob_patterns:
        search_path = os.path.join(INTAKE_DIR, pattern)
        files = glob.glob(search_path, recursive=True)
        for filepath in files:
            if not os.path.isfile(filepath):
                continue
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                documents.append(Document(page_content=content, metadata={"source": filepath}))
            except Exception as e:
                print(f"  [!] Skipped {filepath} due to read error: {e}")
        print(f"  - Loaded {len(files)} files matching {pattern}")

    if not documents:
        print("\n[!] No files found in the intake directory.")
        print(f"    -> Harvest data into {INTAKE_DIR} and rerun.")
        return

    print(f"\n[*] Found {len(documents)} total documents. Chunking...")
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        add_start_index=True
    )
    chunks = text_splitter.split_documents(documents)
    print(f"[*] Split into {len(chunks)} chunks.")
    
    print("[*] Init embeddings (HuggingFace all-MiniLM-L6-v2) on CPU-only flag...")
    # CRITICAL: Force device to 'cpu' to protect VRAM for Resolve/Ollama
    embeddings = HuggingFaceEmbeddings(
        model_name="all-MiniLM-L6-v2",
        model_kwargs={'device': 'cpu'}
    )
    
    print(f"[*] Vectorizing {len(chunks)} chunks into ChromaDB '{collection_name}'...")
    # Initialize Chroma, clearing out the old collection if needed or appending
    vector_store = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=collection_name,
        persist_directory=CHROMA_PERSIST_DIR
    )
    
    print(f"[+] Ingestion complete. Local vector store '{collection_name}' successfully built at {CHROMA_PERSIST_DIR}.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build CPU-Bound Logic/Math RAG Database.")
    parser.add_argument("--collection", default="resolve_api_logic", help="Target ChromaDB collection")
    
    args = parser.parse_args()

    print("=====================================================")
    print(" V6 SOVEREIGN MEDIA MESH - CPU RAG INGESTION SCRIPT  ")
    print("=====================================================")
    init_environment()
    ingest_to_chroma(collection_name=args.collection)
