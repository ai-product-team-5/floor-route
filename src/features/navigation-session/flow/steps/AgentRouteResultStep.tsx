import { RefreshCw, Save } from 'lucide-react';

type AgentRouteResultStepProps = {
  imageUrl: string;
  destinationText: string;
  isSaved: boolean;
  onSave: () => void;
  onRevise: () => void;
  onReset: () => void;
};

export function AgentRouteResultStep({
  imageUrl,
  destinationText,
  isSaved,
  onSave,
  onRevise,
  onReset,
}: AgentRouteResultStepProps) {
  return (
    <section className="agent-stage">
      <div>
        <p className="section-kicker">路径结果</p>
        <h2>{destinationText}</h2>
      </div>

      <div className="agent-map-frame result">
        <img src={imageUrl} alt="带路径标注的平面图" />
      </div>

      <button type="button" className="primary-button full-width" disabled={isSaved} onClick={onSave}>
        <Save aria-hidden="true" size={19} />
        {isSaved ? '已保存到历史' : '保存到历史'}
      </button>
      <button type="button" className="secondary-button full-width" onClick={onRevise}>
        <RefreshCw aria-hidden="true" size={18} />
        换个目的地
      </button>
      <button type="button" className="ghost-button full-width" onClick={onReset}>
        重新拍摄平面图
      </button>
    </section>
  );
}
