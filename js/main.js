// ── Cloudflare Worker URL ─────────────────────────────────────
const WORKER_URL = 'https://wornsum-checkout.wornsum.workers.dev';

// ── Drop schedule ─────────────────────────────────────────────
// dropTime is declared in products.js (loaded before this file)
const DROP_TIME    = (typeof dropTime !== 'undefined' && dropTime) ? new Date(dropTime) : null;
const DROP_IS_LIVE = !DROP_TIME || Date.now() >= DROP_TIME.getTime();

function getPublishedProducts() {
  // Published products sorted: available first, sold at bottom
  return products
    .filter(p => p.published !== false)
    .sort((a, b) => (a.sold ? 1 : 0) - (b.sold ? 1 : 0));
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  initMobileNav();
  setActiveNavLink();
  initProductModal();

  if (document.getElementById('featured-grid'))  renderFeaturedProducts();
  if (document.getElementById('product-grid'))   initShopPage();
  if (document.getElementById('cart-items'))     renderCartPage();
  if (document.getElementById('contact-form'))   initContactForm();
  if (document.getElementById('order-number'))   initSuccessPage();
});

// ── Mobile nav ────────────────────────────────────────────────
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const menu   = document.querySelector('.nav-links');
  if (!toggle || !menu) return;
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.classList.toggle('is-open', open);
  });
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.classList.remove('is-open');
    }
  });
}

// ── Highlight active nav link based on current page ───────────
function setActiveNavLink() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active');
  });
}

// ── Build a product card DOM element ─────────────────────────
function createProductCard(product) {
  const imgs = (product.images && product.images.length)
    ? product.images
    : [product.image || 'images/placeholder.svg'];
  const multi = imgs.length > 1;

  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.category = product.category;

  card.innerHTML = `
    <div class="card-image">
      <img src="${imgs[0]}" alt="${product.name}" loading="lazy"
           onerror="this.src='images/placeholder.svg'">
      ${product.sold ? '<div class="sold-overlay"><span class="sold-stamp">Sold</span></div>' : ''}
      ${multi ? `
        <button class="img-nav img-nav-prev" aria-label="Previous photo">&#8249;</button>
        <button class="img-nav img-nav-next" aria-label="Next photo">&#8250;</button>
        <div class="img-dots">${imgs.map((_, i) => `<span class="img-dot${i===0?' active':''}"></span>`).join('')}</div>
      ` : ''}
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-category">${product.category}</span>
        <span class="card-size">${product.size}</span>
      </div>
      <h3 class="card-name">${product.name}</h3>
      <div class="card-footer">
        <span class="card-price">$${product.price}</span>
        ${product.sold
          ? '<span class="btn btn-sm sold-tag">Sold</span>'
          : `<button class="btn btn-primary btn-sm add-to-cart" data-id="${product.id}">Add to Cart</button>`
        }
      </div>
    </div>
  `;

  if (multi) {
    let cur = 0;
    const imgEl  = card.querySelector('.card-image img');
    const dots   = card.querySelectorAll('.img-dot');
    const goTo   = (n) => {
      cur = (n + imgs.length) % imgs.length;
      imgEl.src = imgs[cur];
      dots.forEach((d, i) => d.classList.toggle('active', i === cur));
    };
    card.querySelector('.img-nav-prev').addEventListener('click', (e) => { e.stopPropagation(); goTo(cur - 1); });
    card.querySelector('.img-nav-next').addEventListener('click', (e) => { e.stopPropagation(); goTo(cur + 1); });
  }

  card.addEventListener('click', (e) => {
    if (!e.target.closest('button')) openProductModal(product);
  });

  const addBtn = card.querySelector('.add-to-cart');
  if (!addBtn) return card; // sold item — no cart button
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    addToCart(product.id);

    btn.textContent = 'Added ✓';
    btn.classList.add('added');
    setTimeout(() => {
      btn.textContent = 'Add to Cart';
      btn.classList.remove('added');
    }, 1200);

    const cartIcon = document.querySelector('.cart-icon-wrap');
    if (cartIcon) {
      cartIcon.classList.add('bounce');
      cartIcon.addEventListener('animationend', () => cartIcon.classList.remove('bounce'), { once: true });
    }
  });

  return card;
}

// ── Home: featured products ───────────────────────────────────
function renderFeaturedProducts() {
  if (!DROP_IS_LIVE) return;
  const grid = document.getElementById('featured-grid');
  getPublishedProducts().filter(p => p.featured).forEach(p => grid.appendChild(createProductCard(p)));
}

// ── Shop: init (checks drop schedule before rendering) ────────
function initShopPage() {
  if (!DROP_IS_LIVE) {
    showDropCountdown(DROP_TIME);
    return;
  }
  renderAllProducts(getPublishedProducts());
  initFilters();
}

// ── Shop: countdown timer ────────────────────────────────────
function showDropCountdown(dropDate) {
  const filterBar = document.querySelector('.filter-bar');
  if (filterBar) filterBar.style.display = 'none';

  const dateStr = dropDate.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', hour:'numeric', minute:'2-digit' });

  const target = document.getElementById('drop-countdown') || document.getElementById('product-grid');
  target.style.display = '';
  target.innerHTML = `
    <div class="drop-countdown-wrap">
      <p class="drop-eyebrow">Upcoming Drop</p>
      <h2 class="drop-headline">Something new is coming.</h2>
      <p class="drop-subtext">New pieces drop ${dateStr}.</p>
      <div class="countdown-grid">
        <div class="countdown-block"><div class="countdown-num" id="cd-days">00</div><div class="countdown-lbl">Days</div></div>
        <div class="countdown-block"><div class="countdown-num" id="cd-hours">00</div><div class="countdown-lbl">Hrs</div></div>
        <div class="countdown-block"><div class="countdown-num" id="cd-mins">00</div><div class="countdown-lbl">Min</div></div>
        <div class="countdown-block"><div class="countdown-num" id="cd-secs">00</div><div class="countdown-lbl">Sec</div></div>
      </div>
    </div>`;

  const fmt = n => String(n).padStart(2, '0');
  function tick() {
    const rem = dropDate.getTime() - Date.now();
    if (rem <= 0) { location.reload(); return; }
    document.getElementById('cd-days').textContent  = fmt(Math.floor(rem / 86400000));
    document.getElementById('cd-hours').textContent = fmt(Math.floor((rem % 86400000) / 3600000));
    document.getElementById('cd-mins').textContent  = fmt(Math.floor((rem % 3600000) / 60000));
    document.getElementById('cd-secs').textContent  = fmt(Math.floor((rem % 60000) / 1000));
  }
  tick();
  setInterval(tick, 1000);
}

// ── Shop: all products (filtered) ────────────────────────────
function renderAllProducts(list) {
  const grid = document.getElementById('product-grid');
  grid.innerHTML = '';
  if (list.length === 0) {
    grid.innerHTML = '<p class="no-results">No items in this category right now.</p>';
    return;
  }
  list.forEach(p => grid.appendChild(createProductCard(p)));
}

// ── Shop: category filter buttons ────────────────────────────
function initFilters() {
  const pub = getPublishedProducts();
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;
      renderAllProducts(cat === 'all' ? pub : pub.filter(p => p.category === cat));
    });
  });
}

// ── Cart page ─────────────────────────────────────────────────
function renderCartPage() {
  const container      = document.getElementById('cart-items');
  const totalEl        = document.getElementById('cart-total');
  const checkoutSection = document.getElementById('checkout-section');
  const emptyState     = document.getElementById('cart-empty');
  const successState   = document.getElementById('order-success');

  const cart = getCart();

  if (cart.length === 0) {
    if (container)       container.style.display = 'none';
    if (checkoutSection) checkoutSection.style.display = 'none';
    if (emptyState)      emptyState.style.display = 'flex';
    if (successState)    successState.style.display = 'none';
    return;
  }

  if (emptyState)  emptyState.style.display  = 'none';
  if (successState) successState.style.display = 'none';
  if (container)   container.style.display   = '';
  if (checkoutSection) checkoutSection.style.display = '';

  container.innerHTML = '';

  cart.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return;

    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <div class="cart-item-img">
        <img src="${product.image}" alt="${product.name}">
      </div>
      <div class="cart-item-info">
        <p class="cart-item-name">${product.name}</p>
        <p class="cart-item-meta">${product.category} · Size ${product.size}</p>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" data-id="${product.id}" data-action="dec" aria-label="Decrease quantity">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" data-id="${product.id}" data-action="inc" aria-label="Increase quantity">+</button>
      </div>
      <div class="cart-item-price">$${(product.price * item.qty).toFixed(2)}</div>
      <button class="cart-remove" data-id="${product.id}" aria-label="Remove ${product.name}">×</button>
    `;
    container.appendChild(row);
  });

  if (totalEl) totalEl.textContent = `$${getCartTotal().toFixed(2)}`;

  container.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = parseInt(btn.dataset.id);
      const item = getCart().find(i => i.id === id);
      if (!item) return;
      updateQuantity(id, btn.dataset.action === 'inc' ? item.qty + 1 : item.qty - 1);
      renderCartPage();
    });
  });

  container.querySelectorAll('.cart-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFromCart(parseInt(btn.dataset.id));
      renderCartPage();
    });
  });

  initCheckout();
}

// ── Checkout → Stripe redirect ────────────────────────────────
function initCheckout() {
  const form = document.getElementById('checkout-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const cart = getCart();
    if (cart.length === 0) return;

    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Redirecting…';

    const note = (form.querySelector('[name="note"]')?.value || '').trim();

    // Build cart snapshot with full product details
    const items = cart.map(item => {
      const p = products.find(prod => prod.id === item.id);
      return p ? { id: p.id, name: p.name, price: p.price, size: p.size, qty: item.qty } : null;
    }).filter(Boolean);

    // Save snapshot so success page can show the receipt
    sessionStorage.setItem('wornsum_checkout_cart', JSON.stringify(items));

    if (WORKER_URL.includes('YOUR_SUBDOMAIN')) {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Pay with Card';
      alert('Payment is not yet configured. Please contact us directly to place an order.');
      return;
    }

    try {
      const res  = await fetch(`${WORKER_URL}/checkout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items, note }),
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Could not start checkout');
      }
    } catch (err) {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Pay with Card';
      alert(`Checkout error: ${err.message}.\nPlease try again or contact us directly.`);
    }
  });
}

// ── Order confirmation page ───────────────────────────────────
async function initSuccessPage() {
  const params    = new URLSearchParams(location.search);
  const sessionId = params.get('session_id');

  if (!sessionId) {
    location.href = 'index.html';
    return;
  }

  // Generate readable order number from session ID
  const clean    = sessionId.replace(/[^a-zA-Z0-9]/g, '');
  const orderNum = 'WRN-' + clean.slice(-8).toUpperCase();
  document.getElementById('order-number').textContent = orderNum;

  // Render cart items from sessionStorage snapshot
  const snapshot = JSON.parse(sessionStorage.getItem('wornsum_checkout_cart') || '[]');
  const itemsEl  = document.getElementById('receipt-items');

  if (snapshot.length > 0) {
    snapshot.forEach(item => {
      const row = document.createElement('div');
      row.className = 'receipt-item';
      row.innerHTML = `
        <span class="receipt-item-name">${item.name}<span class="receipt-size">Size ${item.size}</span></span>
        <span class="receipt-qty">× ${item.qty}</span>
        <span class="receipt-price">$${(item.price * item.qty).toFixed(2)}</span>
      `;
      itemsEl.appendChild(row);
    });
    const total = snapshot.reduce((sum, i) => sum + i.price * i.qty, 0);
    document.getElementById('receipt-total').textContent = `$${total.toFixed(2)}`;
  }

  // Clear cart — Stripe only redirects here on successful payment
  clearCart();
  sessionStorage.removeItem('wornsum_checkout_cart');

  // Auto-mark purchased items as sold
  const productIds = snapshot.map(i => i.id);
  if (productIds.length > 0 && !WORKER_URL.includes('YOUR_SUBDOMAIN')) {
    try {
      await fetch(`${WORKER_URL}/mark-sold`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id: sessionId, product_ids: productIds }),
      });
    } catch { /* Silently fail — order confirmed, admin can mark manually */ }
  }

  // Fetch session from Worker for email + note
  if (!WORKER_URL.includes('YOUR_SUBDOMAIN')) {
    try {
      const res     = await fetch(`${WORKER_URL}/session?id=${encodeURIComponent(sessionId)}`);
      const session = await res.json();

      if (session.email) {
        document.getElementById('confirm-email').textContent   = session.email;
        document.getElementById('confirm-email-row').style.display = 'flex';
      }
      if (session.note) {
        document.getElementById('order-note').textContent      = session.note;
        document.getElementById('order-note-row').style.display = 'block';
      }
      if (session.amount_total) {
        document.getElementById('receipt-total').textContent =
          `$${(session.amount_total / 100).toFixed(2)}`;
      }
    } catch {
      // Silently ignore — order is confirmed, receipt is shown from sessionStorage
    }
  }
}

// ── Product detail modal ──────────────────────────────────────
function initProductModal() {
  const modal = document.createElement('div');
  modal.id = 'product-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container">
      <button class="modal-close" aria-label="Close">&times;</button>
      <div class="modal-images">
        <img class="modal-main-img" src="" alt="">
        <div class="modal-thumbs"></div>
      </div>
      <div class="modal-info">
        <div class="modal-meta">
          <span class="modal-category"></span>
          <span class="modal-size"></span>
        </div>
        <h2 class="modal-name"></h2>
        <p class="modal-price"></p>
        <p class="modal-description"></p>
        <div class="modal-actions"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.modal-close').addEventListener('click', closeProductModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeProductModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProductModal(); });
}

function openProductModal(product) {
  const modal   = document.getElementById('product-modal');
  const imgs    = (product.images && product.images.length) ? product.images : [product.image || 'images/placeholder.svg'];
  const mainImg = modal.querySelector('.modal-main-img');
  const thumbsEl = modal.querySelector('.modal-thumbs');

  mainImg.src = imgs[0];
  mainImg.alt = product.name;

  thumbsEl.innerHTML = '';
  if (imgs.length > 1) {
    imgs.forEach((src, i) => {
      const t = document.createElement('img');
      t.src = src; t.className = 'modal-thumb' + (i === 0 ? ' active' : '');
      t.addEventListener('click', () => {
        mainImg.src = src;
        thumbsEl.querySelectorAll('.modal-thumb').forEach((el, j) => el.classList.toggle('active', j === i));
      });
      thumbsEl.appendChild(t);
    });
  }

  modal.querySelector('.modal-category').textContent  = product.category;
  modal.querySelector('.modal-size').textContent       = 'Size ' + product.size;
  modal.querySelector('.modal-name').textContent       = product.name;
  modal.querySelector('.modal-price').textContent      = '$' + product.price;
  modal.querySelector('.modal-description').textContent = product.description || '';

  const actions = modal.querySelector('.modal-actions');
  if (product.sold) {
    actions.innerHTML = '<span class="btn sold-tag">Sold</span>';
  } else {
    actions.innerHTML = `<button class="btn btn-primary add-to-cart-modal" data-id="${product.id}">Add to Cart</button>`;
    actions.querySelector('.add-to-cart-modal').addEventListener('click', () => {
      addToCart(product.id);
      const btn = actions.querySelector('.add-to-cart-modal');
      btn.textContent = 'Added ✓'; btn.classList.add('added');
      setTimeout(() => { btn.textContent = 'Add to Cart'; btn.classList.remove('added'); }, 1200);
      const cartIcon = document.querySelector('.cart-icon-wrap');
      if (cartIcon) {
        cartIcon.classList.add('bounce');
        cartIcon.addEventListener('animationend', () => cartIcon.classList.remove('bounce'), { once: true });
      }
    });
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Contact form submission via Formspree ─────────────────────
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled  = true;
    submitBtn.textContent = 'Sending…';

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });

      if (res.ok) {
        form.reset();
        const msg = document.getElementById('contact-success');
        if (msg) msg.style.display = 'flex';
        submitBtn.textContent = 'Message Sent ✓';
      } else {
        submitBtn.disabled   = false;
        submitBtn.textContent = 'Send Message';
        alert('Could not send your message. Please email us directly.');
      }
    } catch {
      submitBtn.disabled   = false;
      submitBtn.textContent = 'Send Message';
      alert('Network error. Please try again.');
    }
  });
}
