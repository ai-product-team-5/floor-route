import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const faqItems = [
  {
    question: '方寸识途是什么？',
    answer: '方寸识途是一款室内平面图导航 App。拍摄墙面导览牌后，App 会自动识别平面图并帮你规划到目的地的路线。',
  },
  {
    question: '如何获取 API Key？',
    answer: '请联系项目团队获取 API Key。拿到后在"我的"页面输入并保存即可使用。',
  },
  {
    question: '算力是什么？',
    answer: '每次使用 AI 功能（识别边框、搜索目的地、生成路线）会消耗 1 点算力。算力用完后需要联系团队充值。',
  },
  {
    question: '为什么边框识别不准？',
    answer: '如果自动识别的边框不准确，可以手动拖动四个角点进行调整。光线充足、正面拍摄效果更好。',
  },
  {
    question: '支持哪些类型的平面图？',
    answer: '支持室内导览图、疏散图、楼层地图等矩形标牌。手绘地图或非矩形标识暂不支持。',
  },
  {
    question: '生成的路线准确吗？',
    answer: '路线由 AI 模型生成，会尽量沿走廊和通道规划，但不保证 100% 准确。建议结合实际环境参考使用。',
  },
];

const ISSUES_URL = 'https://github.com/ai-product-team-5/floor-route/issues';

export function HelpPage() {
  const navigate = useNavigate();

  return (
    <div className="help-page">
      <header className="help-header">
        <button type="button" className="help-back-button" onClick={() => navigate('/account')} aria-label="返回">
          <ArrowLeft aria-hidden="true" size={24} />
        </button>
        <h1>帮助与反馈</h1>
      </header>

      <section className="help-faq-section">
        <h2>常见问题</h2>
        <div className="help-faq-list">
          {faqItems.map((item, index) => (
            <details key={index} className="help-faq-item">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="help-feedback-section">
        <h2>反馈与建议</h2>
        <p>如果你遇到问题或有改进建议，欢迎在 GitHub Issues 中提交。</p>
        <a
          href={ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="help-issues-link"
        >
          <ExternalLink aria-hidden="true" size={18} />
          前往 GitHub Issues
        </a>
      </section>
    </div>
  );
}
