import { Salad } from 'lucide-react';
import Badge from './ui/Badge';
import { isDietitian } from '../consult/doctors';
import '../design/components/dietitian-badge.css';

/** "Dietitian" pill shown next to a doctor's name (renders only when `is_dietitian` is true). */
export default function DietitianBadge({ doctor, visible, size = 'sm', className = '' }) {
  const show = visible ?? isDietitian(doctor);
  if (!show) return null;
  return (
    <Badge
      tone="success"
      size={size}
      icon={<Salad size={size === 'md' ? 13 : 11} aria-hidden />}
      className={`am-dietitian-badge ${className}`.trim()}
    >
      Dietitian
    </Badge>
  );
}