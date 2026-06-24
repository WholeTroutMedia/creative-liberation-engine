import { slideDataPart1 } from './slides-part1.js';
import { slideDataPart2 } from './slides-part2.js';

export class SlideController {
  constructor() {
    this.slides = [...slideDataPart1, ...slideDataPart2];
    this.currentIndex = 0;
    this.canvas = document.getElementById('presentation-canvas');
    this.navDots = document.getElementById('nav-dots');
    this.btnPrev = document.getElementById('btn-prev');
    this.btnNext = document.getElementById('btn-next');
    this.slideElements = [];
  }

  init() {
    this.renderSlides();
    this.renderNavDots();
    this.bindEvents();
    this.updateView();
  }

  renderSlides() {
    this.canvas.innerHTML = '';
    this.slideElements = this.slides.map((slideHTML, index) => {
      const slideEl = document.createElement('div');
      slideEl.className = 'bento-slide glass-panel';
      // If the slide definition is just HTML string, we wrap it.
      // But we can assume slideHTML actually defines the inner bento items.
      slideEl.innerHTML = slideHTML;
      
      // Inject close buttons into all interactive bento items
      const interactiveItems = slideEl.querySelectorAll('.bento-item.interactive');
      interactiveItems.forEach(item => {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-close-expand';
        closeBtn.innerHTML = '<i class="ph ph-x"></i>';
        item.appendChild(closeBtn);

        // Click to expand
        item.addEventListener('click', (e) => {
          if (e.target.closest('.btn-close-expand') || e.target.closest('a') || e.target.closest('button:not(.btn-close-expand)')) return;
          
          // Collapse any currently expanded items
          document.querySelectorAll('.bento-item.expanded').forEach(el => el.classList.remove('expanded'));
          
          // Expand this item
          item.classList.add('expanded');
        });

        // Click close to collapse
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          item.classList.remove('expanded');
        });
      });

      this.canvas.appendChild(slideEl);
      return slideEl;
    });
  }

  renderNavDots() {
    this.navDots.innerHTML = '';
    this.slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'nav-dot';
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      dot.addEventListener('click', () => this.goTo(i));
      this.navDots.appendChild(dot);
    });
  }

  bindEvents() {
    this.btnPrev.addEventListener('click', () => this.prev());
    this.btnNext.addEventListener('click', () => this.next());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        this.next();
      } else if (e.key === 'ArrowLeft') {
        this.prev();
      } else if (e.key === 'Escape') {
        // Collapse expanded item
        document.querySelectorAll('.bento-item.expanded').forEach(el => el.classList.remove('expanded'));
      }
    });
  }

  next() {
    if (this.currentIndex < this.slides.length - 1) {
      this.goTo(this.currentIndex + 1);
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.goTo(this.currentIndex - 1);
    }
  }

  goTo(index) {
    if (index === this.currentIndex) return;
    
    const isForward = index > this.currentIndex;
    const oldIndex = this.currentIndex;
    this.currentIndex = index;
    
    // Collapse any expanded items before switching
    document.querySelectorAll('.bento-item.expanded').forEach(el => el.classList.remove('expanded'));

    this.updateView(oldIndex, isForward);
  }

  updateView(oldIndex = -1, isForward = true) {
    // Update dots
    const dots = this.navDots.querySelectorAll('.nav-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === this.currentIndex);
    });

    // Update buttons
    this.btnPrev.style.opacity = this.currentIndex === 0 ? '0.5' : '1';
    this.btnPrev.style.pointerEvents = this.currentIndex === 0 ? 'none' : 'auto';
    
    this.btnNext.style.opacity = this.currentIndex === this.slides.length - 1 ? '0.5' : '1';
    this.btnNext.style.pointerEvents = this.currentIndex === this.slides.length - 1 ? 'none' : 'auto';

    // Transition slides
    this.slideElements.forEach((el, i) => {
      el.className = 'bento-slide glass-panel'; // reset classes
      if (i === this.currentIndex) {
        el.classList.add('active');
      } else if (i < this.currentIndex) {
        el.classList.add('outgoing-left');
      } else if (i > this.currentIndex) {
        el.classList.add('outgoing-right');
      }
    });
  }
}
