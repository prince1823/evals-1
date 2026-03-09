import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, FileCode, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useEvalData } from '@/hooks/useEvalData';
import { categorizeRootCauses } from '@/utils/rootCause';

type Impact = 'high' | 'medium' | 'low';

interface Solution {
  id: string;
  title: string;
  rootCauseId: string;
  rootCauseName: string;
  affectedCount: number;
  impact: Impact;
  estimatedImprovement: string;
  file: string;
  fileDescription: string;
  whatToChange: string;
  codeSnippet: string;
  whyItWorks: string;
  sideEffects: string;
}

const IMPACT_STYLES: Record<Impact, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-green-100', text: 'text-green-800', label: 'High Impact' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Medium Impact' },
  low: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Low Impact' },
};

function buildSolutions(rootCauses: ReturnType<typeof categorizeRootCauses>): Solution[] {
  const solutions: Solution[] = [];

  for (const rc of rootCauses) {
    if (rc.id === 'taxonomy-specificity-gap') {
      solutions.push({
        id: 'sol-override-rules-mckesson',
        title: 'Add Override Rules for Known Medical-Surgical Suppliers',
        rootCauseId: rc.id,
        rootCauseName: rc.name,
        affectedCount: rc.count,
        impact: 'high',
        estimatedImprovement: `Fixes ${rc.count} of 30 errors (${rc.percentage.toFixed(0)}%) — biggest single improvement`,
        file: 'ap-classfier/src/main/services/rules.ts',
        fileDescription: 'Override rules engine — deterministic rules evaluated BEFORE LLM classification',
        whatToChange: `Create a project-level override rule that maps supplier "mckesson medical surgical" to the correct L3 category "clinical|clinical supplies|medical-surgical supplies". Override rules have the highest priority (100-199) and bypass the LLM entirely, making them 100% deterministic.

You can add this via the app UI (Rules page) or directly in the database. The rule should use:
- Condition: { field: "supplier_name", operator: "contains", value: "mckesson" }
- Target: taxonomy node for "clinical|clinical supplies|medical-surgical supplies"
- Priority: 100 (project-level, highest priority)`,
        codeSnippet: `// In the AP Classifier app, create an override rule:
// Rules page → Add Rule →
{
  name: "McKesson → Medical-Surgical Supplies",
  source: "project",
  conditions: [
    {
      field: "supplier_name",
      operator: "contains",
      value: "mckesson"
    }
  ],
  targetTaxonomyNodeId: "<id of clinical|clinical supplies|medical-surgical supplies>",
  priorityScore: 100  // Project rules: 100-199 (highest priority)
}

// This rule is evaluated in classification-pipeline.ts Step 4
// BEFORE the LLM is called, so it's deterministic and instant`,
        whyItWorks: 'McKesson Medical-Surgical is the largest medical supply distributor in the US. 100% of their transactions should be "medical-surgical supplies", never "clinical supplies other". An override rule catches this at the rule layer (Step 4 of the pipeline) before the LLM even runs, making it fast and deterministic.',
        sideEffects: 'None — override rules only apply to exact condition matches. Other suppliers are unaffected. If McKesson ever supplies non-medical items, you can add exclusion conditions.',
      });

      solutions.push({
        id: 'sol-prompt-specificity',
        title: 'Add Anti-"Other" Guidance to Classification Prompt',
        rootCauseId: rc.id,
        rootCauseName: rc.name,
        affectedCount: rc.count,
        impact: 'medium',
        estimatedImprovement: 'Reduces "other" catch-all classifications across ALL suppliers, not just McKesson',
        file: 'ap-classfier/src/main/agents/classification-agent.ts',
        fileDescription: 'Classification agent — builds system prompt and user prompt for LLM classification',
        whatToChange: `In the buildSystemPrompt() function, add a new rule to the "General Rules" section that explicitly instructs the LLM to avoid "Other" categories when a more specific subcategory exists. The current prompt says "Prefer specific categories over Other when confident" but this is too weak — the LLM still defaults to "Other" for 60% of errors.

Strengthen the instruction by adding specific examples of when NOT to use "Other" categories.`,
        codeSnippet: `// In classification-agent.ts → buildSystemPrompt()
// Find the "## General Rules" section and ADD these lines:

## General Rules
- NEVER return just L1 or L1|L2 — must return L1|L2|L3 (exactly 3 levels)
- Prefer specific categories over "Other" when confident
- Distinguish consumption expenses from operational purchases

// ADD THESE NEW RULES ↓↓↓
- CRITICAL: "Other" or catch-all L3 categories (e.g., "clinical supplies other",
  "services other") should ONLY be used when NO specific L3 category matches.
  Before selecting an "Other" category, check ALL sibling L3 categories under
  the same L2 and verify none of them match the transaction.
- For medical/clinical suppliers: Distinguish between "medical-surgical supplies"
  (physical medical products like gowns, syringes, wound care) and "clinical
  supplies other" (only for items that don't fit any specific clinical L3).
- When a well-known supplier specializes in a specific product type, use that
  specific L3 category rather than a generic "other" bucket.`,
        whyItWorks: 'The LLM currently picks "clinical supplies other" as a safe default when it\'s not sure about the exact L3 subcategory. By explicitly instructing it to check ALL sibling L3 categories before falling back to "Other", the model will be more diligent about finding the right specific category.',
        sideEffects: 'May slightly increase classification latency (a few extra tokens in the prompt). Could cause some previously "Other" classifications to move to specific categories — this is the desired behavior but you should monitor for false specificity.',
      });
    }

    if (rc.id === 'category-boundary-confusion') {
      solutions.push({
        id: 'sol-pharmacy-supplier-profile',
        title: 'Research & Profile Pharmacy Suppliers (Direct RX)',
        rootCauseId: rc.id,
        rootCauseName: rc.name,
        affectedCount: rc.count,
        impact: 'high',
        estimatedImprovement: `Fixes ${rc.count} errors — supplier profile makes pharmacy classification deterministic`,
        file: 'ap-classfier/src/main/services/supplier-research.ts',
        fileDescription: 'Supplier research service — researches suppliers via web + LLM and stores profiles',
        whatToChange: `The issue is that Direct RX has NO supplier profile (supplier_info is null). Without a profile, the LLM has no "primary signal" and relies on line descriptions like "gabapentin 400mg" and "medical supplies" — which it maps to generic "clinical supplies" instead of "pharmacy".

Fix: Ensure the supplier research pipeline runs for Direct RX before classification. The research agent should identify Direct RX as a pharmacy and set:
- industry: "Pharmacy / Pharmaceutical"
- productsServices: "Prescription medications, specialty pharmacy services"
- serviceCategories: "Pharmacy"

If web research can't find the supplier, manually add the profile via the app's Supplier Management page.`,
        codeSnippet: `// Option 1: Manually add supplier profile in the database
// In the AP Classifier app → Suppliers page → Find "direct rx" → Edit

supplier_info = {
  "supplierType": "company",
  "officialBusinessName": "DirectRx",
  "description": "Specialty pharmacy providing prescription medications",
  "industry": "Pharmacy / Pharmaceutical",
  "productsServices": "Prescription medications, compound pharmacy",
  "serviceType": "Pharmacy services",
  "serviceCategories": "Pharmacy",
  "confidence": "high"
}

// Option 2: Add an override rule (like McKesson)
{
  name: "Direct RX → Pharmacy",
  conditions: [
    { field: "supplier_name", operator: "contains", value: "direct rx" }
  ],
  targetTaxonomyNodeId: "<id of clinical|pharmacy|pharmacy>",
  priorityScore: 101
}`,
        whyItWorks: 'The classification-agent.ts system prompt explicitly states "Supplier research info (type, offerings, industry) takes PRECEDENCE over line/GL descriptions." With a proper supplier profile identifying Direct RX as a pharmacy, the LLM will prioritize this signal over the ambiguous line description "medical supplies".',
        sideEffects: 'None for override rule approach. For supplier profile approach, ensure the profile is accurate — if Direct RX also supplies non-pharmacy items, the override rule approach (with supplier_name condition) is safer.',
      });
    }

    if (rc.id === 'domain-misclassification') {
      solutions.push({
        id: 'sol-keyword-disambiguation',
        title: 'Add Keyword Disambiguation Rules to Classification Prompt',
        rootCauseId: rc.id,
        rootCauseName: rc.name,
        affectedCount: rc.count,
        impact: 'high',
        estimatedImprovement: `Fixes ${rc.count} critical L1 errors — prevents wrong domain classification`,
        file: 'ap-classfier/src/main/agents/classification-agent.ts',
        fileDescription: 'Classification agent — system prompt controls LLM decision-making',
        whatToChange: `The 4 L1 errors are caused by keyword bias:
1. "lab fees" in Total Compliance Network → AI sees "lab" and picks "clinical|laboratory services" instead of "non clinical|human resources|employee screening"
2. "phamily phone line" in Jaan Health → AI sees "phone" and picks "non clinical|telecom" instead of "clinical|it - clinical|telehealth"

Add keyword disambiguation rules to the system prompt that warn the LLM about common misleading keywords. Also add supplier research profiles for these suppliers.`,
        codeSnippet: `// In classification-agent.ts → buildSystemPrompt()
// Add a new section after "## Edge Cases":

## Keyword Disambiguation (Common Traps)

IMPORTANT: These keywords are commonly misleading. Always check supplier
context before relying on keyword matching:

- "lab fees" / "lab" — Could be clinical laboratory OR employee drug testing
  / background screening (HR). Check supplier: compliance companies provide
  HR screening, not clinical lab work.
- "phone line" / "telecom" — Could be general telecom OR clinical telehealth
  infrastructure. Check supplier: health tech companies providing patient
  communication platforms are clinical IT, not general telecom.
- "supplies" / "medical supplies" — Could be medical-surgical supplies OR
  pharmacy OR clinical supplies. Check supplier specialization to determine
  the specific L3 category.
- "consulting" — Could be IT consulting, management consulting, HR consulting,
  clinical consulting. Always match to supplier's specific industry.

RULE: When a keyword could map to multiple L2/L3 categories, the SUPPLIER'S
industry and description MUST be the deciding factor, not the keyword.`,
        whyItWorks: 'The LLM is doing keyword matching ("lab" → laboratory, "phone" → telecom) instead of contextual reasoning. By explicitly listing known misleading keywords and instructing the model to check supplier context first, we prevent the most common keyword-based misclassifications.',
        sideEffects: 'Adds ~150 tokens to the system prompt. This is a small overhead but significantly improves L1 accuracy. The disambiguation list should be expanded as new misleading patterns are discovered.',
      });

      solutions.push({
        id: 'sol-research-missing-suppliers',
        title: 'Ensure Supplier Research Runs for All Suppliers Before Classification',
        rootCauseId: rc.id,
        rootCauseName: rc.name,
        affectedCount: rc.count,
        impact: 'high',
        estimatedImprovement: 'Prevents all "no supplier research" errors — the #1 predictor of misclassification',
        file: 'ap-classfier/src/main/services/supplier-research.ts',
        fileDescription: 'Supplier research service — Step 2 of the pipeline',
        whatToChange: `All 30 misclassified transactions have NO supplier profiles. The supplier research step (Step 2 of the pipeline) is either not finding these suppliers in web search or skipping them.

Check why these 6 suppliers don't have research:
- total compliance network inc
- jaan health inc
- direct rx
- mckesson medical surgical
- cintas corporation
- amongst friends consulting inc

Possible fixes:
1. Check if the Exa Search API key is configured and working
2. Check if supplier names are being normalized correctly before research
3. Consider adding manual profiles for known suppliers via the UI
4. Lower the confidence threshold for saving research results`,
        codeSnippet: `// In supplier-research.ts → researchBatch()
// Debug: Log which suppliers are being skipped and why

// The research pipeline has a fallback chain:
// 1. ColabIP Supplier Universe match (exact name/alias)
// 2. Web search + LLM (Exa Search API)
// 3. Web search with address context
// 4. Web search with company name context

// Add logging to identify gaps:
console.log(\`[Research] Processing: \${supplierName}\`);
console.log(\`[Research] Universe match: \${universeMatch ? 'YES' : 'NO'}\`);
console.log(\`[Research] Web search results: \${searchResults?.length ?? 0}\`);

// If suppliers are known but missing profiles, add them manually:
// AP Classifier → Suppliers → Search → Edit supplier_info JSON`,
        whyItWorks: 'The system prompt declares "Supplier research info takes PRECEDENCE over line/GL descriptions." Without any supplier research, the LLM falls back to keyword matching from line descriptions, which is the root cause of all 30 misclassifications. Ensuring every supplier has research data before classification is the single most impactful improvement.',
        sideEffects: 'Increases classification time if web research is needed (adds ~2-5 seconds per supplier on first run). Subsequent runs reuse cached profiles. Consider batch-researching all suppliers before running classification.',
      });
    }

    if (rc.id === 'subcategory-confusion') {
      solutions.push({
        id: 'sol-line-desc-priority',
        title: 'Adjust Signal Priority: Line Description Over Supplier Default for L3',
        rootCauseId: rc.id,
        rootCauseName: rc.name,
        affectedCount: rc.count,
        impact: 'low',
        estimatedImprovement: `Fixes ${rc.count} errors where supplier specialization overrides clear line descriptions`,
        file: 'ap-classfier/src/main/agents/classification-agent.ts',
        fileDescription: 'Classification agent — signal prioritization in system prompt',
        whatToChange: `Cintas Corporation specializes in uniforms, but the transactions are for "janitorial supplies". The current prompt says "supplier info wins" when there's a conflict, but at the L3 level, the line description "janitorial supplies" is a more specific signal than the supplier's general category.

Add a nuance to the signal prioritization: supplier info wins for L1/L2, but for L3, specific line descriptions should take priority over general supplier categorization.`,
        codeSnippet: `// In classification-agent.ts → buildSystemPrompt()
// Update the "## Signal Prioritization" section:

## Signal Prioritization

- Supplier research info takes PRECEDENCE for L1 and L2 classification
- For L3 subcategory selection: If the line description clearly names a
  specific product/service type (e.g., "janitorial supplies", "uniforms",
  "lab coats"), use the line description to select the L3 category, even
  if the supplier is generally known for a different product type.
  Example: Cintas (uniform company) selling janitorial supplies →
  L3 should be "janitorial & cleaning supplies", not "uniforms"
- Taxonomy descriptions (when available) > Generic keyword matching`,
        whyItWorks: 'The current "supplier info wins" rule is too aggressive at the L3 level. When the line description explicitly says "janitorial supplies", that specific signal should override the supplier\'s general reputation as a uniform company. This change preserves supplier priority for L1/L2 (where it\'s most valuable) while using more granular signals for L3.',
        sideEffects: 'Could potentially cause some transactions where the line description is misleading (generic accounting text) to be classified by line description instead of supplier. The "clearly names a specific product/service type" qualifier mitigates this risk.',
      });
    }

    if (rc.id === 'service-vs-deliverable') {
      solutions.push({
        id: 'sol-service-type-guidance',
        title: 'Add Service vs Deliverable Classification Guidance',
        rootCauseId: rc.id,
        rootCauseName: rc.name,
        affectedCount: rc.count,
        impact: 'low',
        estimatedImprovement: `Fixes ${rc.count} errors where marketing agency fees are classified as "print"`,
        file: 'ap-classfier/src/main/agents/classification-agent.ts',
        fileDescription: 'Classification agent — system prompt',
        whatToChange: `Amongst Friends Consulting provides marketing services (billboard advertising). The AI classifies this as "print" (the deliverable) instead of "agency fees" (the service type). Add guidance to classify by service type, not by deliverable medium.`,
        codeSnippet: `// In classification-agent.ts → buildSystemPrompt()
// Add to "## General Rules" section:

- When classifying marketing/advertising spend, classify by SERVICE TYPE
  (agency fees, media buying, creative services) rather than by the
  DELIVERABLE MEDIUM (print, digital, billboard). If a marketing agency
  manages a billboard campaign, the L3 should be "agency fees" because
  you're paying for the agency's service, not buying print materials.
- Similarly: IT consulting firms providing cloud migration → classify as
  "consulting" (the service), not "cloud services" (the deliverable).`,
        whyItWorks: 'The LLM sees "billboard" in the line description and maps it to "print" (the physical medium). By adding explicit guidance to classify by service type rather than deliverable medium, the model will correctly identify agency-managed campaigns as "agency fees".',
        sideEffects: 'May affect how other marketing transactions are classified. If you have separate categories for "print production" vs "agency fees", this guidance helps distinguish them correctly.',
      });
    }
  }

  // Sort by impact: high first
  const impactOrder: Record<Impact, number> = { high: 0, medium: 1, low: 2 };
  solutions.sort((a, b) => {
    const diff = impactOrder[a.impact] - impactOrder[b.impact];
    if (diff !== 0) return diff;
    return b.affectedCount - a.affectedCount;
  });

  return solutions;
}

export function SolutionsPage() {
  const { filteredTransactions } = useEvalData();
  const [expandedSolution, setExpandedSolution] = useState<string | null>(null);

  const misclassified = useMemo(
    () => filteredTransactions.filter((t) => !t.isExactMatch),
    [filteredTransactions],
  );

  const rootCauses = useMemo(
    () => categorizeRootCauses(filteredTransactions),
    [filteredTransactions],
  );

  const solutions = useMemo(() => buildSolutions(rootCauses), [rootCauses]);

  const highImpact = solutions.filter((s) => s.impact === 'high');
  const mediumImpact = solutions.filter((s) => s.impact === 'medium');
  const lowImpact = solutions.filter((s) => s.impact === 'low');

  if (misclassified.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900">Suggested Solutions</h2>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-green-800 font-medium">No misclassifications found!</p>
          <p className="text-green-600 text-sm mt-1">All transactions are correctly classified.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Suggested Solutions</h2>
        <p className="text-sm text-gray-500 mt-1">
          {solutions.length} actionable code changes to fix {misclassified.length} misclassifications
          in your AP classifier
        </p>
      </div>

      {/* Impact Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-green-500 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">High Impact</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{highImpact.length}</p>
          <p className="text-xs text-gray-400 mt-1">Override rules & supplier profiles</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-blue-500 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Medium Impact</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{mediumImpact.length}</p>
          <p className="text-xs text-gray-400 mt-1">Prompt engineering improvements</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-gray-400 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Low Impact</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{lowImpact.length}</p>
          <p className="text-xs text-gray-400 mt-1">Fine-tuning & edge cases</p>
        </div>
      </div>

      {/* Quick Wins Banner */}
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-900">Quick Win: Override Rules</p>
            <p className="text-sm text-green-700">
              Adding override rules for McKesson and Direct RX alone would fix{' '}
              <span className="font-bold">
                {rootCauses
                  .filter((rc) => rc.id === 'taxonomy-specificity-gap' || rc.id === 'category-boundary-confusion')
                  .reduce((sum, rc) => sum + rc.count, 0)}
              </span>{' '}
              of {misclassified.length} errors ({((rootCauses
                .filter((rc) => rc.id === 'taxonomy-specificity-gap' || rc.id === 'category-boundary-confusion')
                .reduce((sum, rc) => sum + rc.count, 0) / misclassified.length) * 100).toFixed(0)}%) without any code changes —
              just add rules in the app UI.
            </p>
          </div>
        </div>
      </div>

      {/* Solutions List */}
      <div className="space-y-3">
        {solutions.map((sol, idx) => (
          <SolutionCard
            key={sol.id}
            solution={sol}
            index={idx + 1}
            isExpanded={expandedSolution === sol.id}
            onToggle={() => setExpandedSolution(expandedSolution === sol.id ? null : sol.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SolutionCard({
  solution: sol,
  index,
  isExpanded,
  onToggle,
}: {
  solution: Solution;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const impactStyle = IMPACT_STYLES[sol.impact];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
        )}
        <span className="bg-gray-200 text-gray-700 text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shrink-0">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">{sol.title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Root cause: {sol.rootCauseName} · {sol.affectedCount} errors
          </p>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${impactStyle.bg} ${impactStyle.text}`}>
          {impactStyle.label}
        </span>
      </button>

      {/* Expanded */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          {/* Estimated Improvement */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded p-3">
            <Zap className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">{sol.estimatedImprovement}</p>
          </div>

          {/* File Reference */}
          <div className="flex items-start gap-2">
            <FileCode className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded inline-block">
                {sol.file}
              </p>
              <p className="text-xs text-gray-500 mt-1">{sol.fileDescription}</p>
            </div>
          </div>

          {/* What to Change */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="h-4 w-4 text-gray-500" />
              <p className="text-xs font-medium text-gray-500 uppercase">What to Change</p>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {sol.whatToChange}
            </div>
          </div>

          {/* Code Snippet */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Code / Configuration</p>
            <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto leading-relaxed">
              {sol.codeSnippet}
            </pre>
          </div>

          {/* Why It Works */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-xs font-medium text-gray-500 uppercase">Why This Works</p>
            </div>
            <p className="text-sm text-gray-600">{sol.whyItWorks}</p>
          </div>

          {/* Side Effects */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <p className="text-xs font-medium text-gray-500 uppercase">Side Effects</p>
            </div>
            <p className="text-sm text-gray-600">{sol.sideEffects}</p>
          </div>
        </div>
      )}
    </div>
  );
}
