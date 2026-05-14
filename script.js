/* =========================================================
   Aatiqa Aslam — Portfolio interactivity (premium build)
   ========================================================= */

// Disable browser scroll restoration and force top immediately
if (history.scrollRestoration) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

(function () {
  'use strict';

  // Force scroll to top on DOMContentLoaded and load
  const forceScrollTop = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceScrollTop);
  } else {
    forceScrollTop();
  }
  window.addEventListener('load', forceScrollTop);
  
  // Force scroll top again after a short delay to catch all cases
  setTimeout(forceScrollTop, 100);

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  /* ---------- 1. Loader ---------- */
  const loader = $('#loader');
  if (loader) {
    const MIN_VISIBLE = 2200;
    const HARD_MAX = 5200;
    const startedAt = performance.now();
    const hide = () => {
      if (loader.classList.contains('is-done')) return;
      const elapsed = performance.now() - startedAt;
      const wait = Math.max(0, MIN_VISIBLE - elapsed);
      setTimeout(() => loader.classList.add('is-done'), wait);
    };
    if (document.readyState === 'complete') hide();
    else {
      window.addEventListener('load', hide, { once: true });
      setTimeout(hide, HARD_MAX);
    }
  }

  /* ---------- 2. Theme toggle ---------- */
  const html = document.documentElement;
  const themeToggle = $('#themeToggle');
  const saved = localStorage.getItem('theme');
  html.setAttribute('data-theme', saved || 'dark');

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  }

  /* ---------- 3. Scroll progress + nav state + back-to-top ---------- */
  const nav = $('#nav');
  const progressFill = $('#scrollProgress');
  const backToTop = $('#backToTop');

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const max = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      const pct = Math.min(1, y / max);
      if (progressFill) progressFill.style.width = (pct * 100).toFixed(2) + '%';
      if (nav) nav.classList.toggle('is-scrolled', y > 24);
      if (backToTop) backToTop.classList.toggle('is-visible', y > 600);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- 4. Custom cursor (desktop only) ---------- */
  const cursor = $('#cursor');
  const cursorRing = $('#cursorRing');

  if (cursor && cursorRing && !isCoarsePointer && !prefersReducedMotion) {
    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;
    let cx = mx, cy = my;

    document.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
    }, { passive: true });

    function loop() {
      // dot follows nearly directly
      cx += (mx - cx) * 0.5;
      cy += (my - cy) * 0.5;
      // ring lags with spring
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      cursor.style.transform = `translate3d(${cx - 4}px, ${cy - 4}px, 0)`;
      cursorRing.style.transform = `translate3d(${rx - 18}px, ${ry - 18}px, 0)`;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // hover targets
    const hoverTargets = 'a, button, [role="button"], .project, [data-cursor]';
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest(hoverTargets);
      if (!t) return;
      const mode = t.getAttribute('data-cursor');
      cursor.classList.add('is-hover');
      cursorRing.classList.add('is-hover');
      if (mode === 'text') cursorRing.classList.add('is-text');
    });
    document.addEventListener('mouseout', (e) => {
      const t = e.target.closest(hoverTargets);
      if (!t) return;
      cursor.classList.remove('is-hover');
      cursorRing.classList.remove('is-hover');
      cursorRing.classList.remove('is-text');
    });

    // hide cursor when leaving window
    document.addEventListener('mouseleave', () => {
      cursor.style.opacity = '0';
      cursorRing.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
      cursor.style.opacity = '1';
      cursorRing.style.opacity = '1';
    });
  }

  /* ---------- 5. Magnetic buttons ---------- */
  if (!prefersReducedMotion && !isCoarsePointer) {
    $$('.btn-magnetic').forEach(el => {
      const STRENGTH = 0.25;
      let raf = null;
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transform = `translate(${x * STRENGTH}px, ${y * STRENGTH}px)`;
        });
      });
      el.addEventListener('mouseleave', () => {
        cancelAnimationFrame(raf);
        el.style.transform = '';
      });
    });
  }

  /* ---------- 6. Mobile menu ---------- */
  const menuToggle = $('#menuToggle');
  const navMenu = $('#navMenu');

  function closeMenu() {
    menuToggle.classList.remove('is-open');
    navMenu.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      const isCurrentlyOpen = menuToggle.classList.contains('is-open');
      if (isCurrentlyOpen) {
        closeMenu();
      } else {
        menuToggle.classList.add('is-open');
        navMenu.classList.add('is-open');
        menuToggle.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
      }
    });
    $$('.nav__link', navMenu).forEach(link => link.addEventListener('click', closeMenu));
  }

  /* ---------- 7. Reveal on scroll ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-visible'));
  }

  // Skill bars use the same reveal trigger via .tool-card.is-visible
  const toolCards = $$('.tool-card');
  if ('IntersectionObserver' in window && toolCards.length) {
    const toolObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          toolObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    toolCards.forEach(el => toolObs.observe(el));
  } else {
    toolCards.forEach(el => el.classList.add('is-visible'));
  }

  /* ---------- 8. Scrollspy nav ---------- */
  const sections = $$('section[id]');
  const navLinks = $$('.nav__link');
  function setActive(id) {
    navLinks.forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === '#' + id));
  }
  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(s => spy.observe(s));
  }

  /* ---------- 9. Portfolio filters ---------- */
  const filterBtns = $$('.filter');
  const projects = $$('.project');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');

      const f = btn.dataset.filter;
      projects.forEach((p, i) => {
        const match = f === 'all' || p.dataset.category === f;
        if (match) {
          p.classList.remove('is-hidden');
          // staggered re-entry
          p.style.transition = 'opacity 0.4s ease, transform 0.45s cubic-bezier(0.22,1,0.36,1)';
          p.style.opacity = '0';
          p.style.transform = 'translateY(16px)';
          setTimeout(() => {
            p.style.opacity = '1';
            p.style.transform = 'translateY(0)';
          }, i * 40);
        } else {
          p.classList.add('is-hidden');
        }
      });
    });
  });

  /* ---------- 10. Stats counter ---------- */
  const statNums = $$('.stat__num');
  if (statNums.length && 'IntersectionObserver' in window) {
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const counterObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseFloat(el.getAttribute('data-target')) || 0;
        const suffix = el.getAttribute('data-suffix') || '';
        const duration = 1600;
        const start = performance.now();
        function step(now) {
          const t = Math.min(1, (now - start) / duration);
          const value = Math.floor(target * easeOutCubic(t));
          el.textContent = value + suffix;
          if (t < 1) requestAnimationFrame(step);
          else el.textContent = target + suffix;
        }
        requestAnimationFrame(step);
        counterObs.unobserve(el);
      });
    }, { threshold: 0.4 });
    statNums.forEach(s => counterObs.observe(s));
  }

  /* ---------- 11. Project lightbox ---------- */
  const projectModal = $('#projectModal');
  if (projectModal) {
    const modalImage = $('#modalImage', projectModal);
    const modalTitle = $('#modalTitle', projectModal);
    const modalTags = $('#modalTags', projectModal);
    const modalDesc = $('#modalDesc', projectModal);
    const modalTools = $('#modalTools', projectModal);
    const modalClose = $('.project-modal__close', projectModal);
    let lastFocused = null;

    function openProjectModal(projectEl) {
      if (!projectEl) return;
      const img = projectEl.querySelector('.project__image img');
      const titleEl = projectEl.querySelector('.project__body h3');
      const descEl = projectEl.querySelector('.project__body p');
      const toolsEl = projectEl.querySelector('.project__tools');
      const tagEls = projectEl.querySelectorAll('.tag');

      if (img) {
        modalImage.src = img.src;
        modalImage.alt = img.alt || '';
      }
      modalTitle.textContent = titleEl ? titleEl.textContent : '';
      modalDesc.textContent = descEl ? descEl.textContent : '';
      modalTools.textContent = toolsEl ? toolsEl.textContent : '';

      modalTags.innerHTML = '';
      tagEls.forEach(t => {
        const newTag = document.createElement('span');
        newTag.className = 'tag';
        newTag.textContent = t.textContent;
        modalTags.appendChild(newTag);
      });

      lastFocused = document.activeElement;
      projectModal.classList.add('is-open');
      projectModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      if (modalClose) modalClose.focus();
    }

    function closeProjectModal() {
      projectModal.classList.remove('is-open');
      projectModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    $$('.project').forEach(p => {
      p.setAttribute('role', 'button');
      p.setAttribute('tabindex', '0');
      p.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        openProjectModal(p);
      });
      p.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openProjectModal(p);
        }
      });
    });

    $$('[data-modal-close]', projectModal).forEach(el => {
      el.addEventListener('click', closeProjectModal);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && projectModal.classList.contains('is-open')) {
        closeProjectModal();
      }
    });
  }

  /* ---------- 12. Contact form ---------- */
  const form = $('#contactForm');
  const formStatus = $('#formStatus');
  const RECIPIENT = 'aatiqaaslam14@gmail.com';

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const subject = (form.querySelector('#subject')?.value || '').trim() || 'Project inquiry';
      const message = form.message.value.trim();

      if (!name || !email || !message) {
        formStatus.textContent = 'Please fill in all required fields.';
        formStatus.style.color = 'var(--accent)';
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        formStatus.textContent = 'Please enter a valid email address.';
        formStatus.style.color = 'var(--accent)';
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const original = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending…';

      const accessKeyInput = form.querySelector('input[name="access_key"]');
      const accessKey = accessKeyInput ? accessKeyInput.value : '';
      const isConfigured = accessKey && !/YOUR_/i.test(accessKey);

      try {
        if (isConfigured) {
          const fd = new FormData(form);
          const res = await fetch('https://api.web3forms.com/submit', {
            method: 'POST', body: fd, headers: { 'Accept': 'application/json' }
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json.success) throw new Error(json.message || 'Send failed');
          formStatus.textContent = 'Thanks ' + name.split(' ')[0] + '! Your message has been sent.';
          formStatus.style.color = '#4ADE80';
          form.reset();
        } else {
          const body =
            'Name: ' + name + '\n' +
            'Email: ' + email + '\n\n' +
            message + '\n\n— Sent from the portfolio contact form';
          const href = 'mailto:' + RECIPIENT
            + '?subject=' + encodeURIComponent(subject)
            + '&body=' + encodeURIComponent(body);
          window.location.href = href;
          formStatus.innerHTML =
            'Your email app is opening with a draft to <strong>' + RECIPIENT + '</strong>. ' +
            'Click <em>Send</em> there to deliver it.';
          formStatus.style.color = 'var(--text-soft)';
        }
      } catch (err) {
        formStatus.innerHTML =
          'Sorry, something went wrong. Please email <strong>' + RECIPIENT + '</strong> directly.';
        formStatus.style.color = 'var(--accent)';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = original;
      }
    });
  }

  /* ---------- 13. Year ---------- */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- 14. Subtle hero parallax (desktop only) ---------- */
  const heroVisual = $('.hero__visual');
  if (heroVisual && !prefersReducedMotion && window.matchMedia('(min-width: 1025px)').matches) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    document.addEventListener('mousemove', (e) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 18;
      ty = (e.clientY / window.innerHeight - 0.5) * 18;
      if (!raf) {
        const tick = () => {
          cx += (tx - cx) * 0.08;
          cy += (ty - cy) * 0.08;
          heroVisual.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
          if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) raf = requestAnimationFrame(tick);
          else raf = 0;
        };
        raf = requestAnimationFrame(tick);
      }
    }, { passive: true });
  }

  /* ---------- 15. Card tilt on hover (project cards) ---------- */
  if (!prefersReducedMotion && !isCoarsePointer) {
    const tiltTargets = $$('.project, .tool-card, .service, .testimonial');
    tiltTargets.forEach(card => {
      let raf = 0;
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.style.setProperty('--tilt-x', (py * -4).toFixed(2) + 'deg');
          card.style.setProperty('--tilt-y', (px * 4).toFixed(2) + 'deg');
          card.style.transform = `translateY(var(--lift, -6px)) perspective(900px) rotateX(${(py * -3).toFixed(2)}deg) rotateY(${(px * 4).toFixed(2)}deg)`;
        });
      });
      card.addEventListener('mouseleave', () => {
        cancelAnimationFrame(raf);
        card.style.transform = '';
      });
    });
  }

  /* Initial paint */
  onScroll();
})();
