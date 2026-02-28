import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload,
  FileText,
  Archive,
  Briefcase,
  Users,
  Clock,
  ChevronRight,
  Trash2,
  Plus,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { MatchingSession } from "@shared/schema";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("new");

  const sessionsQuery = useQuery<MatchingSession[]>({
    queryKey: ["/api/sessions"],
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3">
            <img src="/airtribe-logo.png" alt="Airtribe" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight" data-testid="text-app-title">
                CandidateMatch AI
              </h1>
              <p className="text-sm text-muted-foreground">
                AI-powered matching that helps you refer the right candidates — clear summaries you can use when talking to hiring partners
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="new" data-testid="tab-new-session">
              <Plus className="w-4 h-4 mr-1.5" />
              New Analysis
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <Clock className="w-4 h-4 mr-1.5" />
              History
              {sessionsQuery.data && sessionsQuery.data.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {sessionsQuery.data.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new">
            <NewSessionForm
              onCreated={(id) => {
                setLocation(`/sessions/${id}`);
              }}
            />
          </TabsContent>

          <TabsContent value="history">
            <SessionHistory
              sessions={sessionsQuery.data || []}
              isLoading={sessionsQuery.isLoading}
              onSelect={(id) => setLocation(`/sessions/${id}`)}
              onDelete={async (id) => {
                try {
                  await fetch(`/api/sessions/${id}`, { method: "DELETE" });
                  queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
                  toast({ title: "Session deleted" });
                } catch {
                  toast({ title: "Failed to delete session", variant: "destructive" });
                }
              }}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function NewSessionForm({ onCreated }: { onCreated: (id: number) => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jdInputMode, setJdInputMode] = useState<"text" | "pdf">("text");
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dragOverJd, setDragOverJd] = useState(false);
  const [dragOverResume, setDragOverResume] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("title", title || jobTitle || "Untitled Session");
      formData.append("jobTitle", jobTitle);

      if (jdInputMode === "text") {
        formData.append("jobDescriptionText", jobDescriptionText);
      } else if (jdFile) {
        formData.append("jobDescription", jdFile);
      }

      if (resumeFile) {
        formData.append("resumes", resumeFile);
      }

      const res = await fetch("/api/sessions", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create session");
      }

      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "Analysis started", description: "Your candidates are being analyzed..." });
      onCreated(data.id);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleJdDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverJd(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      setJdFile(file);
      setJdInputMode("pdf");
    }
  }, []);

  const handleResumeDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverResume(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setResumeFile(file);
    }
  }, []);

  const isValid =
    (jdInputMode === "text" ? jobDescriptionText.trim().length > 0 : jdFile !== null) &&
    resumeFile !== null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Session Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Session Title</label>
              <Input
                data-testid="input-session-title"
                placeholder="e.g. Senior PM - Growth Team"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Job Title</label>
              <Input
                data-testid="input-job-title"
                placeholder="e.g. Senior Product Manager"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Job Description</CardTitle>
              </div>
              <div className="flex gap-1">
                <Button
                  variant={jdInputMode === "text" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setJdInputMode("text")}
                  data-testid="button-jd-text-mode"
                >
                  Paste Text
                </Button>
                <Button
                  variant={jdInputMode === "pdf" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setJdInputMode("pdf")}
                  data-testid="button-jd-pdf-mode"
                >
                  Upload PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {jdInputMode === "text" ? (
              <Textarea
                data-testid="textarea-job-description"
                placeholder="Paste the full job description here..."
                className="min-h-[200px] resize-y text-sm"
                value={jobDescriptionText}
                onChange={(e) => setJobDescriptionText(e.target.value)}
              />
            ) : (
              <div
                className={`border-2 border-dashed rounded-md p-8 text-center transition-colors cursor-pointer ${
                  dragOverJd
                    ? "border-primary bg-primary/5"
                    : jdFile
                      ? "border-chart-2 bg-chart-2/5"
                      : "border-muted-foreground/20"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverJd(true);
                }}
                onDragLeave={() => setDragOverJd(false)}
                onDrop={handleJdDrop}
                onClick={() => document.getElementById("jd-file-input")?.click()}
                data-testid="dropzone-job-description"
              >
                <input
                  id="jd-file-input"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setJdFile(file);
                  }}
                />
                {jdFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-chart-2" />
                    <p className="font-medium text-sm">{jdFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(jdFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Drop JD PDF here or click to browse</p>
                    <p className="text-xs text-muted-foreground">PDF files only</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Candidate Resumes</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a ZIP file containing PDF resumes or a single PDF resume
            </p>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-md p-12 text-center transition-colors cursor-pointer ${
                dragOverResume
                  ? "border-primary bg-primary/5"
                  : resumeFile
                    ? "border-chart-2 bg-chart-2/5"
                    : "border-muted-foreground/20"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverResume(true);
              }}
              onDragLeave={() => setDragOverResume(false)}
              onDrop={handleResumeDrop}
              onClick={() => document.getElementById("resume-file-input")?.click()}
              data-testid="dropzone-resumes"
            >
              <input
                id="resume-file-input"
                type="file"
                accept=".zip,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setResumeFile(file);
                }}
              />
              {resumeFile ? (
                <div className="flex flex-col items-center gap-3">
                  <CheckCircle2 className="w-10 h-10 text-chart-2" />
                  <div>
                    <p className="font-medium">{resumeFile.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(resumeFile.size / 1024).toFixed(1)} KB
                      {resumeFile.name.endsWith(".zip") && " (ZIP archive)"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setResumeFile(null);
                    }}
                    data-testid="button-remove-resume"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <Archive className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Drop files here or click to browse</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ZIP file with PDFs, or a single PDF resume
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full"
          size="lg"
          disabled={!isValid || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          data-testid="button-start-analysis"
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading & Processing...
            </>
          ) : (
            <>
              <img src="/favicon.jpg" alt="" className="w-4 h-4 mr-2 rounded-sm" />
              Start AI Analysis
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function SessionHistory({
  sessions,
  isLoading,
  onSelect,
  onDelete,
}: {
  sessions: MatchingSession[];
  isLoading: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium">No analysis sessions yet</p>
        <p className="text-muted-foreground mt-1">Create a new analysis to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <Card
          key={session.id}
          className="hover-elevate active-elevate-2 cursor-pointer transition-all"
          onClick={() => onSelect(session.id)}
          data-testid={`card-session-${session.id}`}
        >
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate" data-testid={`text-session-title-${session.id}`}>
                  {session.title}
                </p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {new Date(session.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {session.candidateCount} candidate{session.candidateCount !== 1 ? "s" : ""}
                  </span>
                  <SessionStatusBadge status={session.status} completed={session.completedCount} total={session.candidateCount} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(session.id);
                }}
                data-testid={`button-delete-session-${session.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SessionStatusBadge({
  status,
  completed,
  total,
}: {
  status: string;
  completed: number;
  total: number;
}) {
  if (status === "completed") {
    return (
      <Badge variant="default" className="text-xs">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Complete
      </Badge>
    );
  }
  if (status === "processing") {
    return (
      <Badge variant="secondary" className="text-xs">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        {completed}/{total}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      <AlertCircle className="w-3 h-3 mr-1" />
      {status}
    </Badge>
  );
}
