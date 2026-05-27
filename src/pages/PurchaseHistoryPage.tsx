import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PurchaseHistoryPage() {
  const navigate = useNavigate();

  return (
    <div className="purchase-history-page">
      <header className="purchase-history-header">
        <button type="button" className="purchase-history-back-button" onClick={() => navigate('/account')} aria-label="返回">
          <ArrowLeft aria-hidden="true" size={24} />
        </button>
        <h1>购买记录</h1>
      </header>

      <section className="purchase-history-content">
        <p className="purchase-history-empty">暂无记录</p>
      </section>
    </div>
  );
}
