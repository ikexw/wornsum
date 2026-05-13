// Cart state is persisted in localStorage under the key 'wornsum_cart'.
// Each entry: { id: Number, qty: Number }

function getCart() {
  return JSON.parse(localStorage.getItem('wornsum_cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('wornsum_cart', JSON.stringify(cart));
}

function addToCart(productId) {
  const cart = getCart();
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: productId, qty: 1 });
  }
  saveCart(cart);
  updateCartBadge();
}

function removeFromCart(productId) {
  saveCart(getCart().filter(item => item.id !== productId));
  updateCartBadge();
}

function updateQuantity(productId, qty) {
  if (qty < 1) { removeFromCart(productId); return; }
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (item) item.qty = qty;
  saveCart(cart);
  updateCartBadge();
}

function clearCart() {
  localStorage.removeItem('wornsum_cart');
  updateCartBadge();
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function getCartTotal() {
  return getCart().reduce((sum, item) => {
    const product = products.find(p => p.id === item.id);
    return product ? sum + product.price * item.qty : sum;
  }, 0);
}

function updateCartBadge() {
  const badge = document.querySelector('.cart-badge');
  if (!badge) return;
  const count = getCartCount();
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}
