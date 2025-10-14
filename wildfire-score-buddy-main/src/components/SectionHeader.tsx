interface SectionHeaderProps {
  section: string;
  average?: number;
  questionCount?: number;
}

const SectionHeader = ({ section, average, questionCount }: SectionHeaderProps) => {
  return (
    <div className="bg-primary text-primary-foreground rounded-lg px-6 py-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{section}</h2>
        {average !== undefined && questionCount !== undefined && (
          <div className="flex items-center gap-4 text-sm">
            <span className="opacity-90">
              {questionCount} question{questionCount !== 1 ? "s" : ""}
            </span>
            <div className="bg-primary-foreground/20 px-3 py-1 rounded-full font-medium">
              Avg: {average.toFixed(1)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SectionHeader;
