import { Button } from "@/components/ui/button";

interface ScoreFooterProps {
  overallAverage: number;
  totalAnswered: number;
  totalQuestions: number;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

const ScoreFooter = ({
  overallAverage,
  totalAnswered,
  totalQuestions,
  onSubmit,
  isSubmitting = false,
}: ScoreFooterProps) => {
  const isComplete = totalAnswered === totalQuestions;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-[var(--shadow-elevated)] z-50">
      <div className="container max-w-5xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Overall Average</p>
              <p className="text-2xl font-bold text-primary">
                {totalAnswered > 0 ? overallAverage.toFixed(2) : "--"}
              </p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div>
              <p className="text-sm text-muted-foreground">Progress</p>
              <p className="text-lg font-semibold text-foreground">
                {totalAnswered} / {totalQuestions}
              </p>
            </div>
          </div>

          <Button
            onClick={onSubmit}
            disabled={!isComplete || isSubmitting}
            size="lg"
            className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold px-8"
          >
            {isSubmitting ? "Submitting..." : "Submit Scorecard"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ScoreFooter;
