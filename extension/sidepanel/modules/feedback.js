let hideToastTimer = null;

export function initFeedback() {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.classList.add("hidden");
  }
}

export function showToast(message, variant = "info") {
  const toast = document.getElementById("toast");
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.remove("hidden", "success", "error", "info");
  toast.classList.add(variant);

  if (hideToastTimer) {
    clearTimeout(hideToastTimer);
  }

  hideToastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2400);
}
