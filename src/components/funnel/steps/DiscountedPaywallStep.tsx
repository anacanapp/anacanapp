import ReverseTrialFunnel from '../ReverseTrialFunnel';

/** Old imports resume the account-scoped paid flow, never a simulated trial. */
export default function DiscountedPaywallStep({ onAccept }: { onAccept: () => void; onDecline: () => void }) {
  return <ReverseTrialFunnel onComplete={onAccept} />;
}
