import {
  type User, type InsertUser,
  type MatchingSession, type InsertMatchingSession,
  type CandidateResult, type InsertCandidateResult,
  users, matchingSessions, candidateResults,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createSession(session: InsertMatchingSession): Promise<MatchingSession>;
  getSession(id: number): Promise<MatchingSession | undefined>;
  getAllSessions(): Promise<MatchingSession[]>;
  updateSession(id: number, data: Partial<MatchingSession>): Promise<MatchingSession | undefined>;
  deleteSession(id: number): Promise<void>;

  createCandidateResult(result: InsertCandidateResult): Promise<CandidateResult>;
  getCandidateResult(id: number): Promise<CandidateResult | undefined>;
  getCandidatesBySession(sessionId: number): Promise<CandidateResult[]>;
  updateCandidateResult(id: number, data: Partial<CandidateResult>): Promise<CandidateResult | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createSession(session: InsertMatchingSession): Promise<MatchingSession> {
    const [s] = await db.insert(matchingSessions).values(session).returning();
    return s;
  }

  async getSession(id: number): Promise<MatchingSession | undefined> {
    const [s] = await db.select().from(matchingSessions).where(eq(matchingSessions.id, id));
    return s || undefined;
  }

  async getAllSessions(): Promise<MatchingSession[]> {
    return db.select().from(matchingSessions).orderBy(desc(matchingSessions.createdAt));
  }

  async updateSession(id: number, data: Partial<MatchingSession>): Promise<MatchingSession | undefined> {
    const [s] = await db.update(matchingSessions).set(data).where(eq(matchingSessions.id, id)).returning();
    return s || undefined;
  }

  async deleteSession(id: number): Promise<void> {
    await db.delete(candidateResults).where(eq(candidateResults.sessionId, id));
    await db.delete(matchingSessions).where(eq(matchingSessions.id, id));
  }

  async createCandidateResult(result: InsertCandidateResult): Promise<CandidateResult> {
    const [r] = await db.insert(candidateResults).values(result).returning();
    return r;
  }

  async getCandidateResult(id: number): Promise<CandidateResult | undefined> {
    const [r] = await db.select().from(candidateResults).where(eq(candidateResults.id, id));
    return r || undefined;
  }

  async getCandidatesBySession(sessionId: number): Promise<CandidateResult[]> {
    return db.select().from(candidateResults)
      .where(eq(candidateResults.sessionId, sessionId))
      .orderBy(desc(candidateResults.fitScore));
  }

  async updateCandidateResult(id: number, data: Partial<CandidateResult>): Promise<CandidateResult | undefined> {
    const [r] = await db.update(candidateResults).set(data).where(eq(candidateResults.id, id)).returning();
    return r || undefined;
  }
}

export const storage = new DatabaseStorage();
