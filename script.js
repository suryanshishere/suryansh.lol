const menuButton = document.querySelector(".mobile-menu-button");
const mobileNav = document.querySelector(".mobile-nav");
const toast = document.querySelector(".toast");
let toastTimeout;

function closeMenu() {
  mobileNav?.classList.remove("open");
  mobileNav?.setAttribute("aria-hidden", "true");
  menuButton?.setAttribute("aria-expanded", "false");
  if (menuButton) {
    menuButton.textContent = "MENU";
  }
}

function hideToast() {
  if (!toast) return;
  toast.classList.remove("show");
  clearTimeout(toastTimeout);
}

menuButton?.addEventListener("click", () => {
  const isOpen = mobileNav.classList.toggle("open");
  mobileNav.setAttribute("aria-hidden", String(!isOpen));
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.textContent = isOpen ? "CLOSE ✕" : "MENU";
});

mobileNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMenu);
});

document.addEventListener("click", (event) => {
  if (
    mobileNav?.classList.contains("open") &&
    !mobileNav.contains(event.target) &&
    !menuButton?.contains(event.target)
  ) {
    closeMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
    hideToast();
  }
});

toast?.addEventListener("click", (event) => {
  if (event.target.tagName !== "A") {
    hideToast();
  }
});

document.getElementById("year").textContent = new Date().getFullYear();

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

async function copyTextToClipboard(text) {
  let copied = false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
  }

  if (!copied) {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      textArea.style.opacity = "0";
      textArea.setAttribute("readonly", "");
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      copied = document.execCommand("copy");
      textArea.remove();
    } catch {
      copied = false;
    }
  }

  return copied;
}

function showToast(email) {
  if (!toast) return;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
  toast.innerHTML = `Email copied: <strong>${email}</strong> <a href="${gmailUrl}" target="_blank" rel="noopener noreferrer">Open Gmail ↗</a>`;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

async function handleEmailAction(email, buttonElement = null) {
  await copyTextToClipboard(email);
  showToast(email);

  if (buttonElement) {
    const originalText = buttonElement.textContent;
    buttonElement.textContent = "Copied ✓";
    setTimeout(() => {
      buttonElement.textContent = originalText;
    }, 2000);
  }
}

document.querySelectorAll(".copy-email").forEach((button) => {
  button.addEventListener("click", () => {
    const email = button.dataset.email || "heresuryanshsingh@gmail.com";
    handleEmailAction(email, button);
  });
});

document.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
  link.addEventListener("click", () => {
    const email = link.dataset.email || link.href.replace(/^mailto:/i, "").split("?")[0];
    handleEmailAction(email);
  });
});
