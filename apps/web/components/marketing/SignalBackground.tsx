import { AmbientGrid } from './AmbientGrid';

export function SignalBackground() {
  return (
    <div aria-hidden="true" className="signal-background">
      <div className="signal-background__orb signal-background__orb--primary" />
      <div className="signal-background__orb signal-background__orb--secondary" />
      <div className="signal-background__beam signal-background__beam--left" />
      <div className="signal-background__beam signal-background__beam--right" />
      <AmbientGrid />
    </div>
  );
}
