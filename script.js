let cart = []
let siteConfig = {}
const productColors = {}
let categories = []
let allProducts = []
let currentCategory = "all"
let lastProductsSnapshot = null
let productImageIntervals = []

// Declare lucide variable before using it
const lucide = window.lucide

// Barra de progresso de leitura + nav com sombra ao rolar
function initScrollEffects() {
  const progressBar = document.getElementById("scrollProgressBar")
  const nav = document.getElementById("siteNav")

  function onScroll() {
    if (progressBar) {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
      progressBar.style.width = progress + "%"
    }

    if (nav) {
      nav.classList.toggle("nav-scrolled", window.scrollY > 30)
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true })
  onScroll()
}

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
        }, index * 40) // Staggered animation
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
    const response = await fetch("/api/categories")
    if (!response.ok) throw new Error("Erro ao carregar categorias")
    const data = await response.json()

    if (data && data.length > 0) {
      categories = data

      // Carregar no menu superior
      const navContainer = document.getElementById("navCategories")
      navContainer.innerHTML = ""

      data.forEach((category) => {
        const li = document.createElement("li")
        const link = document.createElement("a")
        link.href = "#novidades"
        link.textContent = category.name
        link.addEventListener("click", (e) => {
          e.preventDefault()
          selectCategory(String(category.id))
        })
        li.appendChild(link)
        navContainer.appendChild(li)
      })

      // Carregar nos botões de filtro
      const filterContainer = document.getElementById("categoryFilters")
      filterContainer.innerHTML =
        '<button class="category-btn" data-category="promocoes">Promoções</button><button class="category-btn active" data-category="all">Todos</button>'

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
          selectCategory(this.getAttribute("data-category"))
        })
      })
    }
  } catch (error) {
    console.error("Erro ao carregar categorias:", error)
  }
}

// Filtra por categoria, sincroniza o botão ativo e rola até os resultados.
// Antes, clicar numa categoria (pelo menu de cima ou pelos botões) não levava
// o usuário até os produtos filtrados — o menu de cima nem funcionava (o link
// apontava para uma âncora que não existia) e os botões filtravam sem rolar,
// então quem clicava ficava "perdido" na página.
function selectCategory(category) {
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-category") === category)
  })
  filterProductsByCategory(category)
  scrollToProductsSection()
}

function scrollToProductsSection() {
  const section = document.getElementById("novidades")
  if (!section) return

  const nav = document.getElementById("siteNav")
  const navHeight = nav ? nav.offsetHeight : 0
  const top = section.getBoundingClientRect().top + window.scrollY - navHeight - 16

  window.scrollTo({ top, behavior: "smooth" })
}

async function loadSiteColorsAndConfig() {
  try {
    const response = await fetch("/api/site-config")
    if (!response.ok) throw new Error("Erro ao carregar configurações")
    const data = await response.json()

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

      document.body.classList.toggle("theme-dark", data.theme_mode === "dark")

      if (data.store_name) {
        document.getElementById("siteLogo").textContent = data.store_name
        document.title = `${data.store_name} | Coleção Cristã`
      }

      if (data.promo_banner) {
        document.getElementById("promoBanner").firstChild.textContent = data.promo_banner + " "
      }

      if (data.hero_title_1) document.getElementById("heroTitle1").textContent = data.hero_title_1
      if (data.hero_title_2) document.getElementById("heroTitle2").textContent = data.hero_title_2
      if (data.hero_subtitle) document.getElementById("heroSubtitle").textContent = data.hero_subtitle
      if (data.hero_button) document.getElementById("heroButton").textContent = data.hero_button
      if (data.hero_image) document.getElementById("heroImage").src = data.hero_image

      if (data.feature1_title) document.getElementById("feature1Title").textContent = data.feature1_title
      if (data.feature1_desc) document.getElementById("feature1Desc").textContent = data.feature1_desc
      if (data.feature2_title) document.getElementById("feature2Title").textContent = data.feature2_title
      if (data.feature2_desc) document.getElementById("feature2Desc").textContent = data.feature2_desc
      if (data.feature3_title) document.getElementById("feature3Title").textContent = data.feature3_title
      if (data.feature3_desc) document.getElementById("feature3Desc").textContent = data.feature3_desc
      if (data.feature4_title) document.getElementById("feature4Title").textContent = data.feature4_title
      if (data.feature4_desc) document.getElementById("feature4Desc").textContent = data.feature4_desc

      const videoSection = document.getElementById("featureVideoSection")
      if (videoSection) {
        if (data.feature_video_url) {
          document.getElementById("featureVideoPlayer").src = data.feature_video_url
          if (data.feature_video_title) {
            document.getElementById("featureVideoTitle").textContent = data.feature_video_title
          }
          videoSection.style.display = ""
        } else {
          videoSection.style.display = "none"
        }
      }

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
            <span>${data.email || "contato@sela.com.br"}</span>
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
    const response = await fetch("/api/product-colors")
    if (!response.ok) throw new Error("Erro ao carregar cores")
    const data = await response.json()

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
    const response = await fetch("/api/products")
    if (!response.ok) throw new Error("Erro ao carregar produtos")
    const products = await response.json()

    if (!products || products.length === 0) {
      container.innerHTML = `
                <div class="loading-state">
                    <p>Nenhum produto disponível no momento.</p>
                </div>
            `
      return
    }

    // A cada 30s o site busca os produtos de novo para refletir mudanças feitas
    // no painel. Antes disso recriava a grade inteira sempre, mesmo sem nada
    // ter mudado — isso causava o "piscar" da página. Agora só redesenha a
    // grade quando os dados realmente mudaram.
    const snapshot = JSON.stringify(products)
    if (snapshot === lastProductsSnapshot) {
      return
    }
    lastProductsSnapshot = snapshot

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
  // Zera os intervalos de troca automática de imagem da renderização anterior,
  // senão eles continuam rodando em segundo plano mesmo depois que os cards
  // antigos são substituídos (vazamento de memória + processamento à toa).
  productImageIntervals.forEach(clearInterval)
  productImageIntervals = []

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
    const whatsappMessage = encodeURIComponent(`Olá! Tenho interesse no ${product.name}\n\nVer produto: ${productUrl}`)

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

    const hasSecondImage = !!product.image_url_2
    const imageDotsHtml = hasSecondImage
      ? `
                <div class="product-image-dots" onclick="event.stopPropagation()">
                    <button type="button" class="product-image-dot active" onclick="switchProductImage(this, '${product.image_url}')" aria-label="Foto 1"></button>
                    <button type="button" class="product-image-dot" onclick="switchProductImage(this, '${product.image_url_2}')" aria-label="Foto 2"></button>
                </div>
            `
      : ""

    const sizeHtml = product.size
      ? `
                <div class="product-size">
                    <span class="product-size-label">Tamanho:</span> ${product.size}
                </div>
            `
      : ""

    card.innerHTML = `
            <div class="product-image" onclick="openFullscreen(this)" ${hasSecondImage ? `data-images='${JSON.stringify([product.image_url, product.image_url_2]).replace(/'/g, "&apos;")}'` : ""}>
                <img src="${product.image_url}" alt="${product.name}" loading="lazy" decoding="async" onerror="this.src='https://via.placeholder.com/400x400?text=Sem+Imagem'">
                ${product.discount_percentage ? `<span class="discount-badge">-${product.discount_percentage}%</span>` : ""}
                ${product.sold_out ? '<div class="sold-out-badge">ESGOTADO</div>' : ""}
                ${product.video_url ? `<button type="button" class="video-badge" onclick="event.stopPropagation(); openProductVideo('${product.video_url}')" title="Assistir vídeo"><i data-lucide="play" style="width: 16px; height: 16px;"></i></button>` : ""}
                ${imageDotsHtml}
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                ${sizeHtml}
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

  container.querySelectorAll(".product-image[data-images]").forEach((imageWrapper) => {
    startProductImageCycle(imageWrapper)
  })

  lucide.createIcons()
  
  // Initialize scroll reveal for new products
  setTimeout(() => {
    initProductScrollReveal()()
  }, 100)
}

// Troca automaticamente entre as fotos do produto (quando há uma segunda foto
// cadastrada), do mesmo jeito que o fundo do hero já fazia. Pausa quando o
// mouse está em cima do card, pra não atrapalhar quem está olhando a foto.
function startProductImageCycle(imageWrapper) {
  let images = []
  try {
    images = JSON.parse(imageWrapper.dataset.images || "[]")
  } catch (error) {
    images = []
  }
  if (images.length < 2) return

  imageWrapper.dataset.currentIndex = "0"

  function tick() {
    const current = Number(imageWrapper.dataset.currentIndex || "0")
    const next = (current + 1) % images.length
    imageWrapper.dataset.currentIndex = String(next)

    const img = imageWrapper.querySelector("img")
    if (img) {
      img.style.opacity = "0"
      setTimeout(() => {
        img.src = images[next]
        img.style.opacity = "1"
      }, 200)
    }

    imageWrapper.querySelectorAll(".product-image-dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === next)
    })
  }

  function start() {
    stopProductImageCycle(imageWrapper)
    const intervalId = setInterval(tick, 3500)
    imageWrapper.dataset.cycleId = String(intervalId)
    productImageIntervals.push(intervalId)
  }

  imageWrapper.addEventListener("mouseenter", () => stopProductImageCycle(imageWrapper))
  imageWrapper.addEventListener("mouseleave", start)

  start()
}

function stopProductImageCycle(imageWrapper) {
  const id = Number(imageWrapper.dataset.cycleId || "0")
  if (id) {
    clearInterval(id)
    productImageIntervals = productImageIntervals.filter((existingId) => existingId !== id)
    imageWrapper.dataset.cycleId = ""
  }
}

function switchProductImage(dotEl, imageUrl) {
  const imageWrapper = dotEl.closest(".product-image")
  if (!imageWrapper) return

  const img = imageWrapper.querySelector("img")
  if (img) img.src = imageUrl

  const dots = Array.from(imageWrapper.querySelectorAll(".product-image-dot"))
  dots.forEach((dot) => dot.classList.remove("active"))
  dotEl.classList.add("active")
  imageWrapper.dataset.currentIndex = String(dots.indexOf(dotEl))
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
  let message = "🛍️ *Meu Pedido - Selá*\n\n"
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
  const whatsappClean = whatsapp.replace(/\D/g, "")
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
  const shareMessage = `Estou compartilhando esse produto da Selá com 10% de desconto!\n\n${product.name}\n\n${productUrl}`

  const whatsapp = siteConfig.whatsapp || "+5511999999999"
  const whatsappClean = whatsapp.replace(/\D/g, "")
  const encodedMessage = encodeURIComponent(shareMessage)

  window.open(`https://wa.me/${whatsappClean}?text=${encodedMessage}`, "_blank")

  showNotification("Compartilhando produto via WhatsApp!")
}

function openWhatsApp() {
  const whatsapp = siteConfig.whatsapp || "+5511999999999"
  const whatsappClean = whatsapp.replace(/\D/g, "")
  const message = encodeURIComponent("Olá! Gostaria de saber mais sobre os produtos da Selá.")
  window.open(`https://wa.me/${whatsappClean}?text=${message}`, "_blank")
}

let fullscreenImages = []
let fullscreenIndex = 0

function openFullscreen(source) {
  if (event) event.stopPropagation()

  let images = []
  if (typeof source === "string") {
    images = [source]
  } else if (source) {
    try {
      images = JSON.parse(source.dataset.images || "[]")
    } catch (error) {
      images = []
    }
    if (images.length === 0) {
      const currentImg = source.querySelector("img")
      if (currentImg) images = [currentImg.src]
    }
  }
  if (images.length === 0) return

  fullscreenImages = images

  // Abre já na foto que estava sendo exibida no card (pode não ser a primeira,
  // se a troca automática já tiver avançado pra segunda foto).
  const currentImg = source && source.querySelector ? source.querySelector("img") : null
  fullscreenIndex = currentImg ? Math.max(0, images.indexOf(currentImg.src)) : 0

  const video = document.getElementById("fullscreenVideo")
  video.pause()
  video.style.display = "none"
  video.src = ""

  document.getElementById("fullscreenImage").style.display = "block"
  renderFullscreenImage()

  document.getElementById("fullscreenModal").classList.add("active")
}

function renderFullscreenImage() {
  const img = document.getElementById("fullscreenImage")
  img.style.transform = ""
  img.classList.remove("dragging")
  img.src = fullscreenImages[fullscreenIndex]

  const hasMultiple = fullscreenImages.length > 1
  const prevBtn = document.getElementById("fullscreenPrev")
  const nextBtn = document.getElementById("fullscreenNext")
  const dotsContainer = document.getElementById("fullscreenDots")

  prevBtn.style.display = hasMultiple ? "flex" : "none"
  nextBtn.style.display = hasMultiple ? "flex" : "none"

  dotsContainer.innerHTML = ""
  if (hasMultiple) {
    fullscreenImages.forEach((_, i) => {
      const dot = document.createElement("button")
      dot.type = "button"
      dot.className = "fullscreen-dot" + (i === fullscreenIndex ? " active" : "")
      dot.setAttribute("aria-label", `Foto ${i + 1}`)
      dot.onclick = () => {
        fullscreenIndex = i
        renderFullscreenImage()
      }
      dotsContainer.appendChild(dot)
    })
  }
}

function fullscreenGoToNext() {
  if (fullscreenImages.length < 2) return
  fullscreenIndex = (fullscreenIndex + 1) % fullscreenImages.length
  renderFullscreenImage()
}

function fullscreenGoToPrev() {
  if (fullscreenImages.length < 2) return
  fullscreenIndex = (fullscreenIndex - 1 + fullscreenImages.length) % fullscreenImages.length
  renderFullscreenImage()
}

// Arrastar (touch e mouse) na imagem em tela cheia pra trocar de foto.
function initFullscreenSwipe() {
  const img = document.getElementById("fullscreenImage")
  if (!img) return

  let startX = 0
  let currentX = 0
  let dragging = false

  function dragStart(x) {
    if (fullscreenImages.length < 2) return
    dragging = true
    startX = x
    currentX = x
    img.classList.add("dragging")
  }

  function dragMove(x) {
    if (!dragging) return
    currentX = x
    img.style.transform = `translateX(${currentX - startX}px)`
  }

  function dragEnd() {
    if (!dragging) return
    dragging = false
    img.classList.remove("dragging")

    const delta = currentX - startX
    const threshold = 60

    if (delta > threshold) {
      fullscreenGoToPrev()
    } else if (delta < -threshold) {
      fullscreenGoToNext()
    } else {
      img.style.transform = ""
    }
  }

  img.addEventListener("touchstart", (e) => dragStart(e.touches[0].clientX), { passive: true })
  img.addEventListener("touchmove", (e) => dragMove(e.touches[0].clientX), { passive: true })
  img.addEventListener("touchend", dragEnd)

  img.addEventListener("mousedown", (e) => {
    e.preventDefault()
    dragStart(e.clientX)
  })
  window.addEventListener("mousemove", (e) => dragMove(e.clientX))
  window.addEventListener("mouseup", dragEnd)

  img.addEventListener("click", (e) => e.stopPropagation())
}

document.addEventListener("DOMContentLoaded", initFullscreenSwipe)

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("fullscreenModal")
  if (!modal || !modal.classList.contains("active")) return
  if (e.key === "ArrowRight") fullscreenGoToNext()
  if (e.key === "ArrowLeft") fullscreenGoToPrev()
  if (e.key === "Escape") closeFullscreen()
})

function openProductVideo(videoUrl) {
  if (event) event.stopPropagation()

  document.getElementById("fullscreenImage").style.display = "none"
  document.getElementById("fullscreenPrev").style.display = "none"
  document.getElementById("fullscreenNext").style.display = "none"
  document.getElementById("fullscreenDots").innerHTML = ""
  fullscreenImages = []

  const video = document.getElementById("fullscreenVideo")
  video.style.display = "block"
  video.src = videoUrl
  video.currentTime = 0
  video.play().catch(() => {})

  document.getElementById("fullscreenModal").classList.add("active")
}

function closeFullscreen() {
  document.getElementById("fullscreenModal").classList.remove("active")

  const video = document.getElementById("fullscreenVideo")
  video.pause()
  video.style.display = "none"

  const img = document.getElementById("fullscreenImage")
  img.style.display = "block"
  img.style.transform = ""
  img.classList.remove("dragging")

  fullscreenImages = []
  fullscreenIndex = 0
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

// ===================== Carrossel de banners =====================
let carouselBanners = []
let carouselIndex = 0
let carouselTimer = null
let heroBgIndex = 0
let heroBgTimer = null

async function loadBanners() {
  try {
    const response = await fetch("/api/banners")
    if (!response.ok) throw new Error("Erro ao carregar banners")
    carouselBanners = (await response.json()) || []
    renderCarousel()
    renderHeroBackground()
  } catch (error) {
    console.error("Erro ao carregar banners:", error)
  }
}

function renderCarousel() {
  const section = document.getElementById("bannerCarouselSection")
  const track = document.getElementById("carouselTrack")
  const dotsContainer = document.getElementById("carouselDots")
  if (!section || !track || !dotsContainer) return

  if (!carouselBanners.length) {
    section.style.display = "none"
    stopCarouselAutoplay()
    return
  }

  section.style.display = ""
  track.innerHTML = ""
  dotsContainer.innerHTML = ""

  carouselBanners.forEach((banner, index) => {
    const slide = document.createElement("div")
    slide.className = "carousel-slide"
    const imgHtml = `<img src="${banner.image_url}" alt="Banner ${index + 1}">`
    slide.innerHTML = banner.link_url
      ? `<a href="${banner.link_url}" target="_blank" rel="noopener">${imgHtml}</a>`
      : imgHtml
    track.appendChild(slide)

    const dot = document.createElement("button")
    dot.type = "button"
    dot.className = "carousel-dot" + (index === 0 ? " active" : "")
    dot.setAttribute("aria-label", `Ir para o banner ${index + 1}`)
    dot.onclick = () => goToSlide(index)
    dotsContainer.appendChild(dot)
  })

  // Com um único banner, não faz sentido mostrar setas/dots nem autoplay
  const showControls = carouselBanners.length > 1
  section.querySelectorAll(".carousel-arrow").forEach((arrow) => {
    arrow.style.display = showControls ? "flex" : "none"
  })
  dotsContainer.style.display = showControls ? "flex" : "none"

  carouselIndex = 0
  updateCarouselPosition()

  if (showControls) {
    startCarouselAutoplay()
  } else {
    stopCarouselAutoplay()
  }
}

function updateCarouselPosition() {
  const track = document.getElementById("carouselTrack")
  if (!track) return
  track.style.transform = `translateX(-${carouselIndex * 100}%)`

  document.querySelectorAll("#carouselDots .carousel-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === carouselIndex)
  })
}

function goToSlide(index) {
  carouselIndex = index
  updateCarouselPosition()
  restartCarouselAutoplay()
}

function carouselNext() {
  if (!carouselBanners.length) return
  carouselIndex = (carouselIndex + 1) % carouselBanners.length
  updateCarouselPosition()
  restartCarouselAutoplay()
}

function carouselPrev() {
  if (!carouselBanners.length) return
  carouselIndex = (carouselIndex - 1 + carouselBanners.length) % carouselBanners.length
  updateCarouselPosition()
  restartCarouselAutoplay()
}

function startCarouselAutoplay() {
  stopCarouselAutoplay()
  carouselTimer = setInterval(carouselNext, 5000)
}

function stopCarouselAutoplay() {
  if (carouselTimer) {
    clearInterval(carouselTimer)
    carouselTimer = null
  }
}

function restartCarouselAutoplay() {
  if (carouselBanners.length > 1) startCarouselAutoplay()
}

// Fundo do Hero: as mesmas imagens do carrossel, desfocadas e em crossfade lento
function renderHeroBackground() {
  const bgLayer = document.getElementById("heroBgLayer")
  if (!bgLayer) return

  bgLayer.innerHTML = ""
  stopHeroBgCycle()

  if (!carouselBanners.length) return

  carouselBanners.forEach((banner, index) => {
    const img = document.createElement("img")
    img.src = banner.image_url
    img.alt = ""
    if (index === 0) img.classList.add("active")
    bgLayer.appendChild(img)
  })

  heroBgIndex = 0

  if (carouselBanners.length > 1) {
    startHeroBgCycle()
  }
}

function startHeroBgCycle() {
  stopHeroBgCycle()
  heroBgTimer = setInterval(() => {
    const imgs = document.querySelectorAll("#heroBgLayer img")
    if (imgs.length < 2) return
    imgs[heroBgIndex].classList.remove("active")
    heroBgIndex = (heroBgIndex + 1) % imgs.length
    imgs[heroBgIndex].classList.add("active")
  }, 5000)
}

function stopHeroBgCycle() {
  if (heroBgTimer) {
    clearInterval(heroBgTimer)
    heroBgTimer = null
  }
}

async function handleNewsletterSubmit(event) {
  event.preventDefault()

  const emailInput = document.getElementById("newsletterEmail")
  const whatsappInput = document.getElementById("newsletterWhatsapp")
  const button = document.getElementById("newsletterButton")

  const email = emailInput.value.trim()
  const whatsapp = whatsappInput.value.trim()

  const originalText = button.textContent
  button.disabled = true
  button.textContent = "Enviando..."

  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, whatsapp }),
    })

    if (!response.ok) throw new Error("Erro ao cadastrar")

    alert("Obrigada por se cadastrar!")
    emailInput.value = ""
    whatsappInput.value = "+55 "
  } catch (error) {
    console.error("Erro ao enviar cadastro:", error)
    alert("Não foi possível concluir o cadastro. Tente novamente em instantes.")
  } finally {
    button.disabled = false
    button.textContent = originalText
  }
}

// Fundo animado 3D — flutuação suave + paralaxe pelo mouse nas orbes de fundo
function initAmbientBackground() {
  const orbs = document.querySelectorAll(".ambient-orb")
  if (!orbs.length) return

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches

  // Cada orbe recebe uma "profundidade" diferente: quanto maior, mais ela
  // se move com o mouse e o tempo — cria a ilusão de camadas em 3D.
  const orbConfigs = Array.from(orbs).map((el, i) => ({
    el,
    depth: 0.5 + i * 0.35, // 0.5, 0.85, 1.2, 1.55
    phase: i * 2.1,
    floatRange: 26 + i * 6,
  }))

  if (prefersReducedMotion) return // mantém as orbes paradas, sem animação

  // Em celulares (touch), o mouse-parallax não faz sentido mesmo, e essa
  // animação contínua (a cada quadro, para sempre) compete com o carregamento
  // da página pelo processamento do aparelho — isso pesa bastante mais no
  // Chrome do Android do que no Safari do iPhone. Por isso, em touch, as
  // orbes ficam paradas (só o CSS, sem esse loop de JS).
  if (isTouchDevice) return

  let mouseX = 0
  let mouseY = 0
  let targetX = 0
  let targetY = 0

  window.addEventListener(
    "mousemove",
    (e) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2 // -1 a 1
      targetY = (e.clientY / window.innerHeight - 0.5) * 2
    },
    { passive: true },
  )

  let frame = 0
  function animateAmbient() {
    frame++
    // Suaviza o movimento do mouse (easing) para não ficar brusco
    mouseX += (targetX - mouseX) * 0.04
    mouseY += (targetY - mouseY) * 0.04

    const t = frame * 0.006
    orbConfigs.forEach(({ el, depth, phase, floatRange }) => {
      const floatX = Math.sin(t + phase) * floatRange
      const floatY = Math.cos(t * 0.8 + phase) * floatRange
      const parallaxX = mouseX * 30 * depth
      const parallaxY = mouseY * 30 * depth
      const z = Math.sin(t * 0.5 + phase) * 40 * depth

      el.style.transform = `translate3d(${floatX + parallaxX}px, ${floatY + parallaxY}px, ${z}px)`
    })

    requestAnimationFrame(animateAmbient)
  }

  requestAnimationFrame(animateAmbient)
}

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize scroll reveal first
  initScrollReveal()
  initScrollEffects()
  initAmbientBackground()
  requestAnimationFrame(() => document.body.classList.add("loaded"))

  const carouselViewport = document.getElementById("carouselViewport")
  if (carouselViewport) {
    carouselViewport.addEventListener("mouseenter", stopCarouselAutoplay)
    carouselViewport.addEventListener("mouseleave", restartCarouselAutoplay)
  }

  // Essas chamadas são independentes entre si, mas antes rodavam uma atrás da
  // outra (esperando cada uma terminar pra só então começar a próxima), o que
  // multiplicava à toa o tempo até os produtos aparecerem. Agora rodam em
  // paralelo — só os produtos esperam as cores carregarem, porque precisam
  // delas para mostrar as bolinhas de cor certas.
  loadSiteColorsAndConfig()
  loadBanners()
  await Promise.all([loadCategories(), loadProductColors()])
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
