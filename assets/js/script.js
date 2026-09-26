document.addEventListener('DOMContentLoaded', () => {

    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    const icon = hamburger ? hamburger.querySelector('i') : null;

    const toggleMenu = () => {
        navLinks.classList.toggle('active');
        const isActive = navLinks.classList.contains('active');
        icon.className = isActive ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'; // Easily switch icons
    };

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', toggleMenu);

        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                if (navLinks.classList.contains('active')) toggleMenu();
            });
        });
    }

    const runCounters = () => {
        document.querySelectorAll('.counter').forEach(counter => {
            const target = +counter.getAttribute('data-target');
            let count = 0;
            const step = target / 50;

            const timer = setInterval(() => {
                count += step;
                if (count >= target) {
                    counter.innerText = target + "+";
                    clearInterval(timer);
                } else {
                    counter.innerText = Math.ceil(count);
                }
            }, 30);
        });
    };

    let countersAnimated = false;

    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');

                if (!countersAnimated && entry.target.closest('#stats')) {
                    runCounters();
                    countersAnimated = true;
                }


                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    const animatedElements = document.querySelectorAll('.animate-slide-left, .animate-slide-right, .animate-fade-in, .animate-zoom, #stats');
    animatedElements.forEach(el => scrollObserver.observe(el));
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Your request has been submitted successfully! We will contact you shortly.');
            contactForm.reset();
        });
    }
});