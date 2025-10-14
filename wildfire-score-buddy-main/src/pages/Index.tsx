import { useState, useEffect, useMemo } from "react";
import { Question, Answer, SectionScore } from "@/types/scorecard";
import QuestionCard from "@/components/QuestionCard";
import SectionHeader from "@/components/SectionHeader";
import ScoreFooter from "@/components/ScoreFooter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Replace with your Google Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbzXRr0MObiB8xHGmmLEmfD95rKJ2oWMNNMl_s776JIq3DGJK8t1aNqNWfSAceymhkubHg/exec";

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
  const [loading, setLoading] = useState(true);
  const [showCommunityDialog, setShowCommunityDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    number: "",
    email: "",
    occupation: "",
    address: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

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
          setQuestions(data.questions);
          
          // Initialize answers
          const initialAnswers: Record<string, Answer> = {};
          data.questions.forEach((q: Question) => {
            initialAnswers[q.QID] = {
              qid: q.QID,
              score: 0,
              notes: "",
            };
          });
          setAnswers(initialAnswers);
        }
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

  // Group questions by section
  const groupedQuestions = useMemo(() => {
    const groups: Record<string, Question[]> = {};
    questions.forEach((q) => {
      if (!groups[q.Section]) {
        groups[q.Section] = [];
      }
      groups[q.Section].push(q);
    });
    return groups;
  }, [questions]);

  // Calculate section scores
  const sectionScores = useMemo((): SectionScore[] => {
    const scores: Record<string, { total: number; count: number }> = {};
    
    (Object.values(answers) as Answer[]).forEach((answer) => {
      const question = questions.find((q) => q.QID === answer.qid);
      if (!question || answer.score === "N/A" || answer.score === 0) return;
      
      if (!scores[question.Section]) {
        scores[question.Section] = { total: 0, count: 0 };
      }
      
      scores[question.Section].total += typeof answer.score === 'number' ? answer.score : 0;
      scores[question.Section].count += 1;
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

  const handleSubmitClick = () => {
    setShowCommunityDialog(true);
  };

  const handleFinalSubmit = async () => {
    if (!formData.name.trim() || !formData.number.trim() || !formData.email.trim() || !formData.occupation.trim() || !formData.address.trim()) {
      toast({
        title: "All Fields Required",
        description: "Please fill in all required fields before submitting.",
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
          name: formData.name,
          number: formData.number,
          email: formData.email,
          occupation: formData.occupation,
          address: formData.address,
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
          description: `Scorecard submitted successfully for ${formData.name}.`,
        });
        setShowCommunityDialog(false);
        setFormData({
          name: "",
          number: "",
          email: "",
          occupation: "",
          address: ""
        });
        
        // Reset form
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

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-card border-b border-border shadow-[var(--shadow-card)] sticky top-0 z-40">
        <div className="container max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-foreground">
            Community Wildfire Resilience Scorecard
          </h1>
          <p className="text-muted-foreground mt-2">
            Assess your community's preparedness for wildfire events
          </p>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {Object.entries(groupedQuestions).map(([section, sectionQuestions]: [string, Question[]]) => {
            const sectionScore = sectionScores.find((s) => s.section === section);
            
            return (
              <div key={section} className="space-y-4">
                <SectionHeader
                  section={section}
                  average={sectionScore?.average}
                  questionCount={sectionQuestions.length}
                />
                
                <div className="space-y-4">
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

      <Dialog open={showCommunityDialog} onOpenChange={setShowCommunityDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Scorecard</DialogTitle>
            <DialogDescription>
              Please provide your contact information to complete the submission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="number">Phone Number *</Label>
              <Input
                id="number"
                value={formData.number}
                onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                placeholder="Enter your phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter your email address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="occupation">Occupation *</Label>
              <Input
                id="occupation"
                value={formData.occupation}
                onChange={(e) => setFormData(prev => ({ ...prev, occupation: e.target.value }))}
                placeholder="Enter your occupation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter your address"
              />
            </div>
            <div className="bg-accent p-4 rounded-lg">
              <p className="text-sm text-accent-foreground">
                <strong>Overall Average Score:</strong> {overallAverage.toFixed(2)}
              </p>
              <p className="text-sm text-accent-foreground mt-1">
                <strong>Questions Answered:</strong> {totalAnswered} / {questions.length}
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowCommunityDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFinalSubmit}
              disabled={isSubmitting || !formData.name.trim() || !formData.number.trim() || !formData.email.trim() || !formData.occupation.trim() || !formData.address.trim()}
              className="bg-primary hover:bg-primary-hover"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
