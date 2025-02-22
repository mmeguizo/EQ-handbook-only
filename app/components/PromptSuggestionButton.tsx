interface PromptSuggestionButtonProps {
    suggestion: string;
    onClick: (suggestion: string) => void;
    className?: string;
}

export default function PromptSuggestionButton({ suggestion, onClick, className = '' }: PromptSuggestionButtonProps) {
  return (
    <button onClick={() => onClick(suggestion)} className={`prompt-suggestion-button ${className}`}>{suggestion}</button>
  );
}


/*
  <div className="prompt-suggestion-button">
      <span>PromptSuggestionButton</span>
    </div>
*/