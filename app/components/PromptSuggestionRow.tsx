import PromptSuggestionButton from "./PromptSuggestionButton";

interface PromptSuggestionRowProps {
    suggestions: string[];
    onSuggestionClick: (suggestion: string) => void;
}

export default function PromptSuggestionRow({ suggestions, onSuggestionClick }: PromptSuggestionRowProps) {
  return (
    <div className="prompt-suggestion-row">
      {suggestions.map((prompt, index) => (
        <PromptSuggestionButton key={`suggestion-${index}`} text={prompt} onClick={() => onSuggestionClick(prompt)} />
      ))}
    </div>
  );
}
