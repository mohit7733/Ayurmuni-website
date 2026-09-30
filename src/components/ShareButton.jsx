import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { showSuccessToast } from '../config/key';
import { shareContent } from '../utils/shareUtils';
import ShareModal from './ShareModal';
import { IconButton } from './ui';

/**
 * Simple share button with Web Share API
 * Falls back to clipboard if API not available
 */
export default function ShareButton({
  title,
  text,
  url,
  onShare,
  variant = 'ghost',
  size = 'md',
  showModal = false,
  className,
  ...props
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleShare = async () => {
    if (showModal) {
      setModalOpen(true);
      return;
    }

    const result = await shareContent({ title, text, url });

    if (result.success) {
      if (result.method === 'clipboard') {
        showSuccessToast('Link copied to clipboard!', 'success');
      } else {
        showSuccessToast('Shared successfully!', 'success');
      }
      onShare?.();
    } else if (!result.cancelled) {
      showSuccessToast('Could not share', 'error');
    }
  };

  return (
    <>
      <IconButton
        variant={variant}
        size={size}
        onClick={handleShare}
        aria-label="Share"
        className={className}
        {...props}
      >
        <Share2 size={size === 'sm' ? 16 : 20} />
      </IconButton>

      {showModal && modalOpen && (
        <ShareModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={title}
          text={text}
          url={url}
        />
      )}
    </>
  );
}
