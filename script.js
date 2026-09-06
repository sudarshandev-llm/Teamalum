/* ============================================================
   TEAM ALUM — MAIN SCRIPT
   Page transitions, forms, animations
   ============================================================ */

(function () {
  'use strict';

  // ==================== STATE ====================
  const PAGES = ['home', 'about', 'services', 'projects', 'ask', 'contact'];
  let currentPage = 0;
  let isTransitioning = false;

  // ==================== DOM REFS ====================
  const pages = document.querySelectorAll('.page');
  const pills = document.querySelectorAll('.nav-pill');
  const pageContainer = document.getElementById('page-container');

  // ==================== NAVIGATION ====================
  function goToPage(index) {
    if (isTransitioning || index === currentPage || index < 0 || index >= PAGES.length) return;
    isTransitioning = true;

    const oldPage = pages[currentPage];
    const newPage = pages[index];
    const goingRight = index > currentPage;

    // Update pills
    pills[currentPage].classList.remove('active');
    pills[currentPage].removeAttribute('aria-current');
    pills[index].classList.add('active');
    pills[index].setAttribute('aria-current', 'page');

    // Scroll active pill into view on mobile
    pills[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

    // Outgoing animation
    oldPage.classList.add('transitioning-out');
    oldPage.classList.add(goingRight ? 'slide-out-left' : 'slide-out-right');

    // Set incoming page to its pre-animation state before making it visible
    newPage.classList.add('active');
    newPage.style.opacity = '0';
    newPage.style.transform = goingRight ? 'translateX(60px)' : 'translateX(-60px)';

    // Start incoming animation on next frame so the initial state renders first
    requestAnimationFrame(() => {
      newPage.classList.add(goingRight ? 'slide-in-right' : 'slide-in-left');
    });

    // After transition completes
    const duration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-page')) * 1000 || 500;
    setTimeout(() => {
      oldPage.classList.remove('active', 'transitioning-out', 'slide-out-left', 'slide-out-right');
      oldPage.scrollTop = 0;
      newPage.scrollTop = 0;
      newPage.classList.remove('slide-in-left', 'slide-in-right');
      newPage.style.transform = '';
      newPage.style.opacity = '';
      currentPage = index;
      isTransitioning = false;

      // Trigger stagger animation on About page
      if (PAGES[index] === 'about') triggerStagger();
    }, duration + 100);
  }

  // Nav pill clicks
  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      goToPage(parseInt(pill.dataset.page, 10));
    });
  });

  // CTA button navigation
  document.querySelectorAll('[data-navigate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      goToPage(parseInt(btn.dataset.navigate, 10));
    });
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      goToPage(Math.min(currentPage + 1, PAGES.length - 1));
    } else if (e.key === 'ArrowLeft') {
      goToPage(Math.max(currentPage - 1, 0));
    }
  });

  // ==================== STAGGER ANIMATION (ABOUT PAGE) ====================
  function triggerStagger() {
    const aboutPage = document.getElementById('page-about');
    const items = aboutPage.querySelectorAll('.stagger-in');
    items.forEach((el, i) => {
      el.classList.remove('visible');
      setTimeout(() => el.classList.add('visible'), i * 150);
    });
  }

  // Trigger stagger on initial load if About is active (shouldn't be, but safe)
  setTimeout(triggerStagger, 600);

  // ==================== ASK US FORM ====================
  const askForm = document.getElementById('ask-form');
  const askSuccess = document.getElementById('ask-success');
  const askError = document.getElementById('ask-error');
  const askAnotherBtn = document.getElementById('ask-another-btn');
  const retryBtn = document.getElementById('retry-btn');
  const askName = document.getElementById('ask-name');
  const askQuestion = document.getElementById('ask-question');

  function validateAskForm() {
    let valid = true;
    const nameWell = askName.closest('.input-well');
    const questionWell = askQuestion.closest('.input-well');

    nameWell.classList.remove('error', 'shake');
    questionWell.classList.remove('error', 'shake');

    if (!askName.value.trim()) {
      nameWell.classList.add('error', 'shake');
      valid = false;
    }
    if (!askQuestion.value.trim()) {
      questionWell.classList.add('error', 'shake');
      valid = false;
    }

    // Remove shake after animation
    if (!valid) {
      setTimeout(() => {
        nameWell.classList.remove('shake');
        questionWell.classList.remove('shake');
      }, 400);
    }

    return valid;
  }

  if (askForm) {
    askForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateAskForm()) return;

      const submitBtn = askForm.querySelector('.submit-btn');
      submitBtn.textContent = 'Submitting...';
      submitBtn.disabled = true;

      try {
        // Dynamic import of supabase client
        const { supabase } = await import('./supabase-config.js');

        const insertPromise = supabase.from('questions').insert([{
          name: askName.value.trim(),
          question: askQuestion.value.trim()
        }]);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out — check your internet connection')), 15000)
        );

        const { error } = await Promise.race([insertPromise, timeoutPromise]);

        if (error) throw error;

        // Show success
        askForm.classList.add('hidden');
        askSuccess.classList.remove('hidden');
        askError.classList.add('hidden');

      } catch (err) {
        console.error('Submit error:', err);
        const errMsg = document.getElementById('ask-error-msg');
        if (errMsg) {
          errMsg.textContent = 'Error: ' + (err && err.message ? err.message : String(err));
        }
        askError.classList.remove('hidden');
        askSuccess.classList.add('hidden');
        askForm.classList.remove('hidden');
      } finally {
        submitBtn.textContent = 'Submit Question';
        submitBtn.disabled = false;
      }
    });
  }

  if (askAnotherBtn) {
    askAnotherBtn.addEventListener('click', () => {
      askSuccess.classList.add('hidden');
      askForm.classList.remove('hidden');
      askForm.reset();
      askError.classList.add('hidden');
    });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      askError.classList.add('hidden');
      askForm.classList.remove('hidden');
    });
  }

  // ==================== CONTACT FORM ====================
  const contactForm = document.getElementById('contact-form');
  const contactSuccess = document.getElementById('contact-success');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;
      const inputs = contactForm.querySelectorAll('.input-well');

      inputs.forEach((well) => {
        const input = well.querySelector('input, textarea');
        well.classList.remove('error', 'shake');
        if (!input.value.trim()) {
          well.classList.add('error', 'shake');
          valid = false;
        }
      });

      if (!valid) {
        setTimeout(() => {
          inputs.forEach((w) => w.classList.remove('shake'));
        }, 400);
        return;
      }

      // Show confirmation (pure front-end)
      contactForm.classList.add('hidden');
      contactSuccess.classList.remove('hidden');
    });
  }

  // ==================== PROJECT DETAIL MODAL ====================
  const modal = document.getElementById('project-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalDesc = document.getElementById('modal-desc');
  const modalStatus = document.getElementById('modal-status');
  const modalOpenBtn = document.getElementById('modal-open-btn');
  const modalComingSoon = document.getElementById('modal-coming-soon');

  function openProjectModal(btn) {
    const name = btn.dataset.name;
    const desc = btn.dataset.desc;
    const url = btn.dataset.url;
    const status = btn.dataset.status;

    modalTitle.textContent = name;
    modalDesc.textContent = desc;
    modalStatus.textContent = status;

    if (url) {
      modalOpenBtn.href = url;
      modalOpenBtn.classList.remove('hidden');
      modalComingSoon.classList.add('hidden');
    } else {
      modalOpenBtn.classList.add('hidden');
      modalComingSoon.classList.remove('hidden');
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    modalClose.focus();
  }

  function closeProjectModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.project-title-btn').forEach((btn) => {
    btn.addEventListener('click', () => openProjectModal(btn));
  });

  if (modalClose) {
    modalClose.addEventListener('click', closeProjectModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeProjectModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeProjectModal();
    }
  });

  // ==================== INITIAL STATE ====================
  // Ensure first page is visible immediately
  pages[0].classList.add('active');
  pages[0].style.opacity = '1';
  pages[0].style.pointerEvents = 'auto';

  // ==================== PAGE VIEW TRACKING ====================
  // Fire-and-forget: never blocks or breaks the page.
  (async () => {
    try {
      const { trackPageView } = await import('./supabase-config.js');
      const page = document.querySelector('.page.active')?.dataset?.page || 'home';
      await trackPageView(page);
    } catch (err) {
      console.warn('Failed to track page view:', err);
    }
  })();

})();
