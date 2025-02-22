import PromptSuggestionButton from "./PromptSuggestionButton";

export default function PromptSuggestionRow({onPromptClick} : {onPromptClick: any}) {
  const prompts = [
    "What is the purpose of the Elders Quorum?",
    "What is the purpose of the Aaronic Priesthood?",
    "What is the purpose of the Melchizedek Priesthood?",
   
  ]
  return (
    <div className="prompt-suggestion-row">
      {prompts.map((prompt, index) => (
        <PromptSuggestionButton key={`suggestion-${index}`} text={prompt} onClick={() => onPromptClick(prompt)} />
      ))}
    </div>
  );
}
