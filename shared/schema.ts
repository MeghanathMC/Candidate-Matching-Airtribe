import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const matchingSessions = pgTable("matching_sessions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  jobDescriptionText: text("job_description_text").notNull(),
  jobTitle: text("job_title"),
  status: text("status").notNull().default("pending"),
  candidateCount: integer("candidate_count").notNull().default(0),
  completedCount: integer("completed_count").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export interface ScoreBreakdown {
  corePm: number;
  domainFit: number;
  scopeMatch: number;
  softSkills: number;
  roleSpecific: number;
}

export const candidateResults = pgTable("candidate_results", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => matchingSessions.id, { onDelete: "cascade" }),
  candidateName: text("candidate_name").notNull(),
  fileName: text("file_name").notNull(),
  resumeText: text("resume_text").notNull(),
  fitScore: integer("fit_score"),
  recommendation: text("recommendation"),
  keyStrengths: text("key_strengths").array(),
  concerns: text("concerns").array(),
  summaryReasoning: text("summary_reasoning"),
  experienceRelevance: text("experience_relevance"),
  skillAlignment: text("skill_alignment"),
  careerTrajectory: text("career_trajectory"),
  scoreBreakdown: jsonb("score_breakdown").$type<ScoreBreakdown>(),
  nuanceNote: text("nuance_note"),
  suggestedTalkingPoints: text("suggested_talking_points").array(),
  highlightedTerms: text("highlighted_terms").array(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const matchingSessionsRelations = relations(matchingSessions, ({ many }) => ({
  candidates: many(candidateResults),
}));

export const candidateResultsRelations = relations(candidateResults, ({ one }) => ({
  session: one(matchingSessions, {
    fields: [candidateResults.sessionId],
    references: [matchingSessions.id],
  }),
}));

export const insertMatchingSessionSchema = createInsertSchema(matchingSessions).omit({
  id: true,
  createdAt: true,
});

export const insertCandidateResultSchema = createInsertSchema(candidateResults).omit({
  id: true,
  createdAt: true,
});

export type MatchingSession = typeof matchingSessions.$inferSelect;
export type InsertMatchingSession = z.infer<typeof insertMatchingSessionSchema>;
export type CandidateResult = typeof candidateResults.$inferSelect;
export type InsertCandidateResult = z.infer<typeof insertCandidateResultSchema>;

export const scoreBreakdownSchema = z.object({
  corePm: z.number().min(0).max(20),
  domainFit: z.number().min(0).max(20),
  scopeMatch: z.number().min(0).max(20),
  softSkills: z.number().min(0).max(20),
  roleSpecific: z.number().min(0).max(20),
});

export const candidateAnalysisSchema = z.object({
  candidateName: z.string(),
  fitScore: z.number().min(0).max(100),
  recommendation: z.enum(["Strong Refer", "Refer", "Maybe", "Don't Refer"]),
  keyStrengths: z.array(z.string()),
  concerns: z.array(z.string()),
  summaryReasoning: z.string(),
  experienceRelevance: z.string(),
  skillAlignment: z.string(),
  careerTrajectory: z.string(),
  scoreBreakdown: scoreBreakdownSchema.optional(),
  nuanceNote: z.string().optional(),
  suggestedTalkingPoints: z.array(z.string()).optional(),
  highlightedTerms: z.array(z.string()).optional(),
});

export type CandidateAnalysis = z.infer<typeof candidateAnalysisSchema>;
