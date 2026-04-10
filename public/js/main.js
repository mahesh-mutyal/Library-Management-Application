/* ── Library App – Main JS ──────────────────────────────────────────────────── */

// Auto-dismiss flash messages after 5 seconds
document.addEventListener('DOMContentLoaded', () => {
  const alerts = document.querySelectorAll('.alert.alert-success, .alert.alert-danger');
  alerts.forEach(alert => {
    setTimeout(() => {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
      bsAlert.close();
    }, 5000);
  });

  // Highlight active nav link
  const path = window.location.pathname;
  document.querySelectorAll('.navbar .nav-link').forEach(link => {
    if (link.getAttribute('href') && path.startsWith(link.getAttribute('href')) && link.getAttribute('href') !== '/') {
      link.classList.add('active', 'fw-bold');
    }
  });

  // Preserve lang param on form submits if present in URL
  const langParam = new URLSearchParams(window.location.search).get('lang');
  if (langParam) {
    document.querySelectorAll('form').forEach(form => {
      if (!form.querySelector('[name="lang"]')) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'lang';
        input.value = langParam;
        form.appendChild(input);
      }
    });
  }
});

// ── Confirm delete buttons ──────────────────────────────────────────────────
document.querySelectorAll('[data-confirm]').forEach(el => {
  el.addEventListener('click', e => {
    if (!confirm(el.dataset.confirm || 'Are you sure?')) e.preventDefault();
  });
});

// ── Format Indian number ────────────────────────────────────────────────────
function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

// ── Barcode scanner — listens for rapid keyboard input (typical of USB scanners)
(function () {
  let buffer = '';
  let lastKeyTime = 0;

  document.addEventListener('keypress', (e) => {
    const now = Date.now();
    if (now - lastKeyTime > 100) buffer = '';
    lastKeyTime = now;

    if (e.key !== 'Enter') {
      buffer += e.key;
    } else if (buffer.length > 3) {
      // Check if a book search input is focused
      const focusedEl = document.activeElement;
      if (!focusedEl || !['INPUT', 'TEXTAREA'].includes(focusedEl.tagName)) {
        // Broadcast barcode scanned event
        document.dispatchEvent(new CustomEvent('barcodeScanned', { detail: { value: buffer } }));
      }
      buffer = '';
    }
  });
})();
