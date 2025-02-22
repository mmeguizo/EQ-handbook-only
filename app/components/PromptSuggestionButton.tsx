interface PromptSuggestionButtonProps {
    suggestion: string;
    onSuggestionClick: (suggestion: string) => void;
    className?: string;
}

export default function PromptSuggestionButton({ 
    suggestion, 
    onSuggestionClick, 
    className = '' 
}: PromptSuggestionButtonProps) {
    return (
        <button 
            onClick={() => onSuggestionClick(suggestion)} 
            className={`prompt-suggestion-button ${className}`}
        >
            {suggestion}
        </button>
    );
}


/*
  <div className="prompt-suggestion-button">
      <span>PromptSuggestionButton</span>
    </div>
*/