const SUPABASE_URL = "https://boqhqpawylckzjoskgcp.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvcWhxcGF3eWxja3pqb3NrZ2NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzU4NTcsImV4cCI6MjA3ODExMTg1N30.LzHa6t8OtlYVDKB7ncHCNkpNQnt6JKMLmY9aXpMQDV4"

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let cart = []
let siteConfig = {}
const productColors = {}
let categories = []
let allProducts = []
let currentCategory = "promocoes"

// Declare lucide variable before using it
const lucide = window.lucide

// Scroll Reveal Animation
function initScrollReveal() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed')
      }
    })
  }, observerOptions)

  // Observe all elements with scroll-reveal class
  document.querySelectorAll('.scroll-reveal').forEach(el => {
    observer.observe(el)
  })
}

// Enhanced Scroll Reveal for products
function initProductScrollReveal() {
  const productObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('revealed')
        }, index * 100) // Staggered animation
      }
    })
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -30px 0px'
  })

  // Re-observe products when they're loaded
  const observeProducts = () => {
    document.querySelectorAll('.product-card').forEach(card => {
      card.classList.add('scroll-reveal')
      productObserver.observe(card)
    })
  }

  // Call this after products are loaded
  return observeProducts
}

async function loadCategories() {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("visible", true)
      .order("position", { ascending: true })

    if (error && error.code !== "PGRST116") throw error

    if (data && data.length > 0) {
      categories = data

      // Carregar no menu superior
      const navContainer = document.getElementById("navCategories")
      navContainer.innerHTML = ""

      data.forEach((category) => {
        const li = document.createElement("li")
        li.innerHTML = `<a href="#${category.slug}">${category.name}</a>`
        navContainer.appendChild(li)
      })

      // Carregar nos botões de filtro
      const filterContainer = document.getElementById("categoryFilters")
      filterContainer.innerHTML =
        '<button class="category-btn active" data-category="promocoes">Promoções</button><button class="category-btn" data-category="all">Todos</button>'

      data.forEach((category) => {
        const button = document.createElement("button")
        button.className = "category-btn"
        // Use category.id instead of category.slug for filtering
        button.setAttribute("data-category", category.id)
        button.textContent = category.name
        filterContainer.appendChild(button)
      })

      // Adicionar event listeners aos novos botões
      document.querySelectorAll(".category-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
          document.querySelectorAll(".category-btn").forEach((b) => b.classList.remove("active"))
          this.classList.add("active")
          const category = this.getAttribute("data-category")
          filterProductsByCategory(category)
        })
      })
    }
  } catch (error) {
    console.error("Erro ao carregar categorias:", error)
  }
}

async function loadSiteColorsAndConfig() {
  try {
    const { data, error } = await supabase.from("site_config").select("*").single()

    if (error && error.code !== "PGRST116") throw error

    if (data) {
      siteConfig = data

      if (data.color_primary) {
        document.documentElement.style.setProperty("--color-primary", data.color_primary)
      }
      if (data.color_secondary) {
        document.documentElement.style.setProperty("--color-secondary", data.color_secondary)
      }
      if (data.color_cta) {
        document.documentElement.style.setProperty("--color-cta", data.color_cta)
      }

      if (data.promo_banner) {
        document.getElementById("promoBanner").firstChild.textContent = data.promo_banner + " "
      }

      if (data.hero_title_1) document.getElementById("heroTitle1").textContent = data.hero_title_1
      if (data.hero_title_2) document.getElementById("heroTitle2").textContent = data.hero_title_2
      if (data.hero_subtitle) document.getElementById("heroSubtitle").textContent = data.hero_subtitle
      if (data.hero_button) document.getElementById("heroButton").textContent = data.hero_button
      if (data.hero_image) document.getElementById("heroImage").src = data.hero_image

      updateFooterContact(data)
      updateSocialIcons(data)
    }
  } catch (error) {
    console.error("Erro ao carregar configurações:", error)
  }
}

function updateFooterContact(data) {
  const contactList = document.getElementById("footerContact")
  if (!contactList) return

  contactList.innerHTML = `
        <li class="footer-contact-item">
            <i data-lucide="mail"></i>
            <span>${data.email || "contato@labellawoman.com.br"}</span>
        </li>
        <li class="footer-contact-item">
            <i data-lucide="phone"></i>
            <span>${data.phone || "(11) 99999-9999"}</span>
        </li>
        <li class="footer-contact-item">
            <i data-lucide="clock"></i>
            <span>${data.working_hours || "Seg a Sex: 9h às 18h"}</span>
        </li>
        <li class="footer-contact-item">
            <i data-lucide="map-pin"></i>
            <span>${data.city && data.state ? `${data.city}, ${data.state}` : "São Paulo, SP"}</span>
        </li>
    `
  lucide.createIcons()
}

function updateSocialIcons(data) {
  const socialContainer = document.getElementById("socialIcons")
  if (!socialContainer) return

  socialContainer.innerHTML = ""

  if (data.facebook) {
    socialContainer.innerHTML += `
            <div class="social-icon" onclick="window.open('${data.facebook}', '_blank')">
                <i data-lucide="facebook"></i>
            </div>
        `
  }
  if (data.instagram) {
    socialContainer.innerHTML += `
            <div class="social-icon" onclick="window.open('${data.instagram}', '_blank')">
                <i data-lucide="instagram"></i>
            </div>
        `
  }
  if (data.pinterest) {
    socialContainer.innerHTML += `
            <div class="social-icon" onclick="window.open('${data.pinterest}', '_blank')">
                <i data-lucide="pinterest"></i>
            </div>
        `
  }
  lucide.createIcons()
}

async function loadProductColors() {
  try {
    const { data, error } = await supabase.from("product_colors").select("*")

    if (error && error.code !== "PGRST116") throw error

    if (data) {
      data.forEach((row) => {
        if (!productColors[row.product_id]) {
          productColors[row.product_id] = []
        }
        productColors[row.product_id].push({
          id: row.id,
          name: row.color_name,
          hex: row.color_hex,
        })
      })
    }
  } catch (error) {
    console.error("Erro ao carregar cores:", error)
  }
}

async function loadProducts() {
  const container = document.getElementById("productsContainer")

  try {
    const { data: products, error } = await supabase.from("products").select("*").order("position", { ascending: true })

    if (error) throw error

    if (!products || products.length === 0) {
      container.innerHTML = `
                <div class="loading-state">
                    <p>Nenhum produto disponível no momento.</p>
                </div>
            `
      return
    }

    allProducts = products
    filterProductsByCategory(currentCategory)
  } catch (error) {
    console.error("Erro ao carregar produtos:", error)
    container.innerHTML = `
            <div class="loading-state">
                <p>Erro ao carregar produtos. Por favor, tente novamente mais tarde.</p>
            </div>
        `
  }
}

function filterProductsByCategory(category) {
  currentCategory = category
  const container = document.getElementById("productsContainer")
  let filteredProducts = allProducts

  if (category === "promocoes") {
    // Mostrar apenas produtos com desconto
    filteredProducts = allProducts.filter(
      (product) => product.discount_percentage && Number.parseFloat(product.discount_percentage) > 0,
    )
  } else if (category !== "all") {
    // Filtrar por categoria específica usando category_id
    const categoryId = Number.parseInt(category)
    filteredProducts = allProducts.filter(
      (product) => product.category_id && Number.parseInt(product.category_id) === categoryId,
    )
  }

  displayProducts(filteredProducts, container)
}

function toggleMobileMenu() {
  const navLinks = document.getElementById("navCategories")
  const menuIcon = document.getElementById("menuIcon")

  navLinks.classList.toggle("mobile-open")

  if (navLinks.classList.contains("mobile-open")) {
    menuIcon.setAttribute("data-lucide", "x")
  } else {
    menuIcon.setAttribute("data-lucide", "menu")
  }

  lucide.createIcons()
}

// Fechar menu ao clicar em um link
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.getElementById("navCategories")
  if (navLinks) {
    navLinks.addEventListener("click", (e) => {
      if (e.target.tagName === "A") {
        navLinks.classList.remove("mobile-open")
        document.getElementById("menuIcon").setAttribute("data-lucide", "menu")
        lucide.createIcons()
      }
    })
  }
})

function displayProducts(products, container) {
  if (!products || products.length === 0) {
    container.innerHTML = `
            <div class="loading-state">
                <p>Nenhum produto disponível nesta categoria.</p>
            </div>
        `
    return
  }

  const grid = document.createElement("div")
  grid.className = "products-grid"

  products.forEach((product) => {
    const card = document.createElement("div")
    card.className = "product-card scroll-reveal"
    if (product.sold_out) {
      card.classList.add("sold-out")
    }

    const productUrl = `${window.location.origin}${window.location.pathname}?produto=${product.id}`
    const whatsappMessage = encodeURIComponent(`Olá! Tenho interesse no ${product.name}\\n\\nVer produto: ${productUrl}`)

    let colorsHtml = ""
    if (productColors[product.id] && productColors[product.id].length > 0) {
      colorsHtml = `
                <div class="product-colors">
                    <span class="product-colors-label">Cor disponível:</span>
                    <div class="color-dots-container">
            `
      productColors[product.id].forEach((color) => {
        colorsHtml += `
                    <div class="color-dot" 
                         style="background-color: ${color.hex};" 
                         onclick="selectColor(this, '${product.id}', '${color.name}', '${color.hex}')"
                         title="${color.name}">
                    </div>
                `
      })
      colorsHtml += "</div></div>"
    }

    card.innerHTML = `
            <div class="product-image" onclick="openFullscreen('${product.image_url}')">
                <img src="${product.image_url}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/400x400?text=Sem+Imagem'">
                ${product.discount_percentage ? `<span class="discount-badge">-${product.discount_percentage}%</span>` : ""}
                ${product.sold_out ? '<div class="sold-out-badge">ESGOTADO</div>' : ""}
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                ${colorsHtml}
                <div class="price-container">
                    <span class="old-price">R$ ${Number.parseFloat(product.old_price).toFixed(2).replace(".", ",")}</span>
                    <span class="new-price">R$ ${Number.parseFloat(product.new_price).toFixed(2).replace(".", ",")}</span>
                </div>
                <div class="product-actions">
                    <button class="buy-button" ${product.sold_out ? "disabled" : ""} onclick='addToCart(${JSON.stringify(product).replace(/'/g, "&apos;")})'>
                        <i data-lucide="shopping-cart" style="width: 20px; height: 20px;"></i>
                        ${product.sold_out ? "Indisponível" : "Adicionar"}
                    </button>
                    <button class="share-button" onclick='shareProduct(${JSON.stringify(product).replace(/'/g, "&apos;")})' title="Compartilhar">
                        <i data-lucide="share-2" style="width: 20px; height: 20px;"></i>
                    </button>
                </div>
            </div>
        `

    grid.appendChild(card)
  })

  container.innerHTML = ""
  container.appendChild(grid)

  lucide.createIcons()
  
  // Initialize scroll reveal for new products
  setTimeout(() => {
    initProductScrollReveal()()
  }, 100)
}

function selectColor(element, productId, colorName, colorHex) {
  const colors = element.parentElement.querySelectorAll(".color-dot")
  colors.forEach((c) => c.classList.remove("selected"))
  element.classList.add("selected")

  window.selectedProductColors = window.selectedProductColors || {}
  window.selectedProductColors[productId] = { name: colorName, hex: colorHex }
}

function addToCart(product) {
  if (product.sold_out) return

  const productColorOptions = productColors[product.id]
  if (productColorOptions && productColorOptions.length > 0) {
    const selectedColor = window.selectedProductColors?.[product.id]
    if (selectedColor) {
      product.selectedColor = selectedColor
    }
  }

  const existingItem = cart.find(
    (item) => item.id === product.id && item.selectedColor?.name === product.selectedColor?.name,
  )

  if (existingItem) {
    existingItem.quantity++
  } else {
    cart.push({ ...product, quantity: 1 })
  }

  updateCartBadge()

  const audio = new Audio(
    "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURU=",
  )
  audio.play().catch(() => {})

  showFloatingCart(product)
}

function showFloatingCart(product) {
  const notification = document.getElementById("floatingCartNotification")
  const productName = document.getElementById("notificationProductName")
  const productPrice = document.getElementById("notificationProductPrice")

  // Update notification content
  productName.textContent = product.name.length > 25 ? product.name.substring(0, 22) + "..." : product.name
  productPrice.textContent = `R$ ${Number.parseFloat(product.new_price).toFixed(2).replace(".", ",")}`

  // Show notification with enhanced animation
  notification.classList.add("show")
  notification.classList.add("success")

  // Auto-hide after 5 seconds
  clearTimeout(notification.hideTimeout)
  notification.hideTimeout = setTimeout(() => {
    notification.classList.remove("show")
    notification.classList.remove("success")
  }, 5000)
}

function closeFloatingCart() {
  const notification = document.getElementById("floatingCartNotification")
  notification.classList.remove("show")
  notification.classList.remove("success")
  clearTimeout(notification.hideTimeout)
}

function updateCartBadge() {
  const badge = document.getElementById("cartBadge")
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  badge.textContent = totalItems
  
  // Add pulse animation to cart badge
  if (totalItems > 0) {
    badge.style.animation = 'cartPulse 0.6s ease-out'
    setTimeout(() => {
      badge.style.animation = ''
    }, 600)
  }
}

function openCart() {
  if (cart.length === 0) {
    alert("Seu carrinho está vazio!")
    return
  }

  const checkoutItems = document.getElementById("checkoutItems")
  checkoutItems.innerHTML = ""
  let total = 0

  cart.forEach((item, index) => {
    const subtotal = item.new_price * item.quantity
    total += subtotal

    const itemRow = document.createElement("div")
    itemRow.className = "cart-item-row"
    itemRow.innerHTML = `
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                ${
                  item.selectedColor
                    ? `
                    <div class="cart-item-color">
                        <span class="cart-item-color-dot" style="background-color: ${item.selectedColor.hex}"></span>
                        ${item.selectedColor.name}
                    </div>
                `
                    : ""
                }
            </div>
            <div class="cart-item-qty">x${item.quantity}</div>
            <div class="cart-item-price">R$ ${subtotal.toFixed(2).replace(".", ",")}</div>
            <button class="cart-item-remove" onclick="removeFromCart(${index})" title="Remover item">
                <i data-lucide="trash-2" style="width: 20px; height: 20px;"></i>
            </button>
        `
    checkoutItems.appendChild(itemRow)
  })

  document.getElementById("checkoutTotal").textContent = `R$ ${total.toFixed(2).replace(".", ",")}`
  document.getElementById("checkoutModal").classList.add("active")
  lucide.createIcons()
}

function removeFromCart(index) {
  cart.splice(index, 1)
  updateCartBadge()

  if (cart.length === 0) {
    closeCheckout()
  } else {
    openCart()
  }

  showNotification("Item removido do carrinho")
}

function closeCheckout() {
  document.getElementById("checkoutModal").classList.remove("active")
}

function finalizarPedidoWhatsApp() {
  let message = "🛍️ *Meu Pedido - Labella Woman*\n\n"
  let total = 0

  cart.forEach((item, index) => {
    const subtotal = item.new_price * item.quantity
    total += subtotal
    message += `*${index + 1}. ${item.name}*\n`
    if (item.selectedColor) {
      message += `🎨 Cor: ${item.selectedColor.name}\n`
    }
    message += `📦 Qtd: ${item.quantity}\n`
    message += `💰 Preço: R$ ${Number.parseFloat(item.new_price).toFixed(2).replace(".", ",")}\n`
    message += `💵 Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}\n\n`
  })

  message += `━━━━━━━━━━━━━━━\n`
  message += `*💳 TOTAL: R$ ${total.toFixed(2).replace(".", ",")}*\n\n`
  message += `Gostaria de finalizar este pedido! 😊`

  const whatsapp = siteConfig.whatsapp || "+5511999999999"
  const whatsappClean = whatsapp.replace(/\\D/g, "")
  const encodedMessage = encodeURIComponent(message)

  window.open(`https://wa.me/${whatsappClean}?text=${encodedMessage}`, "_blank")

  setTimeout(() => {
    cart = []
    window.selectedProductColors = {}
    updateCartBadge()
    closeCheckout()
    showNotification("Pedido enviado! Obrigada pela compra!")
  }, 500)
}

function shareProduct(product) {
  const productUrl = `${window.location.origin}${window.location.pathname}?produto=${product.id}`
  const shareMessage = `Estou compartilhando esse produto da Labella Woman com 10% de desconto!\\n\\n${product.name}\\n\\n${productUrl}`

  const whatsapp = siteConfig.whatsapp || "+5511999999999"
  const whatsappClean = whatsapp.replace(/\\D/g, "")
  const encodedMessage = encodeURIComponent(shareMessage)

  window.open(`https://wa.me/${whatsappClean}?text=${encodedMessage}`, "_blank")

  showNotification("Compartilhando produto via WhatsApp!")
}

function openWhatsApp() {
  const whatsapp = siteConfig.whatsapp || "+5511999999999"
  const whatsappClean = whatsapp.replace(/\\D/g, "")
  const message = encodeURIComponent("Olá! Gostaria de saber mais sobre os produtos da Labella Woman.")
  window.open(`https://wa.me/${whatsappClean}?text=${message}`, "_blank")
}

function openFullscreen(imageUrl) {
  event.stopPropagation()
  document.getElementById("fullscreenImage").src = imageUrl
  document.getElementById("fullscreenModal").classList.add("active")
}

function closeFullscreen() {
  document.getElementById("fullscreenModal").classList.remove("active")
}

function showNotification(message) {
  const notification = document.createElement("div")
  notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 5px 20px rgba(212, 20, 90, 0.4);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
    `
  notification.textContent = message

  const style = document.createElement("style")
  style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `
  document.head.appendChild(style)

  document.body.appendChild(notification)

  setTimeout(() => {
    notification.style.animation = "slideIn 0.3s ease-out reverse"
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize scroll reveal first
  initScrollReveal()
  
  await loadCategories()
  loadSiteColorsAndConfig()
  await loadProductColors()
  await loadProducts()
  lucide.createIcons()

  const urlParams = new URLSearchParams(window.location.search)
  const productId = urlParams.get("produto")

  if (productId) {
    setTimeout(() => {
      const productCards = document.querySelectorAll(".product-card")
      productCards.forEach((card) => {
        if (card.innerHTML.includes(productId)) {
          card.scrollIntoView({ behavior: "smooth", block: "center" })
          card.style.animation = "pulse 1s ease-in-out 3"
        }
      })
    }, 1000)
  }
})

setInterval(loadProducts, 30000)
