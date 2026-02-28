# Task 2 — Airtribe Candidate Matching Automation

## Project Overview
This project is an AI-powered candidate-to-job matching automation tool designed specifically for **Airtribe’s career services team**. 

The goal is to eliminate the manual bottleneck of reviewing dozens of learner resumes against new job descriptions. Instead of simple keyword matching, this tool uses a sophisticated AI agent to reason about a candidate's fit, career trajectory, and specific leverage points—producing a structured, actionable dashboard that a non-technical career counselor can act on immediately.

---

## 🚀 How It Works
1.  **Input Collection**: The user provides a Job Description (either by pasting text or uploading a PDF) and a set of candidate profiles (individual PDFs or a ZIP archive containing multiple resumes).
2.  **Text Extraction**: The system extracts content from PDFs using `pdf-parse` and handles bulk uploads via `jszip`.
3.  **Intelligent Analysis**: For each candidate, an agent powered by `gpt-4o-mini` performs a deep-dive analysis. It evaluates:
    *   **Core PM Competency**: Ownership, vision, and "shipping" experience.
    *   **Domain & Context Fit**: Industry relevance or transferable context.
    *   **Scope & Seniority**: Scale comparison and overqualification flags.
    *   **Leadership**: Stakeholder alignment and ambiguity management.
    *   **Role-Specific Skills**: Direct mapping to must-haves in the JD.
4.  **Actionable Dashboard**: Results are presented in a prioritized list, sorted by Fit Score. Each entry includes:
    *   **Quick Summary**: Jargon-free "one-liners" for the recruiter.
    *   **Evidence-Backed Strengths**: Specific citations from the resume.
    *   **Honest Concerns**: Red flags, compensation hints, or domain gaps.
    *   **Talking Points**: Copy-paste ready introductions for hiring partners.

---

## 🛠️ Technical Stack
*   **AI Model**: `gpt-4o-mini` (OpenAI) – chosen for its high reasoning-to-latency ratio and structured JSON output capabilities.
*   **Backend**: 
    *   **Node.js & Express**: Core API server.
    *   **Drizzle ORM & PostgreSQL**: Persistent storage for analysis history and candidate results.
    *   **Multer & pdf-parse**: For robust file handling and text extraction.
*   **Frontend**:
    *   **React (Vite)**: Modern, responsive UI.
    *   **Tailwind CSS**: Custom, premium design system branded for Airtribe.
    *   **TanStack Query**: For real-time processing updates and seamless data fetching.
    *   **Radix UI**: For accessible components (dialogs, tabs, progress bars).

---

## 🧠 Handling Nuance & Reasoning
The system is explicitly prompted to **avoid simple keyword matching**.
*   **Career Changers**: The AI is instructed to explain whether a non-PM background (e.g., "Engineer-turned-PM") helps or hurts for the specific role being analyzed.
*   **Non-Linear Paths**: The model assesses gaps and pivots in context rather than penalizing them automatically.
*   **Overqualified Candidates**: Instead of a blind "Pass," it flags them honestly for discussion around flight risk or culture fit.

---

## 🛠️ Future Improvements
If given more time, I would implement:
1.  **Semantic Pre-filtering (RAG)**: For pools of 500+ candidates, I would use vector embeddings to identify the top 50 candidates before running the deep reasoning agent, reducing costs and latency.
2.  **Worker Queue**: Moving the processing of large ZIP files to a background worker (like BullMQ or Celery) to avoid request timeouts.
3.  **Human-in-the-Loop Feedback**: Allow career counselors to "Correct" the AI's reasoning. This feedback would be stored to fine-tune the system prompt over time.
4.  **Multi-Resume Comparison**: A "comparison mode" to view two top-scoring candidates side-by-side on specific criteria like "Domain Knowledge" or "Product Vision."
5.  **Slack/Notion Communication Automation**: To meet the team where they work:
    *   **Slack Automation**: A bot where airtribe's career service team members can upload a JD pdf and ZIP file directly to a slack channel. The system would trigger an analysis and post back a summary of the Top 5 candidates as a thread, keeping the team updated without them leaving Slack. Same goes with Notion too. We maintaion a database for this automation, and have each row for new job with columns JD, and zip file. when a new JD is added, the system would trigger an analysis and post back a summary of the Top 5 candidates as a thread, keeping the team updated without them leaving Notion.
