/* Frost Survival network promotion: shared, clearly labelled community CTA. */
(function () {
  if (document.getElementById("frost-network-promo")) return;
  const style = document.createElement("style");
  style.textContent = `
    #frost-network-promo{position:relative;z-index:20;margin:22px auto 12px;max-width:1180px;padding:14px 16px;border:1px solid rgba(91,151,255,.48);border-radius:16px;background:linear-gradient(110deg,rgba(8,28,62,.98),rgba(42,24,83,.97));box-shadow:0 8px 28px rgba(0,0,0,.24);color:#fff;font:inherit}
    #frost-network-promo .fnp-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    #frost-network-promo strong{display:block;font-size:15px}
    #frost-network-promo small{display:block;opacity:.82;margin-top:3px}
    #frost-network-promo .fnp-actions{display:flex;gap:8px;flex-wrap:wrap}
    #frost-network-promo a{display:inline-block;padding:9px 13px;border-radius:10px;text-decoration:none;font-weight:700;background:#2563eb;color:#fff}
    #frost-network-promo a.fnp-secondary{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25)}
    @media(max-width:600px){#frost-network-promo .fnp-actions{width:100%}#frost-network-promo .fnp-actions a{flex:1;text-align:center}}
  `;
  document.head.appendChild(style);
  const box = document.createElement("aside");
  box.id = "frost-network-promo";
  box.setAttribute("aria-label", "Powered by Frost Survival community promotion");
  box.innerHTML = '<div class="fnp-row"><div><strong>❄ Powered by Frost Survival</strong><small>Join the community, discover game downloads, guides and updates.</small></div><div class="fnp-actions"><a href="https://discord.gg/NVf6zsb35" target="_blank" rel="noopener" data-promo="discord">Join Discord</a><a class="fnp-secondary" href="https://youtube.com/@gm_sultaan?sub_confirmation=1" target="_blank" rel="noopener" data-promo="youtube">Subscribe on YouTube</a><a class="fnp-secondary" href="index.html#games" data-promo="games">Explore Games</a><a class="fnp-secondary" href="promotion.html" data-promo="share">Promote / Share</a></div></div>';
  const footer = document.querySelector("footer");
  if (footer && footer.parentNode) footer.parentNode.insertBefore(box, footer);
  else document.body.appendChild(box);
})();