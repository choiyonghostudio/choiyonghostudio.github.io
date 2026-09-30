(function () {
  function encodeSegments(relPath) {
    return String(relPath)
      .split("/")
      .map(encodeURIComponent)
      .join("/");
  }

  function filenameOf(src) {
    return String(src || "").split("/").pop() || "";
  }

  function collectionUrl(section, id) {
    return (
      "collection.html?section=" +
      encodeURIComponent(section) +
      "&id=" +
      encodeURIComponent(id)
    );
  }

  function imageUrl(src) {
    const cleaned = String(src || "").replace(/^\/+/, "");
    return encodeSegments(cleaned);
  }

  function visibleList(list) {
    return (Array.isArray(list) ? list : []).filter((item) => item && item.id);
  }

  async function loadCollections() {
    const res = await fetch("collections.json", { cache: "no-store" });
    if (!res.ok) return { home: {}, personalWorks: [], works: [] };
    const data = await res.json();
    if (!data || Array.isArray(data)) {
      return { home: {}, personalWorks: [], works: [] };
    }
    return {
      home: data.home || {},
      personalWorks: visibleList(data.personalWorks),
      works: visibleList(data.works),
    };
  }

  function fillPanel(panel, section, items) {
    if (!panel) return;
    panel.innerHTML = "";
    items.forEach((item) => {
      const link = document.createElement("a");
      link.href = collectionUrl(section, item.id);
      link.textContent = item.name || item.id;
      panel.appendChild(link);
    });
  }

  function closeAllMenus(nav) {
    nav.querySelectorAll(".nav-item.is-open").forEach((item) => {
      item.classList.remove("is-open");
    });
    document.body.classList.remove("nav-overlay-open");
  }

  function placePanel(item) {
    const panel = item.querySelector(".nav-panel");
    if (!panel) return;
    panel.style.left = "50%";
    panel.style.right = "auto";
    panel.style.transform = "translateX(-50%)";
    const rect = panel.getBoundingClientRect();
    const margin = 10;
    let dx = 0;
    if (rect.right > window.innerWidth - margin) {
      dx -= rect.right - (window.innerWidth - margin);
    }
    if (rect.left + dx < margin) {
      dx += margin - (rect.left + dx);
    }
    panel.style.transform = dx
      ? "translateX(calc(-50% + " + dx + "px))"
      : "translateX(-50%)";
  }

  function bindMenus(nav) {
    const items = nav.querySelectorAll(".nav-item");
    let closeTimer = 0;

    const open = (item) => {
      window.clearTimeout(closeTimer);
      items.forEach((el) => el.classList.toggle("is-open", el === item));
      document.body.classList.add("nav-overlay-open");
      requestAnimationFrame(() => placePanel(item));
    };

    const scheduleClose = () => {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => closeAllMenus(nav), 120);
    };

    items.forEach((item) => {
      item.addEventListener("mouseenter", () => open(item));
      item.addEventListener("mouseleave", scheduleClose);
      const trigger = item.querySelector(".nav-link");
      if (trigger) {
        trigger.addEventListener("click", (event) => {
          event.preventDefault();
          if (item.classList.contains("is-open")) {
            closeAllMenus(nav);
          } else {
            open(item);
          }
        });
      }
    });

    nav.addEventListener("mouseenter", () => window.clearTimeout(closeTimer));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAllMenus(nav);
    });
  }

  function resolvePage() {
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");
    if (section === "works") return "works";
    if (section === "personal-works") return "personal";
    return document.body.getAttribute("data-page") || "";
  }

  function markActiveNav() {
    const page = resolvePage();
    document.body.setAttribute("data-page", page);
    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.classList.toggle("is-active", el.getAttribute("data-nav") === page);
    });
  }

  async function loadProse() {
    const el = document.getElementById("page-prose");
    if (!el) return;
    const file = el.getAttribute("data-src");
    if (!file) return;
    try {
      const res = await fetch(file, { cache: "no-store" });
      if (!res.ok) return;
      el.textContent = await res.text();
    } catch (err) {
      console.error("텍스트 로드 실패:", err);
    }
  }

  async function loadHomeFeatured() {
    const frame = document.getElementById("home-featured");
    if (!frame) return;
    try {
      const res = await fetch("home/images.json", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const images = Array.isArray(data) ? data : data.images || [];
      if (!images.length) return;
      const featuredName = data.featured ? filenameOf(data.featured) : "";
      const item =
        images.find((img) => filenameOf(img.src) === featuredName) || images[0];
      if (!item || !item.src) return;
      const img = document.createElement("img");
      img.src = imageUrl(item.src);
      img.alt = item.alt || "";
      frame.appendChild(img);
    } catch (err) {
      console.error("홈 대표사진 로드 실패:", err);
    }
  }

  function initContactForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;
    const status = document.getElementById("contact-status");
    const submit = form.querySelector(".contact-submit");

    const setStatus = (text, kind) => {
      status.textContent = text;
      status.className = "contact-status" + (kind ? " is-" + kind : "");
    };

    const mailtoFallback = (data) => {
      const link = document.createElement("a");
      link.href =
        "mailto:" +
        form.dataset.mailto +
        "?subject=" +
        encodeURIComponent(data.get("subject") || "") +
        "&body=" +
        encodeURIComponent(
          (data.get("message") || "") +
            "\n\n— " +
            (data.get("name") || "") +
            " <" +
            (data.get("email") || "") +
            ">"
        );
      link.textContent = "메일 앱으로 보내기";
      setStatus("전송에 실패했습니다. 잠시 후 다시 시도하거나 ", "error");
      status.appendChild(link);
      status.appendChild(document.createTextNode(" 를 눌러주세요."));
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const data = new FormData(form);
      if (data.get("botcheck")) return;

      const accessKey = data.get("access_key");
      if (!accessKey || accessKey === "WEB3FORMS_ACCESS_KEY") {
        mailtoFallback(data);
        return;
      }

      const payload = {
        access_key: accessKey,
        from_name: data.get("from_name"),
        subject: "[YONGHO CHOI 웹사이트] " + data.get("subject"),
        name: data.get("name"),
        email: data.get("email"),
        message: data.get("message"),
      };

      submit.disabled = true;
      setStatus("보내는 중...", "");
      try {
        const res = await fetch(form.action, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json().catch(() => ({}));
        if (res.ok && result.success === true) {
          form.reset();
          setStatus("메시지가 전송되었습니다. 감사합니다!", "success");
        } else {
          console.error("문의 전송 실패:", result.message || res.status);
          mailtoFallback(data);
        }
      } catch (err) {
        console.error("문의 전송 실패:", err);
        mailtoFallback(data);
      } finally {
        submit.disabled = false;
      }
    });
  }

  function syncHeaderHeight() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    document.documentElement.style.setProperty(
      "--header-height",
      `${header.offsetHeight}px`
    );
  }

  async function init() {
    syncHeaderHeight();
    window.addEventListener("resize", syncHeaderHeight);
    markActiveNav();
    initContactForm();
    const nav = document.getElementById("site-nav");
    try {
      const collections = await loadCollections();
      if (nav) {
        fillPanel(
          document.getElementById("panel-personal"),
          "personal-works",
          collections.personalWorks
        );
        fillPanel(
          document.getElementById("panel-works"),
          "works",
          collections.works
        );
        bindMenus(nav);
      }
    } catch (err) {
      console.error("메뉴 로드 실패:", err);
    }
    await loadHomeFeatured();
    await loadProse();
  }

  window.YonghoSite = {
    loadCollections,
    collectionUrl,
    imageUrl,
    filenameOf,
    encodeSegments,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
