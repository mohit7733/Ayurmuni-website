import { HeartHandshake, Leaf, Salad, Shield, Stethoscope } from 'lucide-react';

const ICONS = {
  stethoscope: Stethoscope,
  'salad-filled': Salad,
  'heart-handshake': HeartHandshake,
  leaf: Leaf,
  shield: Shield,
};

export default function PlanMark({ name, size = 14, color }) {
  const Icon = ICONS[name] || Stethoscope;
  return <Icon size={size} color={color} aria-hidden />;
}
