
document.addEventListener('DOMContentLoaded', function() {
  // Show/hide sticky bar based on scroll position
  let lastScrollPosition = window.pageYOffset;
  const showHideStickyBar = () => {
    const currentScrollPosition = window.pageYOffset;
    const mainProductForm = document.querySelector('form[action="/cart/add"]');
    const stickyBar = document.querySelector('.sticky-atc-bar');
    
    if (mainProductForm && stickyBar) {
      const formRect = mainProductForm.getBoundingClientRect();
      const isFormInView = formRect.top >= 0 && formRect.bottom <= window.innerHeight;
      const isFormAboveViewport = formRect.bottom < 0;
      
      // Show when form is above viewport or not fully visible, and we've scrolled enough
      const shouldShow = (isFormAboveViewport || !isFormInView) && currentScrollPosition > 300;
      
      if (shouldShow) {
        stickyBar.classList.add('is-visible');
      } else {
        stickyBar.classList.remove('is-visible');
      }

      // Update aria-hidden based on visibility
      stickyBar.setAttribute('aria-hidden', (!shouldShow).toString());
    }
    
    lastScrollPosition = currentScrollPosition;
  };

  window.addEventListener('scroll', debounce(showHideStickyBar, 100));
  window.addEventListener('resize', debounce(showHideStickyBar, 100));
  

  const stickyATCBar = document.querySelector('.sticky-atc-bar');
  const mainForm = document.querySelector('#AddToCartForm') || document.querySelector('.product-form');

  if (!mainForm) {
    console.error('Main product form not found.');
    return;
  }

  const stickyVariantSelectors = stickyATCBar.querySelectorAll('.sticky-atc-bar__variant-selector__dropdown');
  const mainVariantSelectors = mainForm.querySelectorAll('[name="id"]');

  const stickyAddToCartButton = stickyATCBar.querySelector('#sticky-atc-add-to-cart');
  const mainAddToCartButton = mainForm.querySelector('[name="add"]');

  const stickyPriceElement = stickyATCBar.querySelector('.sticky-atc-bar__price');
  const stickyInventoryBadge = stickyATCBar.querySelector('.sticky-atc-bar__inventory-badge');
  const stickyFreeShippingElement = stickyATCBar.querySelector('#sticky-atc-free-shipping');

  const freeShippingThreshold = parseFloat(stickyATCBar.dataset.freeShippingThreshold || '150');
  const productData = JSON.parse(stickyATCBar.dataset.product || '{}');
  
  // Initialize option selectors
  const optionSelectors = {};
  const stickyProductSelect = stickyATCBar.querySelector('#sticky-atc-ProductSelect');
  
  stickyVariantSelectors.forEach(selector => {
    const optionIndex = selector.getAttribute('data-index');
    if (optionIndex) {
      optionSelectors[optionIndex] = selector;
      
      selector.addEventListener('change', function() {
        const selectedOptions = [];
        Object.values(optionSelectors).forEach(sel => {
          selectedOptions.push(sel.value);
        });
        
        const matchingVariant = productData.variants.find(variant => 
          variant.options.every((option, index) => option === selectedOptions[index])
        );
        
        if (matchingVariant) {
          // Update sticky product select
          if (stickyProductSelect) {
            stickyProductSelect.value = matchingVariant.id;
          }
          
          // Update main form variant selector
          if (mainVariantSelectors.length > 0) {
            mainVariantSelectors[0].value = matchingVariant.id;
            mainVariantSelectors[0].dispatchEvent(new Event('change', { bubbles: true }));
          }
          
          updateStickyATC();
        }
      });
    }
  });
  
  // Listen for changes on main form variant selectors
  mainVariantSelectors.forEach(mainSelector => {
    mainSelector.addEventListener('change', function() {
      const selectedVariantId = this.value;
      const selectedVariant = productData.variants.find(v => v.id.toString() === selectedVariantId);
      
      if (selectedVariant) {
        // Update sticky variant selectors
        selectedVariant.options.forEach((optionValue, index) => {
          const selector = optionSelectors[`option${index + 1}`];
          if (selector && selector.value !== optionValue) {
            selector.value = optionValue;
          }
        });
        
        // Update sticky product select
        if (stickyProductSelect) {
          stickyProductSelect.value = selectedVariantId;
        }
        
        updateStickyATC();
      }
    });
  });

  // Update sticky ATC bar
  function updateStickyATC() {
    const selectedVariantId = mainForm.querySelector('[name="id"]').value;
    const selectedVariant = productData.variants.find(variant => variant.id.toString() === selectedVariantId);

    if (selectedVariant) {
      // Update price display
      stickyPriceElement.innerHTML = '';
      
      const formatMoney = (amount) => {
        return Shopify.formatMoney(amount, window.theme?.moneyFormat || "{{ shop.money_format }}");
      };

      if (selectedVariant.compare_at_price && selectedVariant.compare_at_price > selectedVariant.price) {
        const originalPriceSpan = document.createElement('span');
        originalPriceSpan.className = 'sticky-atc-bar__price--original';
        originalPriceSpan.textContent = formatMoney(selectedVariant.compare_at_price);

        const salePriceSpan = document.createElement('span');
        salePriceSpan.className = 'sticky-atc-bar__price--sale';
        salePriceSpan.textContent = formatMoney(selectedVariant.price);

        stickyPriceElement.appendChild(originalPriceSpan);
        stickyPriceElement.appendChild(document.createTextNode(' '));
        stickyPriceElement.appendChild(salePriceSpan);
      } else {
        const salePriceSpan = document.createElement('span');
        salePriceSpan.className = 'sticky-atc-bar__price--regular';
        salePriceSpan.textContent = formatMoney(selectedVariant.price);

        stickyPriceElement.appendChild(salePriceSpan);
      }

      // Update add to cart button and inventory badge
      if (selectedVariant.available) {
        stickyAddToCartButton.disabled = false;
        stickyAddToCartButton.classList.remove('disabled');
        stickyAddToCartButton.textContent = 'Add to cart';
        
        if (stickyInventoryBadge) {
          const inventoryQuantity = selectedVariant.inventory_quantity || 0;
          const inventoryPolicy = selectedVariant.inventory_policy || 'deny';
          const inventoryManagement = selectedVariant.inventory_management || null;
          
          let badgeClass = 'sticky-atc-bar__inventory-badge';
          let badgeText = '';
          
          if (!inventoryManagement || inventoryPolicy === 'continue') {
            badgeClass += ' sticky-atc-bar__inventory-badge--in-stock';
            badgeText = 'In stock';
          } else if (inventoryQuantity > 10) {
            badgeClass += ' sticky-atc-bar__inventory-badge--in-stock';
            badgeText = 'In stock';
          } else if (inventoryQuantity > 0) {
            badgeClass += ' sticky-atc-bar__inventory-badge--low-stock';
            badgeText = `Only ${inventoryQuantity} left`;
          } else {
            badgeClass += ' sticky-atc-bar__inventory-badge--sold-out';
            badgeText = 'Out of stock';
          }
          
          stickyInventoryBadge.className = badgeClass;
          stickyInventoryBadge.textContent = badgeText;
        }
      } else {
        stickyAddToCartButton.disabled = true;
        stickyAddToCartButton.classList.add('disabled');
        stickyAddToCartButton.textContent = 'Sold out';
        
        if (stickyInventoryBadge) {
          stickyInventoryBadge.className = 'sticky-atc-bar__inventory-badge sticky-atc-bar__inventory-badge--sold-out';
          stickyInventoryBadge.textContent = 'Sold out';
        }
      }

      // Update free shipping progress
      updateFreeShipping();
    }
  }

  // Update free shipping progress
  function updateFreeShipping() {
    fetch('/cart.js')
      .then(response => response.json())
      .then(cart => {
        if (!stickyFreeShippingElement) return;
        
        const subtotal = cart.total_price / 100;
        const remaining = freeShippingThreshold - subtotal;
        
        if (remaining > 0) {
          const formattedRemaining = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'MYR'
          }).format(remaining);
          
          stickyFreeShippingElement.innerHTML = `
            <span class="sticky-atc-bar__free-shipping__text">Add ${formattedRemaining} for </span>
            <strong class="sticky-atc-bar__free-shipping__highlight">FREE SHIPPING</strong>
          `;
        } else {
          stickyFreeShippingElement.innerHTML = `
            <strong class="sticky-atc-bar__free-shipping__success">
              🎉 Congratulations! You've unlocked FREE SHIPPING
            </strong>
          `;
        }
      })
      .catch(error => console.error('Error fetching cart:', error));
  }

  // Debounce function
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Bind updateFreeShipping to cart updates with debounce
  document.addEventListener('cart:updated', debounce(updateFreeShipping, 400));

  // Handle sticky add to cart button click
  if (stickyAddToCartButton) {
    stickyAddToCartButton.addEventListener('click', function(e) {
      e.preventDefault();
      
      if (this.disabled) return;
      
      const formData = new FormData(mainForm);
      this.classList.add('loading');
      this.textContent = 'Adding...';
      
      fetch('/cart/add.js', {
        method: 'POST',
        body: formData,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      .then(response => response.json())
      .then(item => {
        // Show success message
        const successMessage = document.createElement('span');
        successMessage.className = 'sticky-atc-bar__success-message';
        successMessage.textContent = '✓ Added to cart';
        this.textContent = '';
        this.appendChild(successMessage);
        
        // Reset button after delay
        setTimeout(() => {
          this.classList.remove('loading');
          this.textContent = 'Add to cart';
        }, 2000);
        
        // Update cart count and free shipping progress
        document.dispatchEvent(new CustomEvent('cart:updated'));
        updateFreeShipping();
        
        // Refresh cart drawer if it exists
        if (typeof window.refreshCart === 'function') {
          window.refreshCart();
        }
      })
      .catch(error => {
        console.error('Error:', error);
        this.classList.remove('loading');
        this.textContent = 'Add to cart';
      });
    });
  }

  // Handle quantity changes
  const stickyQuantityInput = stickyATCBar.querySelector('#sticky-atc-quantity');
  const mainQuantityInput = mainForm.querySelector('[name="quantity"]');
  const decreaseButton = stickyATCBar.querySelector('[data-action="decrease"]');
  const increaseButton = stickyATCBar.querySelector('[data-action="increase"]');

  function updateQuantityButtons() {
    const currentValue = parseInt(stickyQuantityInput.value, 10);
    const maxValue = parseInt(stickyQuantityInput.getAttribute('max'), 10) || Infinity;
    
    decreaseButton.disabled = currentValue <= 1;
    increaseButton.disabled = currentValue >= maxValue;
  }

  function syncQuantity(value, source) {
    const parsedValue = Math.max(1, parseInt(value, 10) || 1);
    const maxValue = parseInt(stickyQuantityInput.getAttribute('max'), 10) || Infinity;
    const finalValue = Math.min(parsedValue, maxValue);

    // Update both inputs
    stickyQuantityInput.value = finalValue;
    if (mainQuantityInput) {
      mainQuantityInput.value = finalValue;
    }

    // Update buttons state
    updateQuantityButtons();

    // Trigger change event on main form if change came from sticky bar
    if (source === 'sticky' && mainQuantityInput) {
      mainQuantityInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  if (stickyQuantityInput) {
    // Handle direct input changes
    stickyQuantityInput.addEventListener('change', function() {
      syncQuantity(this.value, 'sticky');
    });

    // Handle increment/decrement buttons
    decreaseButton.addEventListener('click', function() {
      syncQuantity(parseInt(stickyQuantityInput.value, 10) - 1, 'sticky');
    });

    increaseButton.addEventListener('click', function() {
      syncQuantity(parseInt(stickyQuantityInput.value, 10) + 1, 'sticky');
    });

    // Sync with main form quantity changes
    if (mainQuantityInput) {
      mainQuantityInput.addEventListener('change', function() {
        syncQuantity(this.value, 'main');
      });
    }

    // Initial button state
    updateQuantityButtons();
  }

  // Initial update
  updateStickyATC();
  showHideStickyBar();
});
