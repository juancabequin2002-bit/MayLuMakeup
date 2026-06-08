const state = {
  category: "Todas",
  query: "",
  maxPrice: 150000,
  sort: "featured",
  cart: [],
  selectedProduct: null,
  selectedVariant: null,
  adminLoggedIn: false,
  adminQuery: "",
  viewMode: localStorage.getItem("maluViewMode") || ""
};

const byId = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
}).format(value || 0);
const whatsappMoney = (value) => money(value).replace(/\$\s*/, "$");

const productGrid = byId("productGrid");
const offerStrip = byId("offerStrip");
const newStrip = byId("newStrip");
const searchInput = byId("searchInput");
const categorySelect = byId("categorySelect");
const priceRange = byId("priceRange");
const priceLabel = byId("priceLabel");
const sortSelect = byId("sortSelect");
const resultSummary = byId("resultSummary");
const cartPanel = byId("cartPanel");
const productModal = byId("productModal");
const adminPanel = byId("adminPanel");
const scrim = byId("scrim");
const mobileCartButton = byId("mobileCartButton");
const savedPrices = JSON.parse(localStorage.getItem("maluPrices") || "{}");
const sellerWhatsApp = "573214107108";

const topImages = PRODUCTS.filter((product) => product.image).slice(0, 3);
["heroImageA", "heroImageB", "heroImageC"].forEach((id, index) => {
  const image = byId(id);
  if (image && topImages[index]) image.src = topImages[index].image;
});

function normalize(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function productInitials(name) {
  return String(name || "TS").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function escapeAttr(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function imageMarkup(product, alt = product.name) {
  const fallbacks = JSON.stringify(product.fallbackImages || []);
  return product.image
    ? `<img src="${escapeAttr(product.image)}" alt="${escapeAttr(alt)}" loading="lazy" data-fallback-index="0" data-fallbacks="${escapeAttr(fallbacks)}">`
    : `<span class="initials">${productInitials(product.name)}</span>`;
}

function productPrice(product) {
  return Number(savedPrices[product.id] || product.price || 0);
}

function variantPrice(product, variant) {
  return Number(savedPrices[product.id] || savedPrices[`${product.id}-${variant?.id}`] || variant?.price || productPrice(product));
}

function savePrices() {
  localStorage.setItem("maluPrices", JSON.stringify(savedPrices));
}

function productCard(product, compact = false) {
  const price = productPrice(product);
  const badge = product.badge === "NUEVO" ? "NUEVO" : "";
  return `
    <article class="product-card" data-id="${product.id}" tabindex="0" role="button" aria-label="Ver detalle de ${product.name}">
      ${badge ? `<span class="badge">${badge}</span>` : ""}
      <div class="product-image">
        ${imageMarkup(product)}
      </div>
      <div class="product-info">
        <h3>${product.name}</h3>
        <span class="sku">${product.sku || product.category}</span>
        <div class="price-line">
          <span class="price">${money(price)}</span>
        </div>
        ${compact ? "" : `<small>${product.min || "Disponible por unidad"}</small>`}
        <button class="add-button" type="button" data-id="${product.id}">Agregar al carrito</button>
      </div>
    </article>
  `;
}

function getFilteredProducts() {
  const query = normalize(state.query);
  const filtered = PRODUCTS.filter((product) => {
    const matchCategory = state.category === "Todas" || product.category === state.category || product.group === state.category;
    const matchQuery = !query || normalize(`${product.name} ${product.sku} ${product.category} ${product.group}`).includes(query);
    const matchPrice = productPrice(product) <= state.maxPrice;
    return matchCategory && matchQuery && matchPrice;
  });

  return filtered.sort((a, b) => {
    if (state.sort === "priceAsc") return productPrice(a) - productPrice(b);
    if (state.sort === "priceDesc") return productPrice(b) - productPrice(a);
    if (state.sort === "nameAsc") return a.name.localeCompare(b.name);
    return (b.image ? 1 : 0) - (a.image ? 1 : 0);
  });
}

function renderCatalog() {
  const products = getFilteredProducts();
  resultSummary.textContent = `${products.length} productos encontrados`;
  productGrid.innerHTML = products.map((product) => productCard(product)).join("");
}

function renderHighlights() {
  const offers = PRODUCTS.slice(0, 4);
  const news = PRODUCTS.filter((product) => product.badge === "NUEVO" || product.image).slice(0, 4);
  offerStrip.innerHTML = offers.map((product) => productCard(product, true)).join("");
  newStrip.innerHTML = news.map((product) => productCard(product, true)).join("");
}

function renderCategories() {
  const categories = ["Todas", ...new Set(PRODUCTS.map((product) => product.category).filter(Boolean).sort())];
  categorySelect.innerHTML = categories.map((category) => `<option value="${category}">${category}</option>`).join("");
}

function renderCart() {
  const rows = cartRows();
  const totalQty = rows.reduce((sum, item) => sum + item.qty, 0);
  const total = rows.reduce((sum, item) => sum + item.qty * item.price, 0);
  byId("cartCount").textContent = totalQty;
  byId("mobileCartCount").textContent = totalQty;
  byId("cartTotal").textContent = money(total);
  byId("cartItems").innerHTML = rows.length
    ? rows.map((item) => `
      <div class="cart-item" data-id="${item.id}">
        <div>
          <p>${item.name}</p>
          <small>${money(item.price)} c/u - Subtotal: ${money(item.qty * item.price)}</small>
          <div class="qty-controls">
            <button class="qty-button" type="button" data-action="decrease" data-id="${item.id}">-</button>
            <strong>${item.qty}</strong>
            <button class="qty-button" type="button" data-action="increase" data-id="${item.id}">+</button>
            <button class="qty-remove" type="button" data-action="remove" data-id="${item.id}">x</button>
          </div>
        </div>
      </div>
    `).join("")
    : "<p class=\"empty-cart\">Todavia no has agregado productos.</p>";
}

function cartRows() {
  const items = state.cart.reduce((map, product) => {
    map[product.id] = map[product.id] || { ...product, qty: 0 };
    map[product.id].qty += 1;
    return map;
  }, {});
  return Object.values(items);
}

function changeCartItem(id, action) {
  if (action === "increase") {
    const item = state.cart.find((product) => product.id === id);
    if (item) state.cart.push(item);
  }
  if (action === "decrease") {
    const index = state.cart.findIndex((product) => product.id === id);
    if (index >= 0) state.cart.splice(index, 1);
  }
  if (action === "remove") {
    state.cart = state.cart.filter((product) => product.id !== id);
  }
  renderCart();
}

function openCart() {
  cartPanel.classList.add("open");
  scrim.classList.add("open");
  cartPanel.setAttribute("aria-hidden", "false");
}

function closeCart() {
  cartPanel.classList.remove("open");
  cartPanel.setAttribute("aria-hidden", "true");
  if (!productModal.classList.contains("open") && !adminPanel.classList.contains("open")) scrim.classList.remove("open");
}

function cleanDescription(product) {
  const fallback = `${product.name} de la categoria ${product.category}. Producto disponible en MA&LUMAKEUP con precio desde ${money(productPrice(product))}.`;
  return product.description || product.metaDescription || fallback;
}

function renderVariantList(product) {
  const variants = product.variants || [];
  if (variants.length <= 1) {
    byId("variantBox").style.display = "none";
    byId("variantList").innerHTML = "";
    return;
  }

  byId("variantBox").style.display = "block";
  byId("variantList").innerHTML = variants.map((variant, index) => `
    <button class="variant-chip ${index === 0 ? "active" : ""}" type="button" data-variant="${variant.id}">
      ${variant.sku || variant.name}
    </button>
  `).join("");
}

function setModalVariant(variant) {
  state.selectedVariant = variant;
  if (variant?.image) {
    byId("modalImage").src = variant.image;
    byId("modalImage").dataset.fallbackIndex = "0";
  }
  const price = variant ? variantPrice(state.selectedProduct, variant) : productPrice(state.selectedProduct);
  byId("modalPrice").textContent = money(price);
  byId("modalListPrice").textContent = "";
  document.querySelectorAll(".variant-chip").forEach((button) => {
    button.classList.toggle("active", button.dataset.variant === variant?.id);
  });
}

function openProductModal(product) {
  const variants = product.variants || [];
  const firstVariant = variants.find((variant) => variant.available) || variants[0] || null;
  state.selectedProduct = product;
  state.selectedVariant = firstVariant;

  const modalImage = byId("modalImage");
  modalImage.src = firstVariant?.image || product.image;
  modalImage.alt = product.name;
  modalImage.dataset.fallbackIndex = "0";
  modalImage.dataset.fallbacks = JSON.stringify(product.fallbackImages || []);
  byId("modalCategory").textContent = product.category;
  byId("modalTitle").textContent = product.name;
  byId("modalPrice").textContent = money(firstVariant ? variantPrice(product, firstVariant) : productPrice(product));
  byId("modalListPrice").textContent = "";
  byId("modalDescription").textContent = cleanDescription(product);
  renderVariantList(product);

  productModal.classList.add("open");
  scrim.classList.add("open");
  productModal.setAttribute("aria-hidden", "false");
  byId("closeModal").focus();
}

function closeProductModal() {
  productModal.classList.remove("open");
  productModal.setAttribute("aria-hidden", "true");
  if (!cartPanel.classList.contains("open")) scrim.classList.remove("open");
}

function addProductToCart(product, variant = null) {
  const selected = variant ? {
    ...product,
    id: `${product.id}-${variant.id}`,
    name: variant.name && variant.name !== product.name ? `${product.name} - ${variant.name}` : product.name,
    sku: variant.sku || product.sku,
    price: variantPrice(product, variant),
    listPrice: 0,
    image: variant.image || product.image
  } : { ...product, price: productPrice(product), listPrice: 0 };
  state.cart.push(selected);
  renderCart();
  openCart();
}

function sendOrderWhatsApp() {
  const rows = cartRows();
  if (!rows.length) {
    alert("Agrega productos al carrito antes de enviar el pedido.");
    return;
  }
  const name = byId("customerName").value.trim();
  const phone = byId("customerPhone").value.trim();
  const city = byId("customerCity").value.trim();
  const address = byId("customerAddress").value.trim();
  const notes = byId("customerNotes").value.trim();
  if (!name || !phone || !city || !address) {
    alert("Completa nombre, telefono, ciudad y direccion.");
    return;
  }

  const total = rows.reduce((sum, item) => sum + item.qty * item.price, 0);
  const icon = (...codes) => String.fromCodePoint(...codes);
  const icons = {
    bag: icon(0x1F6CD, 0xFE0F),
    lipstick: icon(0x1F484),
    box: icon(0x1F4E6),
    money: icon(0x1F4B0),
    person: icon(0x1F464),
    pin: icon(0x1F4CC),
    phone: icon(0x1F4DE),
    city: icon(0x1F3D9, 0xFE0F),
    house: icon(0x1F3E0),
    note: icon(0x1F4DD),
    check: icon(0x2705),
    ten: icon(0x1F51F)
  };
  const numberIcon = (index) => {
    if (index === 9) return icons.ten;
    if (index < 9) return `${index + 1}${icon(0xFE0F, 0x20E3)}`;
    return `${index + 1}.`;
  };
  const products = rows.map((item, index) => [
    `${numberIcon(index)} ${item.name}`,
    `   Ref: ${item.sku || "Sin referencia"}`,
    `   Cantidad: ${item.qty}`,
    `   Valor unitario: ${whatsappMoney(item.price)}`,
    `   Subtotal: ${whatsappMoney(item.qty * item.price)}`
  ].join("\n")).join("\n\n");
  const separator = "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501";
  const message = [
    `${icons.bag} *NUEVO PEDIDO - MA&LUMAKEUP* ${icons.lipstick}`,
    separator,
    "",
    `${icons.box} *Productos solicitados:*`,
    "",
    products,
    "",
    separator,
    `${icons.money} *Total del pedido:* ${whatsappMoney(total)}`,
    separator,
    "",
    `${icons.person} *Datos del cliente:*`,
    "",
    `${icons.pin} Nombre: ${name}`,
    `${icons.phone} Tel\u00E9fono: ${phone}`,
    `${icons.city} Ciudad: ${city}`,
    `${icons.house} Direcci\u00F3n: ${address}`,
    "",
    `${icons.note} *Notas del cliente:*`,
    notes || "Sin notas.",
    "",
    separator,
    `${icons.check} Pedido enviado desde la p\u00E1gina de *MA&LUMAKEUP*.`
  ].filter(Boolean).join("\n");
  window.open(`https://api.whatsapp.com/send?phone=${sellerWhatsApp}&text=${encodeURIComponent(message)}`, "_blank");
}
function applyViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem("maluViewMode", mode);
  document.body.classList.toggle("view-mobile", mode === "mobile");
  document.body.classList.toggle("view-desktop", mode === "desktop");
  byId("deviceGate").classList.add("hidden");
}

function initViewMode() {
  if (state.viewMode) {
    applyViewMode(state.viewMode);
    return;
  }
  byId("deviceGate").classList.remove("hidden");
}

function openAdminPanel() {
  adminPanel.classList.add("open");
  scrim.classList.add("open");
  adminPanel.setAttribute("aria-hidden", "false");
  byId("adminUser").focus();
  renderAdminList();
}

function closeAdminPanel() {
  adminPanel.classList.remove("open");
  adminPanel.setAttribute("aria-hidden", "true");
  if (!cartPanel.classList.contains("open") && !productModal.classList.contains("open")) scrim.classList.remove("open");
}

function loginAdmin() {
  const user = byId("adminUser").value.trim();
  const pass = byId("adminPass").value.trim();
  if (user === "IvanaLucia1023" && pass === "Sistemas020919**") {
    state.adminLoggedIn = true;
    byId("adminLogin").hidden = true;
    byId("adminEditor").hidden = false;
    byId("loginMessage").textContent = "";
    renderAdminList();
    return;
  }
  byId("loginMessage").textContent = "Usuario o clave incorrectos.";
}

function renderAdminList() {
  if (!state.adminLoggedIn) return;
  const query = normalize(state.adminQuery);
  const products = PRODUCTS.filter((product) => !query || normalize(`${product.name} ${product.sku}`).includes(query)).slice(0, 80);
  byId("adminList").innerHTML = products.map((product) => `
    <article class="admin-row">
      <img src="${product.image}" alt="">
      <div>
        <strong>${product.name}</strong>
        <small>${product.sku || product.category}</small>
      </div>
      <label>
        Precio
        <input class="admin-price-input" type="number" min="0" step="100" value="${productPrice(product)}" data-id="${product.id}">
      </label>
    </article>
  `).join("");
}

document.addEventListener("click", (event) => {
  const addButton = event.target.closest(".add-button");
  if (addButton) {
    const product = PRODUCTS.find((item) => item.id === addButton.dataset.id);
    if (product) addProductToCart(product);
    event.stopPropagation();
    return;
  }

  const productCard = event.target.closest(".product-card");
  if (productCard) {
    const product = PRODUCTS.find((item) => item.id === productCard.dataset.id);
    if (product) openProductModal(product);
    return;
  }

  const navButton = event.target.closest(".nav-pill");
  if (navButton) {
    document.querySelectorAll(".nav-pill").forEach((button) => button.classList.remove("active"));
    navButton.classList.add("active");
    state.category = navButton.dataset.category;
    categorySelect.value = "Todas";
    renderCatalog();
    document.querySelector("#catalogo").scrollIntoView({ behavior: "smooth" });
  }

  const variantButton = event.target.closest(".variant-chip");
  if (variantButton && state.selectedProduct) {
    const variant = (state.selectedProduct.variants || []).find((item) => item.id === variantButton.dataset.variant);
    if (variant) setModalVariant(variant);
  }

  const qtyButton = event.target.closest(".qty-button, .qty-remove");
  if (qtyButton) {
    changeCartItem(qtyButton.dataset.id, qtyButton.dataset.action);
  }

  const adminPriceInput = event.target.closest(".admin-price-input");
  if (adminPriceInput) {
    adminPriceInput.select();
  }
});

document.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;

  const fallbacks = JSON.parse(image.dataset.fallbacks || "[]");
  let index = Number(image.dataset.fallbackIndex || 0) + 1;
  while (index < fallbacks.length && fallbacks[index] === image.src) index += 1;

  if (fallbacks[index]) {
    image.dataset.fallbackIndex = String(index);
    image.src = fallbacks[index];
    return;
  }

  image.dataset.fallbackIndex = String(index);
  image.src = "img/brand-header.png";
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeProductModal();
    closeAdminPanel();
  }
  if (event.key !== "Enter") return;
  const productCard = event.target.closest(".product-card");
  if (productCard) {
    const product = PRODUCTS.find((item) => item.id === productCard.dataset.id);
    if (product) openProductModal(product);
  }
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderCatalog();
});

categorySelect.addEventListener("change", (event) => {
  state.category = event.target.value;
  document.querySelectorAll(".nav-pill").forEach((button) => button.classList.toggle("active", button.dataset.category === "Todas"));
  renderCatalog();
});

priceRange.addEventListener("input", (event) => {
  state.maxPrice = Number(event.target.value);
  priceLabel.textContent = money(state.maxPrice);
  renderCatalog();
});

sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderCatalog();
});

byId("cartButton").addEventListener("click", () => {
  openCart();
});
byId("heroCartButton").addEventListener("click", openCart);
mobileCartButton.addEventListener("click", openCart);

[byId("closeCart"), scrim].forEach((element) => element.addEventListener("click", () => {
  closeCart();
  closeProductModal();
  closeAdminPanel();
  scrim.classList.remove("open");
}));

byId("closeModal").addEventListener("click", closeProductModal);
byId("modalAddButton").addEventListener("click", () => {
  if (state.selectedProduct) {
    addProductToCart(state.selectedProduct, state.selectedVariant);
    closeProductModal();
  }
});

byId("adminButton").addEventListener("click", openAdminPanel);
byId("viewButton").addEventListener("click", () => {
  localStorage.removeItem("maluViewMode");
  state.viewMode = "";
  byId("deviceGate").classList.remove("hidden");
});
byId("closeAdmin").addEventListener("click", closeAdminPanel);
byId("loginButton").addEventListener("click", loginAdmin);
byId("adminPass").addEventListener("keydown", (event) => {
  if (event.key === "Enter") loginAdmin();
});
byId("adminSearch").addEventListener("input", (event) => {
  state.adminQuery = event.target.value;
  renderAdminList();
});
byId("adminList").addEventListener("input", (event) => {
  const input = event.target.closest(".admin-price-input");
  if (!input) return;
  savedPrices[input.dataset.id] = Number(input.value || 0);
  savePrices();
  renderCatalog();
  renderHighlights();
  renderCart();
});
byId("resetPrices").addEventListener("click", () => {
  Object.keys(savedPrices).forEach((key) => delete savedPrices[key]);
  savePrices();
  renderAdminList();
  renderCatalog();
  renderHighlights();
  renderCart();
});
byId("clearCart").addEventListener("click", () => {
  state.cart = [];
  renderCart();
});
byId("sendWhatsApp").addEventListener("click", sendOrderWhatsApp);
document.querySelectorAll(".device-card").forEach((button) => {
  button.addEventListener("click", () => applyViewMode(button.dataset.view));
});

initViewMode();
renderCategories();
renderHighlights();
renderCatalog();
renderCart();
