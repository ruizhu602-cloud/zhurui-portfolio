/* ============================================================
   motion.js —— 动效驱动层（独立文件，删除即可还原）
   设计原则：
   1) 全部包裹 try/catch，任何一处失败都不影响原有筛选/弹窗功能
   2) 揭示类效果由 JS 添加 class，JS 失效时元素仍然是正常可见的
   3) 图片渐显有 1.5s 兜底，绝不会把图片永久藏住
   4) 尊重 prefers-reduced-motion
   ============================================================ */
(function () {
  'use strict';

  var reduce = false;
  try {
    reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  /* ---------------- 0. 封面轻视差 ---------------- */
  try {
    var cover = document.querySelector('.portfolio-cover');
    var stack = document.querySelector('#cover-stack');
    var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (cover && stack && finePointer && !reduce) {
      var coverRect = null;
      var pointerFrame = 0;
      cover.addEventListener('pointermove', function (event) {
        if (!coverRect) coverRect = cover.getBoundingClientRect();
        var px = (event.clientX - coverRect.left) / coverRect.width - .5;
        var py = (event.clientY - coverRect.top) / coverRect.height - .5;
        if (pointerFrame) cancelAnimationFrame(pointerFrame);
        pointerFrame = requestAnimationFrame(function () {
          stack.style.setProperty('--cover-shift-x', (px * 10).toFixed(1) + 'px');
          stack.style.setProperty('--cover-shift-y', (py * 8).toFixed(1) + 'px');
          pointerFrame = 0;
        });
      }, { passive: true });
      cover.addEventListener('pointerleave', function () {
        coverRect = null;
        stack.style.setProperty('--cover-shift-x', '0px');
        stack.style.setProperty('--cover-shift-y', '0px');
      }, { passive: true });
      window.addEventListener('resize', function () { coverRect = null; }, { passive: true });
    }
  } catch (e) { console.warn('[motion] 封面视差失败', e); }

  /* ---------------- 0.5 首页封面自动翻页 ---------------- */
  try {
    var cover = document.querySelector('.portfolio-cover');
    if (cover && !reduce) {
      var pageGroups = [
        [cover.querySelector('.page-front'), cover.querySelector('.page-middle'), cover.querySelector('.page-back')],
        [cover.querySelector('.mobile-page-front'), cover.querySelector('.mobile-page-middle'), cover.querySelector('.mobile-page-back')]
      ];
      var activeAnimations = [];
      var timer = 0;
      var visible = false;
      var busy = false;
      var mq = window.matchMedia('(max-width: 650px)');
      var easeLift = 'cubic-bezier(.22,.61,.36,1)';
      var easeSettle = 'cubic-bezier(.34,1.28,.64,1)';

      var cancelAndReset = function () {
        activeAnimations.forEach(function (animation) { animation.cancel(); });
        activeAnimations = [];
        pageGroups.forEach(function (group) {
          group.forEach(function (page) {
            if (page) page.style.removeProperty('transform');
          });
        });
        busy = false;
      };
      var animatePage = function (page, direction, delay, duration) {
        if (!page) return Promise.resolve();
        var baseAngle = 0;
        var baseTilt = 0;
        if (page.classList.contains('page-back') || page.classList.contains('mobile-page-back')) baseTilt = -1.4;
        if (page.classList.contains('page-middle') || page.classList.contains('mobile-page-middle')) baseTilt = 1.2;
        if (page.classList.contains('page-front') || page.classList.contains('mobile-page-front')) baseTilt = -.4;
        var transforms = direction > 0
          ? [
              'perspective(1300px) rotateY(' + baseAngle + 'deg) rotateZ(' + baseTilt + 'deg) translateZ(0px)',
              'perspective(1300px) rotateY(7deg) rotateZ(' + (baseTilt + .8) + 'deg) translateZ(8px)',
              'perspective(1300px) rotateY(86deg) rotateZ(' + (baseTilt + 2.8) + 'deg) translate3d(10px,-7px,22px)',
              'perspective(1300px) rotateY(151deg) rotateZ(' + (baseTilt + 1.5) + 'deg) translate3d(5px,-2px,9px)',
              'perspective(1300px) rotateY(180deg) rotateZ(' + baseTilt + 'deg) translateZ(0px)'
            ]
          : [
              'perspective(1300px) rotateY(180deg) rotateZ(' + baseTilt + 'deg) translateZ(0px)',
              'perspective(1300px) rotateY(148deg) rotateZ(' + (baseTilt + 1.2) + 'deg) translate3d(5px,-2px,10px)',
              'perspective(1300px) rotateY(72deg) rotateZ(' + (baseTilt + 2.6) + 'deg) translate3d(10px,-6px,20px)',
              'perspective(1300px) rotateY(4deg) rotateZ(' + (baseTilt + .6) + 'deg) translateZ(7px)',
              'perspective(1300px) rotateY(0deg) rotateZ(' + baseTilt + 'deg) translateZ(0px)'
            ];
        var frames = transforms.map(function (transform, i) {
          var offsets = [0, .12, .48, .76, 1];
          return {
            transform: transform,
            opacity: direction > 0 ? [1, 1, .72, 0, 0][i] : [0, 0, .72, 1, 1][i],
            filter: i === 2 ? 'drop-shadow(-17px 14px 12px rgba(35,32,25,.23))' : (i === 3 ? 'drop-shadow(-9px 8px 7px rgba(35,32,25,.13))' : 'drop-shadow(0 0 0 rgba(35,32,25,0))'),
            offset: offsets[i],
            easing: i === 1 ? 'cubic-bezier(.3,0,.7,.2)' : easeLift
          };
        });
        var animation = page.animate(frames, {
          duration: duration,
          delay: delay,
          easing: direction > 0 ? easeLift : easeSettle,
          fill: 'forwards'
        });
        activeAnimations.push(animation);
        return animation.finished.catch(function () {});
      };
      var playCycle = function () {
        if (busy || !visible || document.hidden) return;
        busy = true;
        // Keep the last sheet as a visual anchor so the cover never disappears completely.
        var pages = pageGroups[mq.matches ? 1 : 0].slice(0, 2);
        var turnGap = 2100;
        Promise.all(pages.map(function (page, index) {
          return animatePage(page, 1, index * turnGap, 1450);
        })).then(function () {
          if (!visible || document.hidden) { cancelAndReset(); return; }
          return Promise.all(pages.slice().reverse().map(function (page, index) {
            return animatePage(page, -1, index * 125, 1050);
          }));
        }).then(function () {
          activeAnimations.forEach(function (animation) { animation.cancel(); });
          activeAnimations = [];
          pageGroups.forEach(function (group) {
            group.forEach(function (page) { if (page) page.style.removeProperty('transform'); });
          });
          busy = false;
          if (visible && !document.hidden) timer = window.setTimeout(playCycle, 1800);
        });
      };
      var observer = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting && entries[0].intersectionRatio > .45;
        if (visible && !document.hidden) timer = window.setTimeout(playCycle, 900);
        else { window.clearTimeout(timer); cancelAndReset(); }
      }, { threshold: [.45, .7] });
      observer.observe(cover);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { window.clearTimeout(timer); cancelAndReset(); }
        else if (visible) timer = window.setTimeout(playCycle, 500);
      });
      mq.addEventListener ? mq.addEventListener('change', cancelAndReset) : mq.addListener(cancelAndReset);
    }
  } catch (e) { console.warn('[motion] 首页自动翻页失败', e); }

  /* ---------------- 1. Lenis 平滑滚动 ---------------- */
  try {
    if (!reduce && typeof window.Lenis === 'function') {
      var lenis = new window.Lenis({
        autoRaf: true,
        anchors: true,
        stopInertiaOnNavigate: true,
        // 更"绵"的惯性，让平滑滚动能被明显感觉到
        lerp: 0.085,
        // 弹窗内部要能正常滚动，不被接管
        prevent: function (node) {
          return !!(node && node.closest && node.closest('dialog'));
        }
      });

      // 关掉原生平滑滚动，避免和 Lenis 打架
      document.documentElement.style.scrollBehavior = 'auto';

      // 弹窗打开时暂停页面滚动
      var dialogs = Array.prototype.slice.call(document.querySelectorAll('dialog'));
      var sync = function () {
        var open = dialogs.some(function (d) { return d.open; });
        try { open ? lenis.stop() : lenis.start(); } catch (e) {}
      };
      dialogs.forEach(function (d) {
        d.addEventListener('close', sync);
        try {
          new MutationObserver(sync).observe(d, { attributes: true, attributeFilter: ['open'] });
        } catch (e) {}
      });
      sync();
      window.__lenis = lenis;
    }
  } catch (e) { console.warn('[motion] Lenis 初始化失败，已跳过平滑滚动', e); }

  /* ---------------- 2. 顶部阅读进度条 ---------------- */
  try {
    var bar = document.createElement('div');
    bar.id = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    var tick = false;
    var paintBar = function () {
      tick = false;
      var el = document.documentElement;
      var max = el.scrollHeight - el.clientHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    };
    var scheduleBar = function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(paintBar);
    };
    window.addEventListener('scroll', scheduleBar, { passive: true });
    window.addEventListener('resize', scheduleBar);
    paintBar();
  } catch (e) { console.warn('[motion] 进度条失败', e); }

  /* ---------------- 3. 导航滚动态 ---------------- */
  try {
    var nav = document.querySelector('.nav');
    if (nav) {
      var navTick = false;
      var paintNav = function () {
        navTick = false;
        nav.classList.toggle('is-scrolled', window.scrollY > 30);
      };
      window.addEventListener('scroll', function () {
        if (navTick) return;
        navTick = true;
        requestAnimationFrame(paintNav);
      }, { passive: true });
      paintNav();
    }
  } catch (e) { console.warn('[motion] 导航状态失败', e); }

  /* ---------------- 4. 滚动揭示 ---------------- */
  try {
    if (!reduce && 'IntersectionObserver' in window) {
      var SELECTORS = [
        '.section-head', '#featured > *', '.about > *', '.facts > div',
        '.resume-card', '#awards-grid > *', '.project-intro',
        '.project-gallery figure', '.project-next', '.contact > *'
      ];
      // 图片单独走「掀开」效果
      var WIPE_SELECTORS = [
        '.card-media img', '.feature .art', '.image-button img',
        '.hero-preview img', '.solo-case img', '.case-section img',
        '.pattern-section img', '.case-pair img'
      ];
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        });
      }, { rootMargin: '0px 0px -7% 0px', threshold: 0.08 });

      var scan = function () {
        var counter = new Map();
        SELECTORS.forEach(function (sel) {
          document.querySelectorAll(sel).forEach(function (el) {
            if (el.dataset.motionReveal === '1') return;
            el.dataset.motionReveal = '1';
            var n = counter.get(el.parentNode) || 0;
            counter.set(el.parentNode, n + 1);
            el.style.setProperty('--reveal-delay', Math.min(n, 5) * 110 + 'ms');
            el.classList.add('reveal');
            io.observe(el);
          });
        });
        // 图片「掀开」揭示：clip-path 从下往上揭开 + 轻微回缩
        WIPE_SELECTORS.forEach(function (sel) {
          document.querySelectorAll(sel).forEach(function (el) {
            if (el.dataset.motionWipe === '1') return;
            el.dataset.motionWipe = '1';
            var n = counter.get(el.parentNode) || 0;
            counter.set(el.parentNode, n + 1);
            el.style.setProperty('--reveal-delay', Math.min(n, 4) * 90 + 'ms');
            el.classList.add('wipe');
            io.observe(el);
          });
        });
      };
      scan();

      // 作品/奖项/弹窗内容是运行时渲染的，需要重新扫描
      var pending = false;
      var rescan = function () {
        if (pending) return;
        pending = true;
        setTimeout(function () { pending = false; try { scan(); } catch (e) {} }, 80);
      };
      var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].addedNodes && muts[i].addedNodes.length) { rescan(); return; }
        }
      });
      ['#featured', '#archive-grid', '#awards-grid', '#project-content', '#index-list']
        .forEach(function (sel) {
          var host = document.querySelector(sel);
          if (host) { try { mo.observe(host, { childList: true }); } catch (e) {} }
        });

      // 保险丝：万一观察器没触发，视口内的元素强制显示，绝不留白
      var safety = function () {
        document.querySelectorAll('.reveal:not(.is-in)').forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in');
        });
      };
      setTimeout(safety, 2500);
      window.addEventListener('load', function () { setTimeout(safety, 800); });
    }
  } catch (e) { console.warn('[motion] 滚动揭示失败', e); }

  /* ---------------- 5. 图片渐显（带兜底） ---------------- */
  try {
    var fadeImages = function () {
      var imgs = document.querySelectorAll('img:not([data-motion-img])');
      Array.prototype.forEach.call(imgs, function (img) {
        img.setAttribute('data-motion-img', '1');
        if (img.complete && img.naturalWidth) return;   // 已在缓存里，无需渐显
        img.classList.add('motion-img', 'img-pending');
        var done = function () {
          if (!img.classList.contains('img-pending')) return;
          img.classList.remove('img-pending');          // 移掉即淡入
        };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, 1500);                          // 兜底：绝不留白
      });
    };
    fadeImages();
    setTimeout(fadeImages, 300);
    new MutationObserver(function (m) {
      for (var i = 0; i < m.length; i++) {
        if (m[i].addedNodes && m[i].addedNodes.length) { setTimeout(fadeImages, 60); return; }
      }
    }).observe(document.body, { childList: true, subtree: true });
  } catch (e) { console.warn('[motion] 图片渐显失败', e); }
})();
