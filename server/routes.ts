import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import JSZip from "jszip";
import { PDFParse } from "pdf-parse";
import { analyzeCandidate, extractNameFromResume } from "./analyze";
import path from "path";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text || result.pages.map((p: any) => p.text).join("\n\n");
}

async function extractResumesFromZip(
  zipBuffer: Buffer,
): Promise<{ fileName: string; text: string }[]> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const results: { fileName: string; text: string }[] = [];

  for (const [filePath, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".pdf") continue;

    const name = path.basename(filePath, ext);
    if (name.startsWith("._") || name.startsWith("__MACOSX")) continue;

    try {
      const buffer = await file.async("nodebuffer");
      const text = await extractPdfText(buffer);
      if (text.trim().length > 0) {
        results.push({ fileName: path.basename(filePath), text });
      }
    } catch (err) {
      console.error(`Failed to parse PDF ${filePath}:`, err);
    }
  }
  return results;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.get("/api/sessions", async (_req, res) => {
    try {
      const sessions = await storage.getAllSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getSession(id);
      if (!session) return res.status(404).json({ error: "Session not found" });
      const candidates = await storage.getCandidatesBySession(id);
      res.json({ ...session, candidates });
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSession(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  app.post(
    "/api/sessions",
    upload.fields([
      { name: "jobDescription", maxCount: 1 },
      { name: "resumes", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const files = req.files as {
          [fieldname: string]: Express.Multer.File[];
        };

        let jobDescriptionText = req.body.jobDescriptionText || "";
        const title = req.body.title || "Untitled Session";

        if (files?.jobDescription?.[0]) {
          const jdFile = files.jobDescription[0];
          if (jdFile.mimetype === "application/pdf") {
            jobDescriptionText = await extractPdfText(jdFile.buffer);
          } else {
            jobDescriptionText = jdFile.buffer.toString("utf-8");
          }
        }

        if (!jobDescriptionText.trim()) {
          return res
            .status(400)
            .json({ error: "Job description is required" });
        }

        let resumes: { fileName: string; text: string }[] = [];
        if (files?.resumes?.[0]) {
          const resumeFile = files.resumes[0];
          const ext = path
            .extname(resumeFile.originalname)
            .toLowerCase();

          if (ext === ".zip") {
            resumes = await extractResumesFromZip(resumeFile.buffer);
          } else if (ext === ".pdf") {
            const text = await extractPdfText(resumeFile.buffer);
            resumes = [
              { fileName: resumeFile.originalname, text },
            ];
          }
        }

        if (resumes.length === 0) {
          return res
            .status(400)
            .json({ error: "At least one resume PDF is required" });
        }

        const session = await storage.createSession({
          title,
          jobDescriptionText,
          jobTitle: req.body.jobTitle || null,
          status: "processing",
          candidateCount: resumes.length,
          completedCount: 0,
        });

        const candidateRecords = [];
        for (const resume of resumes) {
          const name = await extractNameFromResume(resume.text);
          const candidate = await storage.createCandidateResult({
            sessionId: session.id,
            candidateName: name,
            fileName: resume.fileName,
            resumeText: resume.text,
            status: "pending",
            fitScore: null,
            recommendation: null,
            keyStrengths: null,
            concerns: null,
            summaryReasoning: null,
            experienceRelevance: null,
            skillAlignment: null,
            careerTrajectory: null,
          });
          candidateRecords.push(candidate);
        }

        res.status(201).json({ ...session, candidates: candidateRecords });

        processSessionAsync(session.id, jobDescriptionText, candidateRecords);
      } catch (error) {
        console.error("Error creating session:", error);
        res.status(500).json({ error: "Failed to create session" });
      }
    },
  );

  app.get("/api/sessions/:id/candidates/:candidateId", async (req, res) => {
    try {
      const candidateId = parseInt(req.params.candidateId);
      const candidate = await storage.getCandidateResult(candidateId);
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });
      res.json(candidate);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch candidate" });
    }
  });

  app.get("/api/sessions/:id/export", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getSession(id);
      if (!session) return res.status(404).json({ error: "Session not found" });

      let candidates = await storage.getCandidatesBySession(id);
      const recTier: Record<string, number> = { "Strong Refer": 4, Refer: 3, Maybe: 2, "Don't Refer": 1 };
      candidates = candidates.sort((a, b) => {
        const sa = a.fitScore ?? -1, sb = b.fitScore ?? -1;
        if (sb !== sa) return sb - sa;
        const ta = recTier[a.recommendation ?? ""] ?? 0, tb = recTier[b.recommendation ?? ""] ?? 0;
        return tb - ta;
      });

      const headers = [
        "Rank",
        "Candidate Name",
        "File",
        "Fit Score",
        "Recommendation",
        "Key Strengths",
        "Concerns",
        "Summary",
        "Experience Relevance",
        "Skill Alignment",
        "Career Trajectory",
        "Nuance Note",
        "Suggested Talking Points",
      ];

      const rows = candidates.map((c, i) => [
        i + 1,
        c.candidateName,
        c.fileName,
        c.fitScore ?? "N/A",
        c.recommendation ?? "Pending",
        (c.keyStrengths || []).join("; "),
        (c.concerns || []).join("; "),
        c.summaryReasoning || "",
        c.experienceRelevance || "",
        c.skillAlignment || "",
        c.careerTrajectory || "",
        c.nuanceNote || "",
        (c.suggestedTalkingPoints || []).join("; "),
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="candidate-matching-${session.title.replace(/[^a-z0-9]/gi, "_")}.csv"`,
      );
      res.send(csvContent);
    } catch (error) {
      res.status(500).json({ error: "Failed to export" });
    }
  });

  return httpServer;
}

async function processSessionAsync(
  sessionId: number,
  jobDescription: string,
  candidates: Array<{
    id: number;
    candidateName: string;
    resumeText: string;
  }>,
) {
  let completedCount = 0;

  for (const candidate of candidates) {
    try {
      const analysis = await analyzeCandidate(
        jobDescription,
        candidate.resumeText,
        candidate.candidateName,
      );

      await storage.updateCandidateResult(candidate.id, {
        candidateName: analysis.candidateName,
        fitScore: Math.round(analysis.fitScore),
        recommendation: analysis.recommendation,
        keyStrengths: analysis.keyStrengths,
        concerns: analysis.concerns,
        summaryReasoning: analysis.summaryReasoning,
        experienceRelevance: analysis.experienceRelevance,
        skillAlignment: analysis.skillAlignment,
        careerTrajectory: analysis.careerTrajectory,
        scoreBreakdown: analysis.scoreBreakdown ?? null,
        nuanceNote: analysis.nuanceNote ?? null,
        suggestedTalkingPoints: analysis.suggestedTalkingPoints ?? null,
        highlightedTerms: analysis.highlightedTerms ?? null,
        status: "completed",
      });

      completedCount++;
      await storage.updateSession(sessionId, { completedCount });
    } catch (error) {
      console.error(
        `Error analyzing candidate ${candidate.candidateName}:`,
        error,
      );
      await storage.updateCandidateResult(candidate.id, {
        status: "error",
        summaryReasoning: `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      completedCount++;
      await storage.updateSession(sessionId, { completedCount });
    }
  }

  await storage.updateSession(sessionId, { status: "completed" });
}
