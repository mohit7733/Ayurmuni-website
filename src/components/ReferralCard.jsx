import { useState, useEffect } from 'react';
import { Copy, Share2, Users, Gift, TrendingUp } from 'lucide-react';
import { showSuccessToast } from '../config/key';
import { getReferralInfo, getReferralHistory } from '../services/referralService';
import { Button, Skeleton } from './ui';
import '../design/components/referral-card.css';

export default function ReferralCard() {
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [stats, setStats] = useState({
    total_referrals: 0,
    successful_referrals: 0,
    total_earnings: 0,
  });

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    setLoading(true);
    try {
      // Load referral info and history in parallel
      const [infoRes, historyRes] = await Promise.all([
        getReferralInfo(),
        getReferralHistory(),
      ]);

      if (infoRes.success && infoRes.data) {
        const code = infoRes.data.referral_code || '';
        setReferralCode(code);
        
        // Generate referral link
        const baseUrl = window.location.origin;
        setReferralLink(code ? `${baseUrl}/login?ref=${code}` : '');
      }

      if (historyRes.success && historyRes.data) {
        setStats({
          total_referrals: historyRes.data.total_referrals || 0,
          successful_referrals: historyRes.data.successful_referrals || 0,
          total_earnings: historyRes.data.total_earnings || 0,
        });
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!referralCode) {
      showSuccessToast('No referral code available', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(referralCode);
      showSuccessToast('Referral code copied!', 'success');
    } catch (error) {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = referralCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showSuccessToast('Referral code copied!', 'success');
    }
  };

  const copyLink = async () => {
    if (!referralLink) {
      showSuccessToast('No referral link available', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      showSuccessToast('Referral link copied!', 'success');
    } catch (error) {
      // Fallback
      const input = document.createElement('input');
      input.value = referralLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showSuccessToast('Referral link copied!', 'success');
    }
  };

  const shareReferral = async () => {
    const shareData = {
      title: 'Join Ayurmuni',
      text: `Use my referral code ${referralCode} to sign up on Ayurmuni and get exclusive rewards!`,
      url: referralLink,
    };

    try {
      // Check if Web Share API is available
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        showSuccessToast('Shared successfully!', 'success');
      } else {
        // Fallback: copy link
        await copyLink();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Share error:', error);
        await copyLink();
      }
    }
  };

  if (loading) {
    return (
      <div className="referral-card" aria-busy="true">
        <Skeleton style={{ height: 180, borderRadius: 'var(--am-radius-lg)' }} />
      </div>
    );
  }

  if (!referralCode) {
    return (
      <div className="referral-card referral-card--empty">
        <div className="referral-empty-icon">
          <Gift size={32} />
        </div>
        <h3>Referral Program</h3>
        <p>Referral rewards coming soon! Invite friends and earn together.</p>
      </div>
    );
  }

  return (
    <div className="referral-card">
      <div className="referral-card-header">
        <div className="referral-card-icon">
          <Users size={24} />
        </div>
        <div>
          <h3>Refer & Earn</h3>
          <p>Invite friends and get rewards</p>
        </div>
      </div>

      <div className="referral-code-section">
        <div className="referral-code-label">Your Referral Code</div>
        <div className="referral-code-display">
          <span className="referral-code">{referralCode}</span>
          <button
            type="button"
            onClick={copyCode}
            className="referral-code-copy"
            aria-label="Copy code"
          >
            <Copy size={18} />
          </button>
        </div>
      </div>

      <div className="referral-actions">
        <Button
          variant="secondary"
          size="sm"
          onClick={copyLink}
          icon={<Copy size={16} />}
        >
          Copy Link
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={shareReferral}
          icon={<Share2 size={16} />}
        >
          Share
        </Button>
      </div>

      <div className="referral-stats">
        <div className="referral-stat">
          <div className="referral-stat-icon">
            <Users size={16} />
          </div>
          <div className="referral-stat-content">
            <div className="referral-stat-value">{stats.successful_referrals}</div>
            <div className="referral-stat-label">Successful</div>
          </div>
        </div>
        <div className="referral-stat">
          <div className="referral-stat-icon">
            <TrendingUp size={16} />
          </div>
          <div className="referral-stat-content">
            <div className="referral-stat-value">{stats.total_referrals}</div>
            <div className="referral-stat-label">Total Referrals</div>
          </div>
        </div>
        <div className="referral-stat">
          <div className="referral-stat-icon">
            <Gift size={16} />
          </div>
          <div className="referral-stat-content">
            <div className="referral-stat-value">₹{stats.total_earnings}</div>
            <div className="referral-stat-label">Earned</div>
          </div>
        </div>
      </div>
    </div>
  );
}
