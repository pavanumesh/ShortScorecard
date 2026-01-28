import { useState, useEffect, useMemo } from "react";
import { Question, Answer, SectionScore, CommunityInfoItem } from "@/types/scorecard";
import QuestionCard from "@/components/QuestionCard";
import SectionHeader from "@/components/SectionHeader";
import ScoreFooter from "@/components/ScoreFooter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import {
  getAllCountries,
  getStatesForCountry,
  getCitiesForState,
  validateZipCode,
  getZipCodePlaceholder,
  countryCodes,
  zipCodePatterns,
} from "@/data/locationData";

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
    selectedDate: undefined as Date | undefined,
    contactNumber: "",
    phoneCountryCode: "+1",
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
  const [dateError, setDateError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const { toast } = useToast();

  // Get available states and cities based on selected country
  const availableStates = useMemo(() => {
    if (!formData.country) return [];
    return getStatesForCountry(formData.country);
  }, [formData.country]);

  const availableCities = useMemo(() => {
    if (!formData.country || !formData.stateProvinceRegion) return [];
    return getCitiesForState(formData.country, formData.stateProvinceRegion);
  }, [formData.country, formData.stateProvinceRegion]);

  // Validate date is today
  const isToday = (date: Date | undefined): boolean => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      if (!isToday(date)) {
        setDateError("Please select today's date");
        return;
      }
      setDateError("");
      setFormData((prev) => ({
        ...prev,
        selectedDate: date,
        date: format(date, "MM/dd/yyyy"),
      }));
    }
  };

  // Handle phone number input (numbers only)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // Remove non-digits
    setFormData((prev) => ({ ...prev, contactNumber: value }));
  };

  // Handle country change - reset state and city
  const handleCountryChange = (countryCode: string) => {
    setFormData((prev) => ({
      ...prev,
      country: countryCode,
      stateProvinceRegion: "",
      city: "",
      zipCode: "",
    }));
  };

  // Handle state change - reset city
  const handleStateChange = (state: string) => {
    setFormData((prev) => ({
      ...prev,
      stateProvinceRegion: state,
      city: "",
    }));
  };

  // Handle zip code change with validation
  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, zipCode: value }));
  };

  const isFormValid = () =>
    !!formData.firstName.trim() &&
    !!formData.lastName.trim() &&
    !!formData.date.trim() &&
    !dateError &&
    !!formData.contactNumber.trim() &&
    !!formData.email.trim() &&
    !!formData.organization.trim() &&
    !!formData.role.trim() &&
    !!formData.streetAddress.trim() &&
    !!formData.city.trim() &&
    !!formData.stateProvinceRegion.trim() &&
    !!formData.country.trim() &&
    !!formData.zipCode.trim() &&
    validateZipCode(formData.zipCode, formData.country);

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
        <Label htmlFor="date">Today&apos;s Date *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant="outline"
              className={`w-full justify-start text-left font-normal ${!formData.selectedDate ? "text-muted-foreground" : ""}`}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.selectedDate ? format(formData.selectedDate, "MM/dd/yyyy") : "Select today's date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={formData.selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => !isToday(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {dateError && <p className="text-sm text-destructive">{dateError}</p>}
        {formData.selectedDate && !isToday(formData.selectedDate) && (
          <p className="text-sm text-destructive">Please select today's date</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="contactNumber">Contact number *</Label>
        <div className="flex gap-2">
          <Select
            value={formData.phoneCountryCode}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, phoneCountryCode: value }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {countryCodes.map((cc) => (
                <SelectItem key={cc.code} value={cc.code}>
                  {cc.flag} {cc.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id="contactNumber"
            type="tel"
            value={formData.contactNumber}
            onChange={handlePhoneChange}
            placeholder="Enter phone number (numbers only)"
            className="flex-1"
          />
        </div>
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
        <Label htmlFor="country">Country *</Label>
        <Select value={formData.country} onValueChange={handleCountryChange}>
          <SelectTrigger id="country">
            <SelectValue placeholder="Select your country" />
          </SelectTrigger>
          <SelectContent>
            {getAllCountries().map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {formData.country && availableStates.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="stateProvinceRegion">State / Province / Region *</Label>
          <Select value={formData.stateProvinceRegion} onValueChange={handleStateChange}>
            <SelectTrigger id="stateProvinceRegion">
              <SelectValue placeholder="Select state/province/region" />
            </SelectTrigger>
            <SelectContent>
              {availableStates.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {formData.country && formData.stateProvinceRegion && availableCities.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="city">City *</Label>
          <Select
            value={formData.city}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, city: value }))}
          >
            <SelectTrigger id="city">
              <SelectValue placeholder="Select your city" />
            </SelectTrigger>
            <SelectContent>
              {availableCities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {formData.country && !availableCities.length && (
        <div className="space-y-2">
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
            placeholder="Enter your city"
          />
        </div>
      )}
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
        <Label htmlFor="zipCode">
          {formData.country && zipCodePatterns[formData.country]
            ? `${zipCodePatterns[formData.country].name} *`
            : "Zip Code/Postal Code *"}
        </Label>
        <Input
          id="zipCode"
          value={formData.zipCode}
          onChange={handleZipCodeChange}
          placeholder={formData.country ? getZipCodePlaceholder(formData.country) : "Enter your zip code or postal code"}
          className={formData.zipCode && formData.country && !validateZipCode(formData.zipCode, formData.country) ? "border-destructive" : ""}
        />
        {formData.zipCode && formData.country && !validateZipCode(formData.zipCode, formData.country) && (
          <p className="text-sm text-destructive">
            Invalid format. {formData.country && zipCodePatterns[formData.country]?.example && `Example: ${zipCodePatterns[formData.country].example}`}
          </p>
        )}
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
              score: undefined,
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
      if (!question || answer.score === "N/A" || answer.score === undefined) return;
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
      if (answer.score !== "N/A" && typeof answer.score === 'number' && answer.score !== undefined) {
        total += answer.score;
        count += 1;
      }
    });
    
    return count > 0 ? total / count : 0;
  }, [answers]);

  // Count answered questions
  const totalAnswered = useMemo(() => {
    return (Object.values(answers) as Answer[]).filter(
      (a) => (typeof a.score === "number" && a.score !== undefined) || a.score === "N/A"
    ).length;
  }, [answers]);

  // Calculate section ranges and prepare review data
  const reviewData = useMemo(() => {
    const sectionData: Record<string, { scores: number[]; sectionName: string }> = {};
    
    // Collect all scores per section
    (Object.values(answers) as Answer[]).forEach((answer) => {
      const question = questions.find((q) => q.QID === answer.qid);
      if (!question || answer.score === "N/A" || answer.score === undefined || typeof answer.score !== 'number') return;
      
      const sectionKey = getSectionCodeFromQid(question.QID);
      if (!sectionData[sectionKey]) {
        sectionData[sectionKey] = {
          scores: [],
          sectionName: sectionNames[sectionKey] || SECTION_NAMES[sectionKey] || sectionKey,
        };
      }
      sectionData[sectionKey].scores.push(answer.score);
    });

    // Calculate stats for each section
    const reviewSections = Object.entries(sectionData)
      .map(([section, data]) => {
        const scores = data.scores;
        const min = scores.length > 0 ? Math.min(...scores) : 0;
        const max = scores.length > 0 ? Math.max(...scores) : 0;
        const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        
        return {
          section,
          sectionName: data.sectionName,
          average: Number(average.toFixed(2)),
          min,
          max,
          range: `${min} - ${max}`,
        };
      })
      .sort((a, b) => {
        const aNum = parseInt(a.section.replace('E', '')) || 0;
        const bNum = parseInt(b.section.replace('E', '')) || 0;
        return aNum - bNum;
      });

    return reviewSections;
  }, [answers, questions, sectionNames]);

  const handleAnswerChange = (answer: Answer) => {
    setAnswers((prev) => ({
      ...prev,
      [answer.qid]: answer,
    }));
  };

  const handleContinueToScorecard = () => {
    if (!isFormValid()) {
      let errorMsg = "Please fill in all required fields to continue.";
      if (dateError || (formData.selectedDate && !isToday(formData.selectedDate))) {
        errorMsg = "Please select today's date.";
      } else if (formData.zipCode && formData.country && !validateZipCode(formData.zipCode, formData.country)) {
        errorMsg = "Please enter a valid zip/postal code.";
      }
      toast({
        title: "All Fields Required",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }
    setHasCompletedPersonalInfo(true);
  };

  const handleSubmitClick = () => {
    setShowReviewDialog(true);
  };

  const handleConfirmSubmit = () => {
    setShowReviewDialog(false);
    handleFinalSubmit();
  };

  const handleExportToSpreadsheet = () => {
    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Personal Info and Community Information
      const personalInfoData = [
        ["Field", "Value"],
        ["First Name", formData.firstName],
        ["Last Name", formData.lastName],
        ["Date", formData.date],
        ["Contact Number", formData.contactNumber],
        ["Email", formData.email],
        ["Organization", formData.organization],
        ["Role", formData.role],
        ["Street Address", formData.streetAddress],
        ["City", formData.city],
        ["County", formData.county || ""],
        ["State / Province / Region", formData.stateProvinceRegion],
        ["Country", formData.country],
        ["Zip Code / Postal Code", formData.zipCode],
      ];

      // Add community information questions and answers
      if (communityInformation.length > 0) {
        personalInfoData.push([]); // Empty row separator
        personalInfoData.push(["Community Information"]);
        personalInfoData.push(["Question", "Answer"]);
        
        communityInformation.forEach((item) => {
          const { q, a } = getCommunityInfoQA(item);
          if (q || a) {
            personalInfoData.push([q || "", a || ""]);
          }
        });
      }

      const personalInfoSheet = XLSX.utils.aoa_to_sheet(personalInfoData);
      XLSX.utils.book_append_sheet(workbook, personalInfoSheet, "My Info");

      // Sheet 2: Questions, Scores, and Comments
      const questionsData = [
        ["Question Number", "Section", "Question", "Score", "Comments"],
      ];

      // Sort questions by QID to maintain order
      const sortedQuestions = [...questions].sort((a, b) => {
        const aNum = parseFloat(a.QID) || 0;
        const bNum = parseFloat(b.QID) || 0;
        return aNum - bNum;
      });

      sortedQuestions.forEach((question) => {
        const answer = answers[question.QID];
        const score = answer?.score === "N/A" ? "N/A" : (answer?.score !== undefined ? String(answer.score) : "");
        const comments = answer?.notes || "";
        
        questionsData.push([
          question.QID,
          question.Section,
          question.Question,
          score,
          comments,
        ]);
      });

      const questionsSheet = XLSX.utils.aoa_to_sheet(questionsData);
      XLSX.utils.book_append_sheet(workbook, questionsSheet, "Questions & Scores");

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
      const filename = `Scorecard_${formData.firstName}_${formData.lastName}_${timestamp}.xlsx`;

      // Write the file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export Successful",
        description: `Spreadsheet saved as ${filename}`,
      });
    } catch (error) {
      console.error("Error exporting to spreadsheet:", error);
      toast({
        title: "Export Error",
        description: "Failed to export spreadsheet. Please try again.",
        variant: "destructive",
      });
    }
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
        // Handle score: keep N/A as string, convert undefined to empty string, keep numbers as-is
        const score = answer.score === "N/A" 
          ? "N/A" 
          : (answer.score === undefined || answer.score === null) 
            ? "" 
            : answer.score;
        const weightedScore = (score === "N/A" || score === "" || score === null || score === undefined)
          ? "" 
          : (typeof score === 'number' ? score * (question?.Weight || 1) : 0);
        
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
          county: formData.county || "",
          stateProvinceRegion: formData.stateProvinceRegion,
          country: formData.country,
          zipCode: formData.zipCode,
          section: question?.Section || "",
          qid: answer.qid,
          score: score === "" ? null : score,
          notes: answer.notes || "",
          weight: question?.Weight || 1,
          weightedScore: weightedScore === "" ? null : weightedScore,
          totalScore: overallAverage,
        };
      });

      // Google Apps Script Web Apps have CORS restrictions with JSON POST
      // Try JSON first, if that fails due to CORS, use no-cors mode
      let submissionSuccess = false;
      let result: any = null;

      try {
        // First try with normal CORS mode
        const response = await fetch(API_URL, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ responses }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Response error:", response.status, errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        result = await response.json();
        console.log("Submission result:", result);
        submissionSuccess = result.success !== false; // Assume success unless explicitly false
      } catch (error: any) {
        console.error("CORS/Network error:", error);
        
        // If CORS blocks the request, try with no-cors mode
        // Note: With no-cors, we can't read the response, but the request may still succeed
        if (error.message?.includes("fetch") || error.name === "TypeError") {
          console.log("Attempting submission with no-cors mode...");
          try {
            await fetch(API_URL, {
              method: "POST",
              mode: "no-cors",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ responses }),
            });
            
            // With no-cors, we can't verify success, but assume it worked
            // Google Apps Script often accepts the POST but blocks reading the response
            submissionSuccess = true;
            console.log("Request sent with no-cors mode (assuming success - response not readable)");
          } catch (noCorsError) {
            console.error("No-cors also failed:", noCorsError);
            throw new Error("Failed to submit: Network or CORS error. Please check your internet connection and try again.");
          }
        } else {
          throw error; // Re-throw if it's not a CORS/network error
        }
      }

      if (submissionSuccess) {
        // Export to Excel before resetting form data
        handleExportToSpreadsheet();
        
        toast({
          title: "Success!",
          description: `Scorecard submitted successfully for ${formData.firstName} ${formData.lastName}. Excel file downloaded.`,
        });
        setFormData({
          firstName: "",
          lastName: "",
          date: "",
          selectedDate: undefined,
          contactNumber: "",
          phoneCountryCode: "+1",
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
        setDateError("");
        setHasCompletedPersonalInfo(false);
        
        const resetAnswers: Record<string, Answer> = {};
        questions.forEach((q) => {
          resetAnswers[q.QID] = {
            qid: q.QID,
            score: undefined,
            notes: "",
          };
        });
        setAnswers(resetAnswers);
      } else {
        throw new Error(result.message || "Submission failed");
      }
    } catch (error) {
      console.error("Error submitting:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Submission Error",
        description: `Failed to submit scorecard: ${errorMessage}. Please check the console for details.`,
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

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Scorecard Summary</DialogTitle>
            <DialogDescription>
              Review your scores before submitting. You can go back to make changes or confirm to submit.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead className="text-right">Section Average</TableHead>
                    <TableHead className="text-right">Section Range</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewData.length > 0 ? (
                    reviewData.map((item, index) => (
                      <TableRow key={item.section}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>{item.sectionName}</TableCell>
                        <TableCell className="text-right font-semibold">{item.average.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.range}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No scores available. Please answer some questions before submitting.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {reviewData.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="font-bold text-lg">
                        Total Average Score
                      </TableCell>
                      <TableCell colSpan={2} className="text-right font-bold text-lg text-primary">
                        {overallAverage.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>

            {/* Radar Chart */}
            {reviewData.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Section Performance Radar Chart</h3>
                <ChartContainer
                  config={{
                    score: {
                      label: "Score",
                      color: "hsl(var(--chart-1))",
                    },
                  }}
                  className="h-[400px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={reviewData.map(item => ({
                      section: item.sectionName.length > 15 
                        ? item.sectionName.substring(0, 15) + "..." 
                        : item.sectionName,
                      fullSectionName: item.sectionName,
                      score: item.average,
                      fullMark: 4,
                    }))}>
                      <PolarGrid />
                      <PolarAngleAxis 
                        dataKey="section" 
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <PolarRadiusAxis 
                        angle={90} 
                        domain={[0, 4]} 
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <Radar
                        name="Score"
                        dataKey="score"
                        stroke="hsl(var(--chart-1))"
                        fill="hsl(var(--chart-1))"
                        fillOpacity={0.6}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        formatter={(value: any, name: string, props: any) => [
                          `${value.toFixed(2)} (${props.payload.fullSectionName})`,
                          "Score"
                        ]}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Go Back
            </Button>
            <Button
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary-hover"
            >
              {isSubmitting ? "Submitting..." : "Confirm & Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
