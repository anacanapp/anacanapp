import { useEffect } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PremiumToolBoundary from './PremiumToolBoundary';
const state=vi.hoisted(()=>({isPremium:false,loading:false,entitlementReady:true}));
vi.mock('@/hooks/useSubscription',()=>({useSubscription:()=>state}));
vi.mock('@/components/PremiumModal',()=>({default:({isOpen,onClose}:any)=>isOpen?<div role="dialog"><button onClick={onClose}>Standard Premium paywall</button></div>:null}));
afterEach(cleanup);beforeEach(()=>Object.assign(state,{isPremium:false,loading:false,entitlementReady:true}));
it('never mounts a paid tool for a free or expired account',()=>{const mounted=vi.fn();function Tool(){useEffect(mounted,[]);return <div>Paid tool</div>;}
 render(<PremiumToolBoundary onClose={()=>{}}><Tool/></PremiumToolBoundary>);expect(mounted).not.toHaveBeenCalled();expect(screen.getByRole('dialog')).toHaveTextContent('Standard Premium paywall');
});
it('unmounts ongoing paid activity and opens the standard paywall on revocation',()=>{state.isPremium=true;const stopped=vi.fn();function Tool(){useEffect(()=>stopped,[]);return <div>Paid tool</div>;}
 const view=render(<PremiumToolBoundary onClose={()=>{}}><Tool/></PremiumToolBoundary>);expect(screen.getByText('Paid tool')).toBeInTheDocument();state.isPremium=false;view.rerender(<PremiumToolBoundary onClose={()=>{}}><Tool/></PremiumToolBoundary>);
 expect(stopped).toHaveBeenCalledOnce();expect(screen.queryByText('Paid tool')).not.toBeInTheDocument();expect(screen.getByRole('dialog')).toBeInTheDocument();
});
