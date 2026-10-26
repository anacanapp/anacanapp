import type { Plugin, ViteDevServer } from 'vite';
export function websitePrerenderPlugin(options:{ standalone?:boolean; root:string; server:ViteDevServer }):Plugin;
