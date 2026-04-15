const body = document.body;
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".navegacao");
const navLinks = Array.from(document.querySelectorAll(".navegacao a, .rodape-nav a"));
const monitoredSections = Array.from(document.querySelectorAll(".secao-monitorada"));
const revealItems = document.querySelectorAll(".reveal");
const backToTopButton = document.getElementById("voltar-topo");

const sliderTrack = document.querySelector(".grade-videos");
const sliderPrevButton = document.querySelector('[data-slider="prev"]');
const sliderNextButton = document.querySelector('[data-slider="next"]');
const filterButtons = Array.from(document.querySelectorAll(".filtro-btn"));
const videoCards = Array.from(document.querySelectorAll(".card-video"));

const videoModal = document.getElementById("video-modal");
const videoModalSource = document.getElementById("modal-video-source");
const videoModalPlayer = document.getElementById("modal-video-player");
const videoModalTitle = document.getElementById("modal-video-titulo");
const videoModalDescription = document.getElementById("modal-video-descricao");
const videoButtons = Array.from(document.querySelectorAll(".video-abrir"));

const gameModal = document.getElementById("jogo-modal");
const openGamePreviewButton = document.getElementById("abrir-preview-jogo");

const tipButton = document.getElementById("trocar-dica");
const tipText = document.getElementById("dica-texto");
const tipIndicator = document.getElementById("dica-indicador");

const newsletterForm = document.getElementById("newsletter-form");
const formStatus = document.getElementById("form-status");
const interestLabels = {
    iniciante: "Começando do zero",
    risco: "Gestão de risco",
    fundamentos: "Fundamentos",
    planejamento: "Planejamento",
    jogo: "Jogo educativo"
};

const tips = [
    "Antes de investir, monte uma reserva de emergência equivalente a pelo menos 6 meses dos seus custos fixos. Isso garante segurança para explorar o mercado de renda variável com tranquilidade.",
    "Defina um limite de perda por operação. Disciplina é o que impede uma decisão emocional de virar um problema maior.",
    "Compare empresas usando fundamentos, mas também olhe o contexto do mercado. Bons números não eliminam riscos de curto prazo.",
    "Registre suas decisões em um diário de investimento. Com o tempo, isso ajuda a entender padrões, erros e acertos."
];

let currentTipIndex = 0;
let currentSlide = 0;
let activeFilter = "all";

const getVisibleVideoCards = () => videoCards.filter((card) => !card.classList.contains("is-hidden"));

const closeMenu = () => {
    body.classList.remove("menu-aberto");
    if (menuToggle) {
        menuToggle.setAttribute("aria-expanded", "false");
    }
};

if (menuToggle) {
    menuToggle.addEventListener("click", () => {
        const isOpen = body.classList.toggle("menu-aberto");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
}

navLinks.forEach((link) => {
    link.addEventListener("click", () => {
        if (window.innerWidth <= 760) {
            closeMenu();
        }
    });
});

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.18 });

revealItems.forEach((item) => revealObserver.observe(item));

const setActiveNavLink = (sectionId) => {
    navLinks.forEach((link) => {
        const target = link.getAttribute("href");
        link.classList.toggle("is-active", target === `#${sectionId}`);
    });
};

const sectionObserver = new IntersectionObserver((entries) => {
    const visibleSection = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visibleSection) {
        setActiveNavLink(visibleSection.target.id);
    }
}, { threshold: [0.35, 0.6, 0.9] });

monitoredSections.forEach((section) => sectionObserver.observe(section));

const updateBackToTopState = () => {
    backToTopButton.classList.toggle("is-visible", window.scrollY > 500);
};

window.addEventListener("scroll", updateBackToTopState);
updateBackToTopState();

backToTopButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
});

const updateSliderButtons = () => {
    const visibleCards = getVisibleVideoCards();
    const cardsPerView = window.innerWidth <= 760 ? 1 : window.innerWidth <= 1100 ? 2 : 4;
    const maxSlide = Math.max(0, visibleCards.length - cardsPerView);
    const step = visibleCards[0] ? visibleCards[0].offsetWidth + 24 : 0;

    currentSlide = Math.min(currentSlide, maxSlide);
    sliderTrack.style.transform = `translateX(-${currentSlide * step}px)`;

    sliderPrevButton.disabled = currentSlide === 0;
    sliderNextButton.disabled = currentSlide >= maxSlide;
};

const applyFilter = (filter) => {
    activeFilter = filter;
    currentSlide = 0;

    videoCards.forEach((card) => {
        const matches = filter === "all" || card.dataset.category === filter;
        card.classList.toggle("is-hidden", !matches);
    });

    filterButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.filter === filter);
    });

    updateSliderButtons();
};

filterButtons.forEach((button) => {
    button.addEventListener("click", () => applyFilter(button.dataset.filter));
});

sliderPrevButton.addEventListener("click", () => {
    currentSlide = Math.max(0, currentSlide - 1);
    updateSliderButtons();
});

sliderNextButton.addEventListener("click", () => {
    const visibleCards = getVisibleVideoCards();
    const cardsPerView = window.innerWidth <= 760 ? 1 : window.innerWidth <= 1100 ? 2 : 4;
    const maxSlide = Math.max(0, visibleCards.length - cardsPerView);
    currentSlide = Math.min(maxSlide, currentSlide + 1);
    updateSliderButtons();
});

window.addEventListener("resize", () => {
    if (window.innerWidth > 760) {
        closeMenu();
    }
    updateSliderButtons();
});

const openModal = (modal) => {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
};

const closeModal = (modal) => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");

    if (modal === videoModal) {
        videoModalPlayer.pause();
        videoModalSource.src = "";
        videoModalPlayer.load();
    }

    if (!document.querySelector(".modal.is-open")) {
        body.classList.remove("modal-open");
    }
};

videoButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const { videoSrc, videoTitle, videoDescription } = button.dataset;
        videoModalTitle.textContent = videoTitle;
        videoModalDescription.textContent = videoDescription;
        videoModalSource.src = videoSrc;
        videoModalPlayer.load();
        openModal(videoModal);
    });
});

if (openGamePreviewButton) {
    openGamePreviewButton.addEventListener("click", () => openModal(gameModal));
}

document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
        const modal = button.closest(".modal");
        if (modal) {
            closeModal(modal);
        }
    });
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        document.querySelectorAll(".modal.is-open").forEach((modal) => closeModal(modal));
        closeMenu();
    }
});

const renderTip = () => {
    tipText.textContent = tips[currentTipIndex];
    tipIndicator.textContent = `Dica ${currentTipIndex + 1} de ${tips.length}`;
};

tipButton.addEventListener("click", () => {
    currentTipIndex = (currentTipIndex + 1) % tips.length;
    renderTip();
});

renderTip();

newsletterForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(newsletterForm);
    const name = String(formData.get("nome") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const interest = String(formData.get("interesse") || "").trim();
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    formStatus.className = "form-status";

    if (name.length < 2) {
        formStatus.textContent = "Digite um nome com pelo menos 2 caracteres.";
        formStatus.classList.add("is-error");
        return;
    }

    if (!emailIsValid) {
        formStatus.textContent = "Informe um e-mail válido para continuar.";
        formStatus.classList.add("is-error");
        return;
    }

    if (!interest) {
        formStatus.textContent = "Selecione um interesse principal.";
        formStatus.classList.add("is-error");
        return;
    }

    formStatus.textContent = `Cadastro concluído, ${name}. Você receberá novidades sobre ${interestLabels[interest]}.`;
    formStatus.classList.add("is-success");
    newsletterForm.reset();
});

applyFilter(activeFilter);
