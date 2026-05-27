import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const APP_VERSION = '0.1.0';

export function UpdatePage() {
  const navigate = useNavigate();

  return (
    <div className="update-page">
      <header className="update-header">
        <button type="button" className="update-back-button" onClick={() => navigate('/account')} aria-label="返回">
          <ArrowLeft aria-hidden="true" size={24} />
        </button>
        <h1>更新</h1>
      </header>

      <section className="update-content">
        <div className="update-status">
          <CheckCircle aria-hidden="true" size={48} />
          <p className="update-version">当前版本 v{APP_VERSION}</p>
          <p className="update-message">已是最新版本</p>
        </div>
      </section>
    </div>
  );
}
