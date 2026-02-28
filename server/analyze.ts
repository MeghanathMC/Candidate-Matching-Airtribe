import OpenAI from "openai";
import { type CandidateAnalysis, candidateAnalysisSchema } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const systemPrompt = `You are an expert talent evaluator for a career placement firm. Your audience is a NON-TECHNICAL career services team. Your output must be something they can read, understand, and act on immediately — when talking to candidates, when introducing candidates to hiring partners, or when preparing for conversations.

## CRITICAL: REASON ABOUT FIT, DON'T MATCH KEYWORDS

- Do NOT simply match keywords from the resume to the job description. Reason about whether the candidate's actual experience translates to success in THIS role.
- Explain why skills and experiences are relevant — e.g., "led a cross-functional launch" shows they can drive alignment, not just that they used the word "launch."
- Cite specific evidence from the resume. Avoid vague praise.

## HANDLE NUANCE EXPLICITLY

- Career changers: Explain whether their non-PM background helps or hurts for this role. E.g., "Engineer-turned-PM — strong fit for technical product; they speak engineering language."
- Non-linear paths: Gaps, pivots, role changes — assess in context. Don't penalize automatically.
- Overqualified candidates: Flag honestly — flight risk, compensation expectations, culture fit. Do not sugarcoat.
- Unconventional backgrounds: Note when they bring unique leverage (e.g., doctor for health app, teacher for EdTech).

## OUTPUT MUST BE ACTIONABLE FOR CAREER SERVICES

- Every sentence should be something a career counselor could say or paraphrase when talking to a candidate or hiring partner.
- Use plain, everyday language. No jargon (avoid "synergy," "bandwidth," "leverage" unless necessary).
- summaryReasoning: Start with a one-line takeaway. Then 1–2 sentences a counselor can use in a conversation.
- suggestedTalkingPoints: Copy-paste ready. Things to highlight when introducing this candidate to the hiring partner.
- concerns: Clear, honest flags. What might a hiring partner push back on? Prepare the counselor.

## YOUR EVALUATION FRAMEWORK

For each candidate, assess across five dimensions (0–20 pts each, 100 total):

### 1. Core PM Competency (0–20 pts)
Evidence of: product vision, roadmaps, working with engineering/design, data-driven decisions, shipping products. Ownership language ("I led", "I defined") vs. passive ("I was part of a team...").

### 2. Domain & Context Fit (0–20 pts)
Industry, product type (B2B/consumer, early-stage/scaled), user familiarity. Transferable experience when domain differs.

### 3. Scope & Seniority Match (0–20 pts)
Scale they've operated at vs. role. Flag overqualification (scope exceeds role) honestly.

### 4. Soft Skills & Leadership (0–20 pts)
Stakeholder alignment, cross-functional leadership, ambiguity, customer empathy. Look for influence and decisions vs. tasks completed.

### 5. Role-Specific Requirements (0–20 pts)
Must-haves from the JD. Each unmet must-have reduces score. Nice-to-haves weighted lightly.

## RECOMMENDATION MAPPING

- fitScore 85–100 → "Strong Refer"
- fitScore 70–84 → "Refer"
- fitScore 50–69 → "Maybe"
- fitScore 0–49 → "Don't Refer"`;

const buildUserPrompt = (
  jobDescription: string,
  resumeText: string,
  candidateName: string,
) => `Analyze this candidate against the job description.

## Job Description:
${jobDescription}

## Candidate Resume (${candidateName}):
${resumeText}

Respond with a JSON object in this exact format:
{
  "candidateName": "Name from resume or '${candidateName}'",
  "fitScore": <integer 0-100, must equal sum of scoreBreakdown>,
  "recommendation": "Strong Refer" | "Refer" | "Maybe" | "Don't Refer",
  "scoreBreakdown": {
    "corePm": <0-20>,
    "domainFit": <0-20>,
    "scopeMatch": <0-20>,
    "softSkills": <0-20>,
    "roleSpecific": <0-20>
  },
  "keyStrengths": ["3–5 specific, evidence-backed reasons from WHY THEY FIT. Reference actual experiences, not generic observations."],
  "concerns": ["Honest flags — gaps, overqualification, missing must-haves, red flags. Do not omit to make candidate look better."],
  "summaryReasoning": "Plain-language summary a career counselor can use when talking to the candidate or hiring partner. Start with one clear takeaway, then 1–2 sentences. No jargon. Must be immediately usable.",
  "experienceRelevance": "How their experience maps to this role. Plain language. What a counselor would say when explaining fit.",
  "skillAlignment": "Required skills they have vs. lack. Plain language. Actionable for counselor.",
  "careerTrajectory": "Career path assessment. Plain language.",
  "nuanceNote": "Include only if relevant: career changers, non-linear paths, gaps, pivots, unconventional backgrounds. Explain in plain language whether it helps or hurts for THIS role.",
  "suggestedTalkingPoints": ["2–3 copy-paste ready points for introducing this candidate to the hiring partner. Empty array if Don't Refer. Each point should be a complete sentence the counselor can say aloud."],
  "highlightedTerms": ["3–8 exact phrases from the candidate's resume that most support your assessment. Use verbatim for highlighting."]
}`;

export async function analyzeCandidate(
  jobDescription: string,
  resumeText: string,
  candidateName: string,
): Promise<CandidateAnalysis> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildUserPrompt(jobDescription, resumeText, candidateName) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);

  // Round fitScore to integer for schema compatibility
  if (typeof parsed.fitScore === "number") {
    parsed.fitScore = Math.round(parsed.fitScore);
  }

  const validated = candidateAnalysisSchema.parse(parsed);
  return validated;
}

export async function extractNameFromResume(resumeText: string): Promise<string> {
  const lines = resumeText.split("\n").filter((l) => l.trim().length > 0).slice(0, 5);
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.length > 2 &&
      trimmed.length < 60 &&
      !trimmed.includes("@") &&
      !trimmed.match(/^\d/) &&
      !trimmed.toLowerCase().includes("resume") &&
      !trimmed.toLowerCase().includes("curriculum")
    ) {
      return trimmed;
    }
  }
  return "Unknown Candidate";
}
