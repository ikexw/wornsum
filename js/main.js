document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  initMobileNav();
  setActiveNavLink();

  if (document.getElementById('featured-grid'))  renderFeaturedProducts();
  if (document.getElementById('product-grid'))   { renderAllProducts(products); initFilters(); }
  if (document.getElementById('cart-items'))     renderCartPage();
  if (document.getElementById('contact-form'))   initContactForm();
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
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.category = product.category;

  card.innerHTML = `
    <div class="card-image">
      <img src="${product.image}" alt="${product.name}" loading="lazy"
           onerror="this.src='images/placeholder.svg'">
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-category">${product.category}</span>
        <span class="card-size">${product.size}</span>
      </div>
      <h3 class="card-name">${product.name}</h3>
      <div class="card-footer">
        <span class="card-price">$${product.price}</span>
        <button class="btn btn-primary btn-sm add-to-cart" data-id="${product.id}">
          Add to Cart
        </button>
      </div>
    </div>
  `;

  card.querySelector('.add-to-cart').addEventListener('click', (e) => {
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
  const grid = document.getElementById('featured-grid');
  products.filter(p => p.featured).forEach(p => grid.appendChild(createProductCard(p)));
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
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;
      renderAllProducts(cat === 'all' ? products : products.filter(p => p.category === cat));
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

// ── Checkout form submission via Formspree ────────────────────
function initCheckout() {
  const form = document.getElementById('checkout-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const cart  = getCart();
    const total = getCartTotal();
    const lines = cart.map(item => {
      const p = products.find(prod => prod.id === item.id);
      return p ? `${p.name} x${item.qty}  — $${(p.price * item.qty).toFixed(2)}` : '';
    }).join('\n');

    // Inject order summary as a hidden field
    let summaryField = form.querySelector('[name="order_summary"]');
    if (!summaryField) {
      summaryField = Object.assign(document.createElement('input'), { type: 'hidden', name: 'order_summary' });
      form.appendChild(summaryField);
    }
    summaryField.value = `${lines}\n\nTOTAL: $${total.toFixed(2)}`;

    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled  = true;
    submitBtn.textContent = 'Placing order…';

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });

      if (res.ok) {
        clearCart();
        document.getElementById('cart-items').style.display       = 'none';
        document.getElementById('checkout-section').style.display = 'none';
        document.getElementById('order-success').style.display    = 'flex';
      } else {
        submitBtn.disabled   = false;
        submitBtn.textContent = 'Place Order';
        alert('Something went wrong. Please try again or reach out via the Contact page.');
      }
    } catch {
      submitBtn.disabled   = false;
      submitBtn.textContent = 'Place Order';
      alert('Network error. Check your connection and try again.');
    }
  });
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
