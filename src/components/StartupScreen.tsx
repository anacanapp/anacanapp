import brandMark from '@/assets/brand-mark.png';

/** Shared visual handoff between native launch, bootstrap and React loading. */
export default function StartupScreen() {
  return <div className="anacan-startup" role="status" aria-label="Anacan" aria-busy="true" data-startup-screen>
    <div className="anacan-startup-brand">
      <img src={brandMark} width={96} height={96} alt="" className="anacan-startup-mark" />
      <p className="anacan-startup-name">Anacan</p>
      <span className="anacan-startup-progress" aria-hidden="true"><span /></span>
    </div>
  </div>;
}
