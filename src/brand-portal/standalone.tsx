// Standalone web entry for /brands (served as /brands-app/index.html by the gateway).
// It mounts only the brand portal, so a portal release never rebuilds or replaces
// the consumer application bundle. Same globals as src/main.tsx before the portal.
import '../lib/polyfills';
import '../index.css';
import { startBrandPortal } from './bootstrap';

startBrandPortal();
