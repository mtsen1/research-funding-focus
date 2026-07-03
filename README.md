# R&D Landscape Explorer

An interactive, high-dimensional data visualization platform designed to isolate, map, and analyze structural relationships between public and industry research funding. This platform features a network paired with real-time reactive 2D subplots to provide actionable resource-allocation intelligence.

Live Demo: [View Live Dashboard](https://mtsen1.github.io/research-funding-focus/)


## Executive Value & Insights

The R&D Landscape Explorer translates high-dimensional text semantics and citation footprints into structured metrics for decision-making:

* **Spatial Constellations:** Maps organizational footprints across complex research domains using advanced dimensionality reduction, exposing areas of high cross-sector collaboration versus isolated engineering silos.
* **Funder Impact:** A dynamic ROI matrix mapping publication volume against mean citation yield to evaluate which institutions generate the highest disruptive breakthroughs per publication.



## Technical Stack

* **Data Science Pipeline:** Python, `scikit-learn`, and `umap-learn`
* **Frontend Graphics Engine:** Three.js, Chart.js, JavaScript 



## Data Retrieval & Processing Pipeline

### 1. Retrieval & Metadata Extraction
The dataset was collected via target API queries hitting the global **OpenAlex graph aggregator**.
* **Raw Scope:** The pipeline ingested publication abstract metadata, temporal markers (2015–2026), institutional classifications, digital object identifiers (DOIs), and cross-referenced funding data originating from sources like Crossref, institutional repositories, and public funding tracking indexes (e.g., NIH RePORTER).
* **Feature Engineering:** Text descriptions and keyword tags were vectorized into dense tf-idf numeric matrices, embedding semantic contextual relationships into a high-dimensional feature space where each unique term represents a mathematical dimension.

### 2. Topological Dimensionality Reduction (UMAP)
Because a standard web browser cannot render or make spatial sense of thousands of mathematical dimensions, the pipeline implements **UMAP** to compress the abstract space into clean 3D $(X, Y, Z)$ coordinates.

---
