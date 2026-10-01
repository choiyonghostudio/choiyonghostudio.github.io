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

  const CONTACT_I18N = {
    ko: {
      title: "메시지 보내기",
      leadBefore: "아래 양식을 작성하면 ",
      leadAfter: "으로 바로 전송됩니다.",
      name: "이름",
      email: "이메일 (답장 받을 주소)",
      subject: "제목",
      message: "내용",
      submit: "보내기",
      sending: "보내는 중...",
      success: "메시지가 전송되었습니다. 감사합니다!",
      failBefore: "전송에 실패했습니다. 잠시 후 다시 시도하거나 ",
      mailApp: "메일 앱으로 보내기",
      failAfter: "를 눌러주세요.",
    },
    en: {
      title: "Send a message",
      leadBefore: "Fill out the form below and your message will be sent directly to ",
      leadAfter: ".",
      name: "Name",
      email: "Email (for replies)",
      subject: "Subject",
      message: "Message",
      submit: "Send",
      sending: "Sending...",
      success: "Your message has been sent. Thank you!",
      failBefore: "Something went wrong. Please try again later or ",
      mailApp: "send it with your email app",
      failAfter: ".",
    },
    ja: {
      title: "メッセージを送る",
      leadBefore: "以下のフォームにご記入いただくと、",
      leadAfter: " に直接送信されます。",
      name: "お名前",
      email: "メールアドレス（返信先）",
      subject: "件名",
      message: "お問い合わせ内容",
      submit: "送信",
      sending: "送信中...",
      success: "メッセージを送信しました。ありがとうございます！",
      failBefore: "送信に失敗しました。しばらくしてから再度お試しいただくか、",
      mailApp: "メールアプリで送信",
      failAfter: "してください。",
    },
    "zh-Hans": {
      title: "发送消息",
      leadBefore: "填写以下表单，您的消息将直接发送至 ",
      leadAfter: "。",
      name: "姓名",
      email: "电子邮箱（用于回复）",
      subject: "主题",
      message: "内容",
      submit: "发送",
      sending: "发送中...",
      success: "消息已发送，谢谢！",
      failBefore: "发送失败。请稍后重试，或",
      mailApp: "使用邮件应用发送",
      failAfter: "。",
    },
    "zh-Hant": {
      title: "傳送訊息",
      leadBefore: "填寫以下表單，您的訊息將直接傳送至 ",
      leadAfter: "。",
      name: "姓名",
      email: "電子郵件（用於回覆）",
      subject: "主旨",
      message: "內容",
      submit: "傳送",
      sending: "傳送中...",
      success: "訊息已送出，謝謝！",
      failBefore: "傳送失敗。請稍後再試，或",
      mailApp: "使用郵件應用程式傳送",
      failAfter: "。",
    },
    es: {
      title: "Enviar un mensaje",
      leadBefore: "Completa el formulario y tu mensaje se enviará directamente a ",
      leadAfter: ".",
      name: "Nombre",
      email: "Correo electrónico (para responderte)",
      subject: "Asunto",
      message: "Mensaje",
      submit: "Enviar",
      sending: "Enviando...",
      success: "Tu mensaje se ha enviado. ¡Gracias!",
      failBefore: "No se pudo enviar. Inténtalo de nuevo más tarde o ",
      mailApp: "envíalo con tu aplicación de correo",
      failAfter: ".",
    },
    fr: {
      title: "Envoyer un message",
      leadBefore: "Remplissez le formulaire ci-dessous et votre message sera envoyé directement à ",
      leadAfter: ".",
      name: "Nom",
      email: "E-mail (pour la réponse)",
      subject: "Objet",
      message: "Message",
      submit: "Envoyer",
      sending: "Envoi en cours...",
      success: "Votre message a bien été envoyé. Merci !",
      failBefore: "L’envoi a échoué. Réessayez plus tard ou ",
      mailApp: "envoyez-le avec votre application de messagerie",
      failAfter: ".",
    },
    de: {
      title: "Nachricht senden",
      leadBefore: "Füllen Sie das Formular aus – Ihre Nachricht wird direkt an ",
      leadAfter: " gesendet.",
      name: "Name",
      email: "E-Mail (für die Antwort)",
      subject: "Betreff",
      message: "Nachricht",
      submit: "Senden",
      sending: "Wird gesendet...",
      success: "Ihre Nachricht wurde gesendet. Vielen Dank!",
      failBefore: "Das Senden ist fehlgeschlagen. Bitte versuchen Sie es später erneut oder ",
      mailApp: "senden Sie sie mit Ihrer E-Mail-App",
      failAfter: ".",
    },
  };

  function toContactLang(tag) {
    const lower = String(tag || "").toLowerCase();
    if (lower.startsWith("zh")) {
      return /hant|-tw|-hk|-mo/.test(lower) ? "zh-Hant" : "zh-Hans";
    }
    const base = lower.split("-")[0];
    return CONTACT_I18N[base] ? base : null;
  }

  // ?lang=ja 처럼 URL 로 강제 지정 가능 (확인용), 없으면 브라우저 언어 설정 순서대로 매칭
  function detectContactLang() {
    const forced = toContactLang(new URLSearchParams(window.location.search).get("lang"));
    if (forced) return forced;
    const prefs = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
    for (const tag of prefs) {
      const lang = toContactLang(tag);
      if (lang) return lang;
    }
    return "en";
  }

  let contactText = CONTACT_I18N.ko;

  function localizeContact() {
    const form = document.getElementById("contact-form");
    if (!form) return;
    const lang = detectContactLang();
    contactText = CONTACT_I18N[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll(".contact-section [data-i18n]").forEach((el) => {
      const text = contactText[el.getAttribute("data-i18n")];
      if (text != null) el.textContent = text;
    });
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
      link.textContent = contactText.mailApp;
      setStatus(contactText.failBefore, "error");
      status.appendChild(link);
      status.appendChild(document.createTextNode(contactText.failAfter));
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
        "방문자 언어": document.documentElement.lang + " (" + (navigator.language || "") + ")",
      };

      submit.disabled = true;
      setStatus(contactText.sending, "");
      try {
        const res = await fetch(form.action, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json().catch(() => ({}));
        if (res.ok && result.success === true) {
          form.reset();
          setStatus(contactText.success, "success");
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

  // 스크립트가 폼 아래에 있어 DOMContentLoaded 전에도 폼에 접근 가능 → 한국어가 잠깐 보이는 깜빡임 방지
  localizeContact();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
