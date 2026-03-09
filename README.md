# AP Classifier Eval Dashboard

A React-based dashboard for evaluating AP (Accounts Payable) classifier accuracy. Upload your classified output and expected results to visualize misclassifications, confusion matrices, root cause analysis, and more.

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Recharts (charts)
- TanStack Table (data tables)
- React Router

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm

### Installation

```bash
git clone https://github.com/prince1823/evals-1.git
cd evals-1/eval-dashboard
npm install
```

### Run the Dev Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## Usage

1. Open the app in your browser.
2. Enter a dataset name.
3. Upload your **Classified File** (CSV) — the AI classifier output with prediction columns like `classification_path`, `canonical_supplier_name`, etc.
4. Upload your **Expected File** (TXT) — ground truth with one classification path per line in `level1|level2|level3` format.
5. Click **Analyze & View Dashboard** to explore the results.

### Sample Data

Sample data files are included in the root of this repo:

- `classified (2).csv` — example classified output
- `expected.txt` / `expected (1).txt` — example expected results

## Dashboard Pages

- **Overview** — high-level accuracy stats and charts
- **Misclassifications** — detailed table of incorrect predictions
- **Root Cause Analysis** — patterns behind classification errors

## Build for Production

```bash
npm run build
npm run preview
```
