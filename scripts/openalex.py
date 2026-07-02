import os
import requests
import json
import time
from dotenv import load_dotenv

load_dotenv()

OPENALEX_API_KEY = os.getenv("OPENALEX_API_KEY")
USER_EMAIL = os.getenv("USER_EMAIL")

if not USER_EMAIL:
    raise ValueError("Missing USER_EMAIL in .env")

# -----------------------------
# FUNDERS
# -----------------------------
FUNDERS = {
    "public_nih": "F4320332161",
    "public_nsf": "F4320306076",
    "industry_microsoft": "F4320308943",
    "industry_google": "F4320310574",
    "industry_apple": "F4320315488",
    "industry_nvidia": "F4320320779"
}

# -----------------------------
# ABSTRACT RECONSTRUCTION
# -----------------------------
def reconstruct_abstract(inverted_index):
    if not inverted_index:
        return ""

    word_positions = {}
    for word, positions in inverted_index.items():
        for pos in positions:
            word_positions[pos] = word

    return " ".join(word_positions[i] for i in sorted(word_positions))


# -----------------------------
# TOPIC EXTRACTION (SAFE)
# -----------------------------
def extract_primary_topic(work):
    pt = work.get("primary_topic")
    if isinstance(pt, dict):
        return pt.get("display_name", "Unknown")
    return "Unknown"


# -----------------------------
# CONCEPT EXTRACTION
# -----------------------------
def extract_concepts(work, top_k=5):
    concepts = work.get("concepts")

    if not concepts:
        return []

    extracted = []
    for c in concepts[:top_k]:
        if isinstance(c, dict):
            name = c.get("display_name")
            score = c.get("score", 0)

            if name:
                extracted.append({
                    "concept": name,
                    "score": score
                })

    return extracted


# -----------------------------
# AUTHOR EXTRACTION (NEW ADDITION)
# -----------------------------
def extract_first_author(work):
    """Safely extracts the first author and formats as Surname or Surname et al."""
    authorships = work.get("authorships", [])
    if not authorships or not isinstance(authorships, list):
        return "Unknown"
    
    first_author_obj = authorships[0]
    if not isinstance(first_author_obj, dict):
        return "Unknown"
        
    author_info = first_author_obj.get("author", {})
    if not isinstance(author_info, dict):
        return "Unknown"
        
    full_name = author_info.get("display_name")
    if not full_name:
        return "Unknown"
        
    # Extract the last name/surname safely
    last_name = full_name.trim().split(" ")[-1] if hasattr(full_name, 'trim') else full_name.strip().split(" ")[-1]
    
    # Append 'et al.' if there are multiple authors
    if len(authorships) > 1:
        return f"{last_name} et al."
    return last_name


# -----------------------------
# PIPELINE
# -----------------------------
def build_landscape_dataset(funder_label: str, funder_id: str, max_pages: int = 10):
    base_url = "https://api.openalex.org/works"

    headers = {
        "User-Agent": f"FundingLandscapePipeline/1.0 (mailto:{USER_EMAIL})"
    }

    results = []
    page = 1

    print(f"\n→ Fetching {funder_label}")

    while page <= max_pages:

        params = {
            "filter": f"funders.id:{funder_id},publication_year:2015-2026",
            "per_page": 50,
            "page": page,
            "select": (
                "title,doi,publication_year,"
                "cited_by_count,"
                "abstract_inverted_index,"
                "primary_topic,"
                "concepts,"
                "authorships"  # Added authorships here to request the data
            )
        }

        if OPENALEX_API_KEY:
            params["api_key"] = OPENALEX_API_KEY

        try:
            r = requests.get(base_url, params=params, headers=headers, timeout=30)

            if r.status_code == 429:
                time.sleep(2)
                continue

            if r.status_code != 200:
                print("Error:", r.status_code, r.text[:200])
                break

        except requests.exceptions.RequestException as e:
            print("Request error:", e)
            break

        data = r.json()
        works = data.get("results", [])

        if not works:
            break

        for work in works:

            abstract = reconstruct_abstract(work.get("abstract_inverted_index"))
            if not abstract:
                continue

            topic = extract_primary_topic(work)
            concepts = extract_concepts(work)
            author = extract_first_author(work) # Extracted here

            results.append({
                "title": work.get("title"),
                "doi": work.get("doi"),
                "year": work.get("publication_year"),
                "citations": work.get("cited_by_count"),
                "abstract": abstract,
                "primary_topic": topic,
                "concepts": concepts,
                "author_citation": author, # Saved to the output dictionary
                "funder": funder_label
            })

        page += 1
        time.sleep(0.2)

    return results


# -----------------------------
# RUN PIPELINE
# -----------------------------
if __name__ == "__main__":

    dataset = {}

    for label, funder_id in FUNDERS.items():
        papers = build_landscape_dataset(label, funder_id, max_pages=10)
        dataset[label] = papers

        print(f"→ {label}: {len(papers)} papers")

    with open("funding_concept_landscape.json", "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)

    print("\nDONE → saved to funding_concept_landscape.json")