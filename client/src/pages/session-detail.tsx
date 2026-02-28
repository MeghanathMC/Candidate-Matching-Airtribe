import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Download,
  Sparkles,
  Users,
  Trophy,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Target,
  TrendingUp,
  Lightbulb,
  FileText,
  User,
  HelpCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MatchingSession, CandidateResult, ScoreBreakdown } from "@shared/schema";

type SessionWithCandidates = MatchingSession & { candidates: CandidateResult[] };

const RECOMMENDATION_TIER: Record<string, number> = {
  "Strong Refer": 4,
  Refer: 3,
  Maybe: 2,
  "Don't Refer": 1,
};

function HighlightedText({ text, terms }: { text: string; terms?: string[] | null }) {
  if (!terms || terms.length === 0) return <>{text}</>;
  const segments: { text: string; highlight: boolean }[] = [];
  let pos = 0;
  const sortedTerms = [...terms].filter((t) => t.trim().length > 0).sort((a, b) => b.length - a.length);
  while (pos < text.length) {
    let earliest: { index: number; length: number } | null = null;
    for (const term of sortedTerms) {
      const idx = text.toLowerCase().indexOf(term.toLowerCase(), pos);
      if (idx !== -1 && (!earliest || idx < earliest.index)) {
        earliest = { index: idx, length: term.length };
      }
    }
    if (!earliest) {
      segments.push({ text: text.slice(pos), highlight: false });
      break;
    }
    if (earliest.index > pos) {
      segments.push({ text: text.slice(pos, earliest.index), highlight: false });
    }
    segments.push({ text: text.slice(earliest.index, earliest.index + earliest.length), highlight: true });
    pos = earliest.index + earliest.length;
  }
  return (
    <>
      {segments.map((s, i) =>
        s.highlight ? (
          <mark key={i} className="bg-primary/20 rounded px-0.5">
            {s.text}
          </mark>
        ) : (
          s.text
        )
      )}
    </>
  );
}

function sortCandidates(candidates: CandidateResult[]): CandidateResult[] {
  return [...candidates].sort((a, b) => {
    const scoreA = a.fitScore ?? -1;
    const scoreB = b.fitScore ?? -1;
    if (scoreB !== scoreA) return scoreB - scoreA;

    const tierA = RECOMMENDATION_TIER[a.recommendation ?? ""] ?? 0;
    const tierB = RECOMMENDATION_TIER[b.recommendation ?? ""] ?? 0;
    if (tierB !== tierA) return tierB - tierA;

    const strengthsA = (a.keyStrengths?.length ?? 0);
    const strengthsB = (b.keyStrengths?.length ?? 0);
    if (strengthsB !== strengthsA) return strengthsB - strengthsA;

    const concernsA = (a.concerns?.length ?? 0);
    const concernsB = (b.concerns?.length ?? 0);
    if (concernsA !== concernsB) return concernsA - concernsB;

    return (a.candidateName ?? "").localeCompare(b.candidateName ?? "");
  });
}

export default function SessionDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResult | null>(null);
  const [filterTab, setFilterTab] = useState("all");

  const sessionId = parseInt(params.id || "0");

  const { data: session, isLoading } = useQuery<SessionWithCandidates>({
    queryKey: ["/api/sessions", sessionId],
    refetchInterval: (query) => {
      const data = query.state.data as SessionWithCandidates | undefined;
      if (data && data.status === "completed") return false;
      return 3000;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <HeaderSkeleton />
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium">Session not found</p>
          <Button variant="ghost" className="mt-4" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to home
          </Button>
        </div>
      </div>
    );
  }

  const candidates = session.candidates || [];
  const sortedCandidates = sortCandidates(candidates);
  const completedCandidates = sortedCandidates.filter((c) => c.status === "completed");
  const isProcessing = session.status === "processing";
  const progressPercent = session.candidateCount > 0
    ? (session.completedCount / session.candidateCount) * 100
    : 0;

  const top5Candidates = completedCandidates.slice(0, 5);

  const filteredCandidates = sortedCandidates.filter((c) => {
    if (filterTab === "all") return true;
    if (filterTab === "strong-refer") return c.recommendation === "Strong Refer";
    if (filterTab === "refer") return c.recommendation === "Refer";
    if (filterTab === "maybe") return c.recommendation === "Maybe";
    if (filterTab === "pass") return c.recommendation === "Don't Refer";
    if (filterTab === "top5") return top5Candidates.some((t) => t.id === c.id);
    if (filterTab === "pending") return c.status === "pending";
    return true;
  });

  const stats = {
    strongRefer: completedCandidates.filter((c) => c.recommendation === "Strong Refer").length,
    refer: completedCandidates.filter((c) => c.recommendation === "Refer").length,
    maybe: completedCandidates.filter((c) => c.recommendation === "Maybe").length,
    pass: completedCandidates.filter((c) => c.recommendation === "Don't Refer").length,
    avgScore:
      completedCandidates.length > 0
        ? Math.round(
            completedCandidates.reduce((sum, c) => sum + (c.fitScore || 0), 0) /
              completedCandidates.length,
          )
        : 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/")}
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
               <img src="/favicon.jpg" alt="Airtribe" className="h-8 w-8 rounded-full" />
               <div className="min-w-0">
                <h1
                  className="text-lg font-semibold truncate"
                  data-testid="text-session-title"
                >
                  {session.title}
                </h1>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {session.jobTitle && (
                    <span className="text-xs text-muted-foreground">
                      {session.jobTitle}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(session.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {session.status === "completed" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    window.open(`/api/sessions/${session.id}/export`, "_blank");
                  }}
                  data-testid="button-export-csv"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {isProcessing && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="font-medium text-sm">
                  Analyzing candidates... {session.completedCount} of {session.candidateCount} complete
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </CardContent>
          </Card>
        )}

        {completedCandidates.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard
              icon={<Trophy className="w-4 h-4" />}
              label="Strong Refer"
              tooltip="Best fits — recommend confidently to the hiring partner"
              value={stats.strongRefer}
              color="text-chart-2"
              bgColor="bg-chart-2/10"
              filterValue="strong-refer"
              isActive={filterTab === "strong-refer"}
              onClick={() => setFilterTab("strong-refer")}
            />
            <StatCard
              icon={<CheckCircle2 className="w-4 h-4" />}
              label="Refer"
              tooltip="Good fit with some gaps — worth referring, note any concerns"
              value={stats.refer}
              color="text-primary"
              bgColor="bg-primary/10"
              filterValue="refer"
              isActive={filterTab === "refer"}
              onClick={() => setFilterTab("refer")}
            />
            <StatCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Maybe"
              tooltip="Mixed signals — discuss with colleague before referring"
              value={stats.maybe}
              color="text-chart-4"
              bgColor="bg-chart-4/10"
              filterValue="maybe"
              isActive={filterTab === "maybe"}
              onClick={() => setFilterTab("maybe")}
            />
            <StatCard
              icon={<XCircle className="w-4 h-4" />}
              label="Don't Refer"
              tooltip="Not a match for this role — save for other opportunities"
              value={stats.pass}
              color="text-destructive"
              bgColor="bg-destructive/10"
              filterValue="pass"
              isActive={filterTab === "pass"}
              onClick={() => setFilterTab("pass")}
            />
            {top5Candidates.length > 0 && (
              <StatCard
                icon={<Users className="w-4 h-4" />}
                label="Top 5"
                tooltip="Your best candidates — start here when sharing with hiring partners"
                value={top5Candidates.length}
                color="text-chart-3"
                bgColor="bg-chart-3/10"
                filterValue="top5"
                isActive={filterTab === "top5"}
                onClick={() => setFilterTab("top5")}
              />
            )}
          </div>
        )}

        <Tabs value={filterTab} onValueChange={setFilterTab}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <TabsList>
              <TabsTrigger value="all" data-testid="filter-all">
                All ({candidates.length})
              </TabsTrigger>
              <TabsTrigger value="strong-refer" data-testid="filter-strong-refer">
                Strong Refer ({stats.strongRefer})
              </TabsTrigger>
              <TabsTrigger value="refer" data-testid="filter-refer">
                Refer ({stats.refer})
              </TabsTrigger>
              <TabsTrigger value="maybe" data-testid="filter-maybe">
                Maybe ({stats.maybe})
              </TabsTrigger>
              <TabsTrigger value="pass" data-testid="filter-pass">
                Pass ({stats.pass})
              </TabsTrigger>
              {top5Candidates.length > 0 && (
                <TabsTrigger value="top5" data-testid="filter-top5">
                  Top 5
                </TabsTrigger>
              )}
              {isProcessing && (
                <TabsTrigger value="pending" data-testid="filter-pending">
                  Pending
                </TabsTrigger>
              )}
            </TabsList>
            {completedCandidates.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Avg Score: <span className="font-semibold text-foreground">{stats.avgScore}</span>/100
              </div>
            )}
          </div>

          <TabsContent value={filterTab} className="mt-4">
            {filteredCandidates.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No candidates in this category</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCandidates.map((candidate, index) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    rank={
                      filterTab === "all" || filterTab === "top5"
                        ? sortedCandidates.findIndex((c) => c.id === candidate.id) + 1
                        : index + 1
                    }
                    onClick={() => setSelectedCandidate(candidate)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog
        open={selectedCandidate !== null}
        onOpenChange={() => setSelectedCandidate(null)}
      >
        {selectedCandidate && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <span data-testid="text-candidate-detail-name">
                    {selectedCandidate.candidateName}
                  </span>
                  {selectedCandidate.fitScore !== null && (
                    <ScoreBadge score={selectedCandidate.fitScore} className="ml-3" />
                  )}
                </div>
              </DialogTitle>
            </DialogHeader>

            <CandidateDetailContent candidate={selectedCandidate} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bgColor,
  tooltip,
  filterValue,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bgColor: string;
  tooltip?: string;
  filterValue?: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const card = (
    <Card
      className={`transition-all ${onClick ? "cursor-pointer hover:border-primary/50" : ""} ${isActive ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-8 h-8 rounded-md ${bgColor} flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        {tooltip && (
          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0 ml-auto" />
        )}
      </CardContent>
    </Card>
  );
  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="h-full">{card}</div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px]">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return card;
}

function CandidateCard({
  candidate,
  rank,
  onClick,
}: {
  candidate: CandidateResult;
  rank: number;
  onClick: () => void;
}) {
  if (candidate.status === "pending") {
    return (
      <Card className="opacity-60" data-testid={`card-candidate-${candidate.id}`}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
            {rank}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{candidate.candidateName}</p>
            <p className="text-xs text-muted-foreground">{candidate.fileName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Analyzing...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (candidate.status === "error") {
    return (
      <Card data-testid={`card-candidate-${candidate.id}`}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center text-sm font-medium text-destructive">
            !
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{candidate.candidateName}</p>
            <p className="text-xs text-destructive">{candidate.summaryReasoning}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="hover-elevate active-elevate-2 cursor-pointer transition-all"
      onClick={onClick}
      data-testid={`card-candidate-${candidate.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {rank}
            </div>
          </div>

          <div className="flex-1 min-w-0 overflow-hidden break-all">
            <div className="flex items-center gap-2 mb-2 flex-wrap min-w-0">
              <p className="font-semibold text-sm sm:text-base leading-tight" data-testid={`text-candidate-name-${candidate.id}`}>
                {candidate.candidateName}
              </p>
              <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                {candidate.fitScore !== null && <ScoreBadge score={candidate.fitScore} />}
                <RecommendationBadge recommendation={candidate.recommendation} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3 mb-2 whitespace-normal leading-relaxed break-words">
              {candidate.summaryReasoning}
            </p>
            <div className="flex gap-2 flex-wrap min-w-0">
              {candidate.keyStrengths?.slice(0, 2).map((s, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] sm:text-xs h-5">
                  {s}
                </Badge>
              ))}
              {candidate.concerns?.slice(0, 1).map((c, i) => (
                <Badge key={i} variant="outline" className="text-[10px] sm:text-xs text-muted-foreground h-5">
                  {c}
                </Badge>
              ))}
            </div>
          </div>

          <div className="text-[10px] sm:text-xs text-muted-foreground flex-shrink-0 text-right max-w-[80px] sm:max-w-[120px] truncate ml-auto">
            <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 inline mr-1" />
            {candidate.fileName}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CandidateDetailContent({ candidate }: { candidate: CandidateResult }) {
  const sb = candidate.scoreBreakdown as ScoreBreakdown | null | undefined;
  const highlightedTerms = candidate.highlightedTerms ?? null;

  return (
    <div className="space-y-5 pt-2">
      {candidate.recommendation && (
        <div className="flex items-center gap-3">
          <RecommendationBadge recommendation={candidate.recommendation} large />
          <span className="text-sm text-muted-foreground">
            from {candidate.fileName}
          </span>
        </div>
      )}

      {candidate.summaryReasoning && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-4 h-4 mt-0.5 text-chart-4 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium mb-1">Quick summary — use when talking to candidates or hiring partners</p>
                <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-summary-reasoning">
                  <HighlightedText text={candidate.summaryReasoning} terms={highlightedTerms} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {candidate.suggestedTalkingPoints && candidate.suggestedTalkingPoints.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-chart-4" />
              What to highlight when introducing to the hiring partner
            </p>
            <ul className="space-y-1.5">
              {candidate.suggestedTalkingPoints.map((point, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-chart-4 mt-1 flex-shrink-0">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {candidate.nuanceNote && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-1">Important context — career path, gaps, or pivots</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <HighlightedText text={candidate.nuanceNote} terms={highlightedTerms} />
            </p>
          </CardContent>
        </Card>
      )}

      {sb && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">Score breakdown</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">Product skills</p>
                <p className="font-semibold">{sb.corePm}/20</p>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">Industry match</p>
                <p className="font-semibold">{sb.domainFit}/20</p>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">Experience level</p>
                <p className="font-semibold">{sb.scopeMatch}/20</p>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">Leadership & communication</p>
                <p className="font-semibold">{sb.softSkills}/20</p>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">Job requirements met</p>
                <p className="font-semibold">{sb.roleSpecific}/20</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {candidate.keyStrengths && candidate.keyStrengths.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-chart-2" />
            Why they fit
          </p>
          <ul className="space-y-1.5">
            {candidate.keyStrengths.map((s, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-chart-2 mt-1 flex-shrink-0">+</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidate.concerns && candidate.concerns.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-chart-4" />
            What to watch — address these if the hiring partner asks
          </p>
          <ul className="space-y-1.5">
            {candidate.concerns.map((c, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-chart-4 mt-1 flex-shrink-0">-</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {candidate.experienceRelevance && (
          <DetailSection
            icon={<Briefcase className="w-4 h-4 text-primary" />}
            title="How their experience fits this role"
            content={candidate.experienceRelevance}
            highlightedTerms={highlightedTerms}
          />
        )}

        {candidate.skillAlignment && (
          <DetailSection
            icon={<Target className="w-4 h-4 text-chart-2" />}
            title="Skills they have vs. what the role needs"
            content={candidate.skillAlignment}
            highlightedTerms={highlightedTerms}
          />
        )}

        {candidate.careerTrajectory && (
          <DetailSection
            icon={<TrendingUp className="w-4 h-4 text-chart-3" />}
            title="Career path"
            content={candidate.careerTrajectory}
            highlightedTerms={highlightedTerms}
          />
        )}
      </div>
    </div>
  );
}

function DetailSection({
  icon,
  title,
  content,
  highlightedTerms,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
  highlightedTerms?: string[] | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-medium mb-0.5">{title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <HighlightedText text={content} terms={highlightedTerms} />
        </p>
      </div>
    </div>
  );
}

function ScoreBadge({ score, className = "" }: { score: number; className?: string }) {
  let color = "bg-destructive/10 text-destructive";
  if (score >= 85) color = "bg-chart-2/15 text-chart-2";
  else if (score >= 70) color = "bg-primary/10 text-primary";
  else if (score >= 50) color = "bg-chart-4/15 text-chart-4";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${color} ${className}`}
      data-testid="badge-fit-score"
    >
      {score}
    </span>
  );
}

function RecommendationBadge({
  recommendation,
  large = false,
}: {
  recommendation: string | null;
  large?: boolean;
}) {
  if (!recommendation) return null;

  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    "Strong Refer": { variant: "default", icon: <Trophy className="w-3 h-3" /> },
    Refer: { variant: "secondary", icon: <CheckCircle2 className="w-3 h-3" /> },
    Maybe: { variant: "outline", icon: <AlertTriangle className="w-3 h-3" /> },
    "Don't Refer": { variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
  };

  const c = config[recommendation] || { variant: "secondary" as const, icon: null };

  return (
    <Badge
      variant={c.variant}
      className={large ? "text-sm px-3 py-1" : "text-xs"}
      data-testid="badge-recommendation"
    >
      {c.icon && <span className="mr-1">{c.icon}</span>}
      {recommendation}
    </Badge>
  );
}

function HeaderSkeleton() {
  return (
    <header className="border-b bg-card">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>
    </header>
  );
}
