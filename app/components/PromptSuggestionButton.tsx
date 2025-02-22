export default function PromptSuggestionButton({ text, onClick } : { text: string, onClick: any}) {
  return (
    <button onClick={onClick} className="prompt-suggestion-button">{text}</button>
  );
}


/*
  <div className="prompt-suggestion-button">
      <span>PromptSuggestionButton</span>
    </div>
*/