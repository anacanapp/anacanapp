import { cleanup, render, waitFor, act } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import ScreenCaptureGuard, { dashboardCaptureAllowed } from './ScreenCaptureGuard';
const mocks=vi.hoisted(()=>({set:vi.fn(),listeners:{} as Record<string,Function>}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true}}));
vi.mock('@/plugins/ScreenshotGuard',()=>({default:{setEnabled:mocks.set,addListener:vi.fn(async(name:string,callback:Function)=>{mocks.listeners[name]=callback;return {remove:async()=>{delete mocks.listeners[name];}};})}}));
beforeEach(()=>{mocks.set.mockReset().mockResolvedValue({secureSurface:true});mocks.listeners={};});
afterEach(()=>{cleanup();document.body.replaceChildren();});
it('allows only the visible main dashboard; a modal or other screen restores protection',()=>{
 const root=document.createElement('div');document.body.append(root);expect(dashboardCaptureAllowed()).toBe(false);root.dataset.mainDashboard='true';expect(dashboardCaptureAllowed()).toBe(true);
 const modal=document.createElement('div');modal.setAttribute('role','dialog');document.body.append(modal);expect(dashboardCaptureAllowed()).toBe(false);modal.remove();root.dataset.mainDashboard='false';expect(dashboardCaptureAllowed()).toBe(false);
});
it('uses a fully opaque black curtain for protected capture instead of a toast, but permits dashboard capture',async()=>{
 const view=render(<><div data-main-dashboard="true"/><ScreenCaptureGuard/></>);await waitFor(()=>expect(mocks.set).toHaveBeenLastCalledWith({enabled:false}));
 act(()=>mocks.listeners.screenshotTaken());expect(document.querySelector('[data-capture-curtain]')).toBeNull();
 view.rerender(<><div data-main-dashboard="false"/><ScreenCaptureGuard/></>);await waitFor(()=>expect(mocks.set).toHaveBeenLastCalledWith({enabled:true}));
 act(()=>mocks.listeners.captureChanged({captured:true}));expect(document.querySelector('[data-capture-curtain]')).toHaveStyle({background:'#000',opacity:1});
 act(()=>mocks.listeners.captureChanged({captured:false}));await waitFor(()=>expect(document.querySelector('[data-capture-curtain]')).toBeNull());
});
it('keeps native protection stable during dashboard taps and scroll gestures',async()=>{
  const navigate=vi.fn();
  const view=render(<><div data-main-dashboard="true"><button onClick={navigate}>Alətlər</button></div><ScreenCaptureGuard/></>);
  await waitFor(()=>expect(mocks.set).toHaveBeenLastCalledWith({enabled:false}));
  mocks.set.mockClear();
  const button=view.getByRole('button');
  act(()=>button.dispatchEvent(new Event('pointerdown',{bubbles:true})));
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,40));});
  expect(mocks.set).not.toHaveBeenCalled();
  act(()=>{button.dispatchEvent(new Event('pointerup',{bubbles:true}));button.click();});
  expect(navigate).toHaveBeenCalledOnce();
  act(()=>{button.dispatchEvent(new Event('pointerdown',{bubbles:true}));button.dispatchEvent(new Event('pointermove',{bubbles:true}));document.dispatchEvent(new Event('scroll'));});
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,40));});
  expect(mocks.set).not.toHaveBeenCalled();
  view.rerender(<><div data-main-dashboard="false"/><ScreenCaptureGuard/></>);
  await waitFor(()=>expect(mocks.set).toHaveBeenLastCalledWith({enabled:true}));
});
