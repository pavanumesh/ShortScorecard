import { useState, useEffect, useMemo } from "react";
import { Question, Answer, SectionScore, CommunityInfoItem } from "@/types/scorecard";
import QuestionCard from "@/components/QuestionCard";
import SectionHeader from "@/components/SectionHeader";
import ScoreFooter from "@/components/ScoreFooter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type RawQuestion = Record<string, unknown>;

function getScaleLabel(raw: RawQuestion, i: number): string {
  const opts = raw.Options as Array<{ value?: number; label?: string }> | undefined;
  const fromOpts = opts?.[i]?.label;
  if (typeof fromOpts === "string" && fromOpts.trim()) return fromOpts.trim();

  for (const k of [`Scale${i}`, `Scale ${i}`, String(i)]) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string" || !v.trim()) continue;
    const n = k.trim().toLowerCase();
    if (n === `scale${i}` || n === `scale ${i}` || n === String(i)) return (v as string).trim();
  }
  return `Score ${i}`;
}

function normalizeQuestion(raw: RawQuestion): Question {
  return {
    ...(raw as Partial<Question>),
    QID: String(raw.QID ?? ""),
    Section: String(raw.Section ?? ""),
    Question: String(raw.Question ?? ""),
    Tooltip: String(raw.Tooltip ?? ""),
    AllowNA: String(raw.AllowNA ?? "FALSE"),
    Weight: Number(raw.Weight) || 1,
    Scale0: getScaleLabel(raw, 0),
    Scale1: getScaleLabel(raw, 1),
    Scale2: getScaleLabel(raw, 2),
    Scale3: getScaleLabel(raw, 3),
    Scale4: getScaleLabel(raw, 4),
  };
}

/** Section codes (E1–E10) → display names from column B. Used when no Sections sheet data. */
const SECTION_NAMES: Record<string, string> = {
  E1: "Governance",
  E2: "Risk Understanding",
  E3: "Financial Capacity",
  E4: "Land Use & Built Environment",
  E5: "Natural Systems",
  E6: "Institutional Capacity",
  E7: "Societal Capacity",
  E8: "Infrastructure",
  E9: "Disaster Response",
  E10: "Expedite Recovery",
};

/** Digit before "." in QID is the section number (1.1 → 1, 2.3 → 2, 10.1 → 10). */
function getSectionCodeFromQid(qid: string): string {
  const m = String(qid || "").match(/^(\d+)/);
  const n = m ? parseInt(m[1], 10) : 0;
  return n >= 1 && n <= 10 ? `E${n}` : "E1";
}

/** Carry forward section when empty (spreadsheet often leaves Section blank for rows in same section). */
function carryForwardSections(questions: Question[]): Question[] {
  let lastSection = "";
  return questions.map((q) => {
    const section = (q.Section || "").trim();
    if (section) {
      lastSection = section;
      return q;
    }
    if (lastSection) {
      return { ...q, Section: lastSection };
    }
    return q;
  });
}

function getCommunityInfoQA(item: CommunityInfoItem): { q: string; a: string } {
  const keys = Object.keys(item);
  const tryKey = (k: string) => {
    const v = item[k];
    return typeof v === "string" ? v.trim() : v != null ? String(v).trim() : "";
  };
  const q =
    tryKey("Question") || tryKey("Topic") || tryKey("Label") || (keys[0] ? tryKey(keys[0]) : "");
  const a =
    tryKey("Answer") || tryKey("Details") || tryKey("Content") || (keys[1] ? tryKey(keys[1]) : "");
  return { q, a };
}

// Replace with your Google Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbz09JFGDNo3qgpLVUpk2v5Sny0i2D5-zhkbfiVP0TzgDzz02rthK3XDl-hV6pcvrSSzSg/exec";

// Use local JSON file for development
const LOCAL_JSON_URL = "/questions.json";
const USE_LOCAL_JSON = false; // Set to false when Google Apps Script is working

// Use local proxy for development
const LOCAL_PROXY_URL = "http://localhost:3001/api";
const USE_LOCAL_PROXY = false; // Set to false for production

// Mock data for development when API is not available
const USE_MOCK_DATA = false; // Set to false when API is working

const Index = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [communityInformation, setCommunityInformation] = useState<CommunityInfoItem[]>([]);
  const [sectionNames, setSectionNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [hasCompletedPersonalInfo, setHasCompletedPersonalInfo] = useState(false);
  const [showEditInfoDialog, setShowEditInfoDialog] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    date: "",
    contactNumber: "",
    email: "",
    organization: "",
    role: "",
    streetAddress: "",
    city: "",
    county: "",
    stateProvinceRegion: "",
    country: "",
    zipCode: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const isFormValid = () =>
    !!formData.firstName.trim() &&
    !!formData.lastName.trim() &&
    !!formData.date.trim() &&
    !!formData.contactNumber.trim() &&
    !!formData.email.trim() &&
    !!formData.organization.trim() &&
    !!formData.role.trim() &&
    !!formData.streetAddress.trim() &&
    !!formData.city.trim() &&
    !!formData.stateProvinceRegion.trim() &&
    !!formData.country.trim() &&
    !!formData.zipCode.trim();

  const personalInfoForm = (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="firstName">First Name *</Label>
        <Input
          id="firstName"
          value={formData.firstName}
          onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
          placeholder="Enter your first name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lastName">Last Name *</Label>
        <Input
          id="lastName"
          value={formData.lastName}
          onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
          placeholder="Enter your last name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="date">Today&apos;s Date (MM/DD/YYYY) *</Label>
        <Input
          id="date"
          type="text"
          value={formData.date}
          onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
          placeholder="MM/DD/YYYY"
          pattern="\d{2}/\d{2}/\d{4}"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contactNumber">Contact number *</Label>
        <Input
          id="contactNumber"
          value={formData.contactNumber}
          onChange={(e) => setFormData((prev) => ({ ...prev, contactNumber: e.target.value }))}
          placeholder="Enter your contact number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="Enter your email address"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="organization">Organization *</Label>
        <Input
          id="organization"
          value={formData.organization}
          onChange={(e) => setFormData((prev) => ({ ...prev, organization: e.target.value }))}
          placeholder="Enter your organization"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role *</Label>
        <Input
          id="role"
          value={formData.role}
          onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
          placeholder="Enter your role"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="streetAddress">Street Address *</Label>
        <Input
          id="streetAddress"
          value={formData.streetAddress}
          onChange={(e) => setFormData((prev) => ({ ...prev, streetAddress: e.target.value }))}
          placeholder="Enter your street address"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="city">City *</Label>
        <Input
          id="city"
          value={formData.city}
          onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
          placeholder="Enter your city"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="county">County <span className="text-muted-foreground">(optional)</span></Label>
        <Input
          id="county"
          value={formData.county}
          onChange={(e) => setFormData((prev) => ({ ...prev, county: e.target.value }))}
          placeholder="Enter your county"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="stateProvinceRegion">State / Province / Region *</Label>
        <Input
          id="stateProvinceRegion"
          value={formData.stateProvinceRegion}
          onChange={(e) => setFormData((prev) => ({ ...prev, stateProvinceRegion: e.target.value }))}
          placeholder="Enter your state, province, or region"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">Country *</Label>
        <Input
          id="country"
          value={formData.country}
          onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
          placeholder="Enter your country"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="zipCode">Zip Code/Postal Code *</Label>
        <Input
          id="zipCode"
          value={formData.zipCode}
          onChange={(e) => setFormData((prev) => ({ ...prev, zipCode: e.target.value }))}
          placeholder="Enter your zip code or postal code"
        />
      </div>
    </div>
  );

  // Load questions from Google Sheets or mock data
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        console.log("USE_MOCK_DATA:", USE_MOCK_DATA, "USE_LOCAL_JSON:", USE_LOCAL_JSON, "USE_LOCAL_PROXY:", USE_LOCAL_PROXY);
        let data;
        
        if (USE_MOCK_DATA) {
          console.log("Using mock data for development");
          // Use mock data for development
          data = {
            questions: [
              {
                QID: "Q1",
                Question: "What is the current fire danger rating?",
                Section: "Fire Danger Assessment",
                Weight: 1.0,
                Type: "multiple_choice",
                Options: [
                  { value: 0, label: "Low" },
                  { value: 1, label: "Moderate" },
                  { value: 2, label: "High" },
                  { value: 3, label: "Very High" },
                  { value: 4, label: "Extreme" }
                ]
              },
              {
                QID: "Q2", 
                Question: "What is the wind speed?",
                Section: "Weather Conditions",
                Weight: 1.2,
                Type: "multiple_choice",
                Options: [
                  { value: 0, label: "0-5 mph" },
                  { value: 1, label: "6-15 mph" },
                  { value: 2, label: "16-25 mph" },
                  { value: 3, label: "26-40 mph" },
                  { value: 4, label: "40+ mph" }
                ]
              },
              {
                QID: "Q3",
                Question: "What is the relative humidity?",
                Section: "Weather Conditions", 
                Weight: 0.8,
                Type: "multiple_choice",
                Options: [
                  { value: 0, label: "80%+" },
                  { value: 1, label: "60-79%" },
                  { value: 2, label: "40-59%" },
                  { value: 3, label: "20-39%" },
                  { value: 4, label: "Under 20%" }
                ]
              },
              {
                QID: "Q4",
                Question: "What is the fuel moisture content?",
                Section: "Fuel Conditions",
                Weight: 1.5,
                Type: "multiple_choice", 
                Options: [
                  { value: 0, label: "Very High (15%+)" },
                  { value: 1, label: "High (10-14%)" },
                  { value: 2, label: "Moderate (5-9%)" },
                  { value: 3, label: "Low (2-4%)" },
                  { value: 4, label: "Very Low (Under 2%)" }
                ]
              },
              {
                QID: "Q5",
                Question: "What is the terrain slope?",
                Section: "Topography",
                Weight: 1.1,
                Type: "multiple_choice",
                Options: [
                  { value: 0, label: "Flat (0-5%)" },
                  { value: 1, label: "Gentle (6-15%)" },
                  { value: 2, label: "Moderate (16-30%)" },
                  { value: 3, label: "Steep (31-50%)" },
                  { value: 4, label: "Very Steep (50%+)" }
                ]
              }
            ]
          };
        } else if (USE_LOCAL_JSON) {
          console.log("Fetching from local JSON file:", LOCAL_JSON_URL);
          const response = await fetch(LOCAL_JSON_URL);
          data = await response.json();
        } else {
          console.log("Fetching from API:", USE_LOCAL_PROXY ? LOCAL_PROXY_URL : API_URL);
          const response = await fetch(USE_LOCAL_PROXY ? LOCAL_PROXY_URL : API_URL);
          data = await response.json();
        }
        
        if (data.questions) {
          const normalized = (data.questions as RawQuestion[]).map(normalizeQuestion);
          const withSections = carryForwardSections(normalized);
          setQuestions(withSections);

          const initialAnswers: Record<string, Answer> = {};
          withSections.forEach((q) => {
            initialAnswers[q.QID] = {
              qid: q.QID,
              score: 0,
              notes: "",
            };
          });
          setAnswers(initialAnswers);
        }
        const info = Array.isArray(data.communityInformation)
          ? (data.communityInformation as CommunityInfoItem[])
          : [];
        setCommunityInformation(info);
        const names = data.sectionNames && typeof data.sectionNames === "object"
          ? (data.sectionNames as Record<string, string>)
          : {};
        setSectionNames(names);
        setLoading(false);
      } catch (error) {
        console.error("Error loading questions:", error);
        toast({
          title: "Error",
          description: "Failed to load questions. Please check your API URL configuration.",
          variant: "destructive",
        });
        setLoading(false);
      }
    };

    loadQuestions();
  }, [toast]);

  // Group questions by section. Digit before "." in QID = section number (1.1→E1, 2.3→E2).
  const groupedQuestions = useMemo(() => {
    const groups: Record<string, Question[]> = {};
    questions.forEach((q) => {
      const sectionKey = getSectionCodeFromQid(q.QID);
      if (!groups[sectionKey]) {
        groups[sectionKey] = [];
      }
      groups[sectionKey].push(q);
    });
    
    const sortedEntries = Object.entries(groups).sort(([a], [b]) => {
      const aMatch = a.match(/^E(\d+)/i);
      const bMatch = b.match(/^E(\d+)/i);
      if (aMatch && bMatch) {
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      }
      return a.localeCompare(b);
    });
    return Object.fromEntries(sortedEntries);
  }, [questions]);

  // Calculate section scores (key by section code from QID)
  const sectionScores = useMemo((): SectionScore[] => {
    const scores: Record<string, { total: number; count: number }> = {};
    
    (Object.values(answers) as Answer[]).forEach((answer) => {
      const question = questions.find((q) => q.QID === answer.qid);
      if (!question || answer.score === "N/A" || answer.score === 0) return;
      const sectionKey = getSectionCodeFromQid(question.QID);
      if (!scores[sectionKey]) {
        scores[sectionKey] = { total: 0, count: 0 };
      }
      scores[sectionKey].total += typeof answer.score === 'number' ? answer.score : 0;
      scores[sectionKey].count += 1;
    });

    return Object.entries(scores).map(([section, data]) => ({
      section,
      average: data.count > 0 ? data.total / data.count : 0,
      count: data.count,
    }));
  }, [answers, questions]);

  // Calculate overall average
  const overallAverage = useMemo(() => {
    let total = 0;
    let count = 0;
    
    (Object.values(answers) as Answer[]).forEach((answer) => {
      if (answer.score !== "N/A" && typeof answer.score === 'number' && answer.score > 0) {
        total += answer.score;
        count += 1;
      }
    });
    
    return count > 0 ? total / count : 0;
  }, [answers]);

  // Count answered questions
  const totalAnswered = useMemo(() => {
    return (Object.values(answers) as Answer[]).filter(
      (a) => (typeof a.score === "number" && a.score !== 0) || a.score === "N/A"
    ).length;
  }, [answers]);

  const handleAnswerChange = (answer: Answer) => {
    setAnswers((prev) => ({
      ...prev,
      [answer.qid]: answer,
    }));
  };

  const handleContinueToScorecard = () => {
    if (!isFormValid()) {
      toast({
        title: "All Fields Required",
        description: "Please fill in all required fields to continue.",
        variant: "destructive",
      });
      return;
    }
    setHasCompletedPersonalInfo(true);
  };

  const handleSubmitClick = () => {
    handleFinalSubmit();
  };

  const handleFinalSubmit = async () => {
    if (!isFormValid()) {
      toast({
        title: "All Fields Required",
        description: "Please update your information (use Edit my info) and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const respondentId = Math.random().toString(36).substring(2, 9);
      const timestamp = new Date().toISOString();
      
      const responses = (Object.values(answers) as Answer[]).map((answer) => {
        const question = questions.find((q) => q.QID === answer.qid);
        const score = answer.score === "N/A" ? "N/A" : answer.score;
        const weightedScore = score === "N/A" ? "" : (typeof score === 'number' ? score * (question?.Weight || 1) : 0);
        
        return {
          timestamp,
          respondentId,
          firstName: formData.firstName,
          lastName: formData.lastName,
          date: formData.date,
          contactNumber: formData.contactNumber,
          email: formData.email,
          organization: formData.organization,
          role: formData.role,
          streetAddress: formData.streetAddress,
          city: formData.city,
          county: formData.county,
          stateProvinceRegion: formData.stateProvinceRegion,
          country: formData.country,
          zipCode: formData.zipCode,
          section: question?.Section || "",
          qid: answer.qid,
          score,
          notes: answer.notes,
          weight: question?.Weight || 1,
          weightedScore,
          totalScore: overallAverage,
        };
      });

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ responses }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success!",
          description: `Scorecard submitted successfully for ${formData.firstName} ${formData.lastName}.`,
        });
        setFormData({
          firstName: "",
          lastName: "",
          date: "",
          contactNumber: "",
          email: "",
          organization: "",
          role: "",
          streetAddress: "",
          city: "",
          county: "",
          stateProvinceRegion: "",
          country: "",
          zipCode: ""
        });
        setHasCompletedPersonalInfo(false);
        
        const resetAnswers: Record<string, Answer> = {};
        questions.forEach((q) => {
          resetAnswers[q.QID] = {
            qid: q.QID,
            score: 0,
            notes: "",
          };
        });
        setAnswers(resetAnswers);
      } else {
        throw new Error(result.message || "Submission failed");
      }
    } catch (error) {
      console.error("Error submitting:", error);
      toast({
        title: "Submission Error",
        description: "Failed to submit scorecard. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Loading scorecard...</p>
        </div>
      </div>
    );
  }

  // Personal info first — before scorecard
  if (!hasCompletedPersonalInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-[var(--shadow-card)] p-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Community Wildfire Resilience Scorecard
          </h1>
          <p className="text-muted-foreground mb-6">
            Please provide your information to get started.
          </p>
          {personalInfoForm}
          <Button
            onClick={handleContinueToScorecard}
            disabled={!isFormValid()}
            className="w-full mt-2 bg-primary hover:bg-primary-hover"
          >
            Continue to Scorecard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-card border-b border-border shadow-[var(--shadow-card)] sticky top-0 z-40">
        <div className="container max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Community Wildfire Resilience Scorecard
              </h1>
              <p className="text-muted-foreground mt-2">
                Assess your community&apos;s preparedness for wildfire events
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditInfoDialog(true)}
              className="shrink-0"
            >
              Edit my info
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {Object.entries(groupedQuestions).map(([section, sectionQuestions]: [string, Question[]]) => {
            const sectionScore = sectionScores.find((s) => s.section === section);
            const sectionName = sectionNames[section] || SECTION_NAMES[section] || section;
            return (
              <div key={section} className="space-y-0">
                <SectionHeader
                  section={section}
                  sectionName={sectionName}
                  average={sectionScore?.average}
                  questionCount={sectionQuestions.length}
                />
                <div className="space-y-4 bg-card border-x border-b border-border rounded-b-lg p-6">
                  {sectionQuestions.map((question) => (
                    <QuestionCard
                      key={question.QID}
                      question={question}
                      answer={answers[question.QID]}
                      onAnswerChange={handleAnswerChange}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <ScoreFooter
        overallAverage={overallAverage}
        totalAnswered={totalAnswered}
        totalQuestions={questions.length}
        onSubmit={handleSubmitClick}
        isSubmitting={isSubmitting}
      />

      <Dialog open={showEditInfoDialog} onOpenChange={setShowEditInfoDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit my info</DialogTitle>
            <DialogDescription>
              Update your contact information. Changes apply when you submit.
            </DialogDescription>
          </DialogHeader>
          {personalInfoForm}
          {communityInformation.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground">Community Information</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {communityInformation.map((item, idx) => {
                  const { q, a } = getCommunityInfoQA(item);
                  if (!q && !a) return null;
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
                    >
                      {q && <p className="font-medium text-foreground mb-1">{q}</p>}
                      {a && (
                        <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                          {a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="outline" onClick={() => setShowEditInfoDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!isFormValid()) {
                  toast({
                    title: "All Fields Required",
                    description: "Please fill in all required fields.",
                    variant: "destructive",
                  });
                  return;
                }
                setShowEditInfoDialog(false);
              }}
              disabled={!isFormValid()}
              className="bg-primary hover:bg-primary-hover"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
