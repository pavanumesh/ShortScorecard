import { useState } from "react";
import { Question, Answer } from "@/types/scorecard";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info } from "lucide-react";

interface QuestionCardProps {
  question: Question;
  answer: Answer;
  onAnswerChange: (answer: Answer) => void;
}

const QuestionCard = ({ question, answer, onAnswerChange }: QuestionCardProps) => {
  const [showInfo, setShowInfo] = useState(false);

  const handleScoreChange = (value: string) => {
    onAnswerChange({
      ...answer,
      score: value === "N/A" ? "N/A" : parseInt(value),
    });
  };

  const handleNotesChange = (notes: string) => {
    onAnswerChange({
      ...answer,
      notes,
    });
  };

  const scaleOptions = [
    { value: "0", label: question.Scale0 },
    { value: "1", label: question.Scale1 },
    { value: "2", label: question.Scale2 },
    { value: "3", label: question.Scale3 },
    { value: "4", label: question.Scale4 },
  ];

  if (question.AllowNA === "TRUE") {
    scaleOptions.push({ value: "N/A", label: "N/A - Not Applicable" });
  }

  return (
    <Card className="p-6 bg-card hover:shadow-[var(--shadow-elevated)] transition-shadow">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <Label className="text-base font-medium text-card-foreground leading-relaxed">
              {question.Question}
            </Label>
          </div>
          {question.Tooltip && (
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="shrink-0 p-2 rounded-full hover:bg-accent transition-colors"
              aria-label="More information"
            >
              <Info className="w-5 h-5 text-primary" />
            </button>
          )}
        </div>

        {showInfo && question.Tooltip && (
          <div className="bg-accent p-4 rounded-lg border border-border">
            <p className="text-sm text-accent-foreground">{question.Tooltip}</p>
          </div>
        )}

        <div className="space-y-3">
          <Label htmlFor={`score-${question.QID}`} className="text-sm text-muted-foreground">
            Score
          </Label>
          <Select
            value={answer.score === "N/A" ? "N/A" : answer.score?.toString()}
            onValueChange={handleScoreChange}
          >
            <SelectTrigger id={`score-${question.QID}`} className="w-full">
              <SelectValue placeholder="Select a score..." />
            </SelectTrigger>
            <SelectContent>
              {scaleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.value} - {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label htmlFor={`notes-${question.QID}`} className="text-sm text-muted-foreground">
            Notes (optional)
          </Label>
          <Textarea
            id={`notes-${question.QID}`}
            value={answer.notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add any additional comments or context..."
            className="resize-none min-h-[80px]"
          />
        </div>
      </div>
    </Card>
  );
};

export default QuestionCard;
