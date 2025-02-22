import PromptSuggestionButton from "./PromptSuggestionButton";

interface PromptSuggestionRowProps {
    onPromptClick: (prompt: string) => void;
}

const DEFAULT_PROMPTS = [
    "What is the purpose of the Elders Quorum?",
    "What is the purpose of the Aaronic Priesthood?",
    "What is the purpose of the Melchizedek Priesthood?",
];

export default function PromptSuggestionRow({ onPromptClick }: PromptSuggestionRowProps) {
    return (
        <div className="prompt-suggestion-row">
            {DEFAULT_PROMPTS.map((prompt, index) => (
                <PromptSuggestionButton 
                    key={`suggestion-${index}`}
                    suggestion={prompt}
                    onSuggestionClick={onPromptClick}
                    className=""
                />
            ))}
        </div>
    );
}
