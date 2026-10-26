const quote=value=>'"'+String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
/** Maps use decoded $uri so escaped and Unicode legacy URLs share one 301. */
export function websiteNginxMaps(redirects,{prefix=''}={}) {
  const values=new Map();
  for(const[from,to]of Object.entries(redirects)){
    const key=decodeURIComponent(prefix+from),target=prefix+to;
    if(key!==decodeURIComponent(target))values.set(key,target);
  }
  return `map $uri $anacan_website_redirect {\n  default "";\n${[...values].map(([from,to])=>`  ${quote(from)} ${quote(to)};`).join('\n')}\n}\n`;
}
export function websiteNginxServer({root='/usr/share/nginx/website',previewPrefix='/site',names='anacan.az www.anacan.az'}={}) {
  return `
  # Anacan public website: real HTML/404 and a single-hop permanent URL contract.
  server {
    listen 80;
    server_name ${names};
    root ${root};
    absolute_redirect off;
    error_log /dev/null crit;
    include /etc/nginx/gateway-security-headers.conf;
    add_header Cache-Control "no-cache" always;
    if ($host = www.anacan.az) { return 301 https://anacan.az$request_uri; }
    location = /healthz { return 200 '{"status":"ok","service":"website"}'; }
    location = /brand-mark.png { try_files $uri =404; }
    location = /favicon.png { try_files $uri =404; }
    location = /icon-192.png { try_files $uri =404; }
    location = /robots.txt { try_files $uri =404; }
    location = /llms.txt { try_files $uri =404; }
    location = /website-release.json { try_files $uri =404; }
    location ~ ^/assets/ { try_files $uri =404; include /etc/nginx/gateway-security-headers.conf; add_header Cache-Control "public, max-age=31536000, immutable"; }
    location ^~ /website/data/ { proxy_pass http://anacan-website:9200; proxy_set_header X-Anacan-Website-Prefix ""; proxy_set_header Cookie ""; proxy_set_header Authorization ""; }
    location ~ ^/(website/|blog-covers/) { try_files $uri =404; include /etc/nginx/gateway-security-headers.conf; add_header Cache-Control "public, max-age=300"; }
    location = /app-ads.txt { proxy_pass http://127.0.0.1/app-ads.txt; proxy_set_header Host gcp.anacan.az; }
    error_page 404 /404.html;
    location = /404.html { internal; add_header X-Robots-Tag "noindex" always; }
    location / { proxy_pass http://anacan-website:9200; proxy_set_header X-Anacan-Website-Prefix ""; proxy_set_header Cookie ""; proxy_set_header Authorization ""; }
  }
`;
}
