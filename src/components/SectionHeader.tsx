interface SectionHeaderProps {
  section: string;
  sectionName?: string;
  average?: number;
  questionCount?: number;
}

const SectionHeader = ({ section, sectionName, average, questionCount }: SectionHeaderProps) => {
  const displayName = (sectionName || section || "").trim() || "Section";
  
  return (
    <div className="bg-primary text-primary-foreground rounded-t-lg px-6 py-4 shadow-[var(--shadow-card)] border-b-2 border-primary-foreground/20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">{displayName}</h2>
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
