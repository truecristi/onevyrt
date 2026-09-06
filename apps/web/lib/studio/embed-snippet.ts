/**
 * The public tracking embed snippet (Ch.052) — the <script> a user pastes on
 * their real funnel pages. Pure string builder, extracted from funnel-studio.
 */

export function snippetFor(key: string, publicOrigin?: string): string {
  // A snippet pasted on a real funnel page must call a URL the public can reach.
  // The studio's own origin is only right when the studio itself is public.
  const origin = publicOrigin && publicOrigin.trim()
    ? publicOrigin.trim().replace(/\/+$/, "")
    : (typeof window !== "undefined" ? window.location.origin : "https://your-app");
  return [
    "<!-- ONEVYRT tracking \u2014 paste once, e.g. before </body> -->",
    "<script>",
    "(function(){var K=" + JSON.stringify(key) + ",U=" + JSON.stringify(origin + "/api/track") + ";",
    "var S;try{S=localStorage.getItem('gb_sid');if(!S){S=Date.now().toString(36)+Math.random().toString(36).slice(2);localStorage.setItem('gb_sid',S);}}catch(e){S=Date.now().toString(36)+Math.random().toString(36).slice(2);}",
    // Ad platforms only put utm_source/campaign on the FIRST landing URL — by
    // the time someone reaches checkout or a thank-you page those params are
    // long gone from the address bar. Capture once on first sight, persist
    // it alongside the session id, and every later gbTrack call on the same
    // visit still reports the real channel instead of falling back to
    // referrer (which paid ad clicks frequently arrive with blank/unreliable
    // anyway — utm_source is what Google/Meta/TikTok ad URLs actually carry).
    "var SRC;try{var Q=new URLSearchParams(location.search),U1=Q.get('utm_source');if(U1){var C=Q.get('utm_campaign');SRC=U1+(C?('/'+C):'');localStorage.setItem('gb_src',SRC);}else{SRC=localStorage.getItem('gb_src')||(document.referrer?new URL(document.referrer).hostname:undefined);}}catch(e){}",
    "window.gbTrack=function(node,type,value){try{fetch(U,{method:\"POST\",headers:{\"content-type\":\"application/json\"},body:JSON.stringify({key:K,node:node,type:type||\"visit\",value:value||0,session:S,url:location.pathname,source:SRC})});}catch(e){}};",
    "})();",
    "</script>",
    "",
    "<!-- then on each funnel page, tag it with its node id: -->",
    "<!-- <script>gbTrack(\"traffic-1\",\"visit\")</script> -->",
    "<!-- on your sale/thank-you page use convert, with revenue in cents: -->",
    "<!-- <script>gbTrack(\"offer-1\",\"convert\",4900)</script>  (=$49.00) -->",
    "",
    "<!-- Per-channel attribution (Google/Facebook/Instagram/TikTok/etc.): give",
    "     each ad's destination URL a utm_source (and optionally utm_campaign),",
    "     e.g. yoursite.com/?utm_source=facebook&utm_campaign=spring_sale.",
    "     Every ad platform can auto-fill this on its destination URL field.",
    "     No per-channel landing page or separate snippet needed — gbTrack",
    "     picks it up automatically and it shows up as the source in People",
    "     Journeys and the traffic explorer. -->",
  ].join("\n");
}
