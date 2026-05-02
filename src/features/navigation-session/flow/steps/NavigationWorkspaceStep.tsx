import { Loader2, SendHorizontal } from 'lucide-react';

type NavigationWorkspaceBottom =
  | {
      type: 'status';
      label: string;
    }
  | {
      type: 'input';
      promptText: string;
      placeholder: string;
      disabled?: boolean;
      onPromptChange: (value: string) => void;
      onSubmit: () => void;
    };

type NavigationWorkspaceStepProps = {
  imageUrl: string;
  bottom: NavigationWorkspaceBottom;
};

export function NavigationWorkspaceStep({
  imageUrl,
  bottom,
}: NavigationWorkspaceStepProps) {
  return (
    <section className="agent-workspace">
      <div className="agent-workspace-map">
        <img src={imageUrl} alt="已选择的平面图" />
      </div>

      {bottom.type === 'status' ? (
        <div className="agent-bottom-status" aria-live="polite">
          <Loader2 aria-hidden="true" size={22} className="spin-icon" />
          <span>{bottom.label}</span>
        </div>
      ) : (
        <form
          className="agent-input-bar"
          onSubmit={(event) => {
            event.preventDefault();
            bottom.onSubmit();
          }}
        >
          <input
            value={bottom.promptText}
            disabled={bottom.disabled}
            placeholder={bottom.placeholder}
            onChange={(event) => bottom.onPromptChange(event.target.value)}
          />
          <button
            type="submit"
            disabled={bottom.disabled || !bottom.promptText.trim()}
            aria-label="发送"
          >
            <SendHorizontal aria-hidden="true" size={19} />
          </button>
        </form>
      )}
    </section>
  );
}
