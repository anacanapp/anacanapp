export function isWebsitePath(pathname:string,hostname:string):boolean {
  if(/^\/site(?:\/|$)/.test(pathname))return true;
  return ['anacan.az','www.anacan.az'].includes(hostname) && !/^\/(?:brands|auth|admin|moderator)(?:\/|$)/.test(pathname);
}
