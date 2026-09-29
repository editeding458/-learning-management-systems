(() => {
    const ticketKey = 'lms-admin-support';
    const notificationKey = 'lms-notifications';
    const fallbackCategories = ['Course access', 'Course content', 'Payment', 'Account or profile', 'Assignment', 'Live class or schedule', 'Technical problem', 'Other'];

    const readJSON = (key, fallback) => {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value ?? fallback;
        } catch {
            return fallback;
        }
    };

    const forms = [...document.querySelectorAll('[data-issue-report-form]')];
    const categorySelects = forms.map(form => form.elements.namedItem('category')).filter(Boolean);
    const categoryScript = [...document.scripts].find(script => script.src.endsWith('/report-issue.js'));

    if (categoryScript) {
        const categoriesUrl = new URL('../data/support-categories.json', categoryScript.src);
        fetch(categoriesUrl)
            .then(response => response.ok ? response.json() : fallbackCategories)
            .then(categories => {
                if (!Array.isArray(categories)) return;
                categorySelects.forEach(select => {
                    const selectedValue = select.value;
                    select.replaceChildren(new Option('Choose an issue type', ''));
                    categories.forEach(category => select.add(new Option(category, category)));
                    select.value = selectedValue;
                });
            })
            .catch(() => {});
    }

    forms.forEach(form => {
        form.addEventListener('submit', event => {
            event.preventDefault();
            const user = readJSON('loggedInUser', null);
            if (!user || user.role !== 'student') return;

            const values = Object.fromEntries(new FormData(form).entries());
            const ticket = {
                id: globalThis.crypto?.randomUUID?.() || `issue-${Date.now()}`,
                subject: values.subject.trim(),
                category: values.category,
                details: values.details.trim(),
                email: user.email || '',
                reporterName: user.name || user.role,
                reporterRole: user.role,
                created: new Date().toLocaleString(),
                status: 'Open'
            };
            const tickets = readJSON(ticketKey, []);
            const safeTickets = Array.isArray(tickets) ? tickets : [];
            safeTickets.unshift(ticket);
            localStorage.setItem(ticketKey, JSON.stringify(safeTickets.slice(0, 100)));

            const notifications = readJSON(notificationKey, []);
            const safeNotifications = Array.isArray(notifications) ? notifications : [];
            safeNotifications.unshift({
                text: `New ${user.role} issue: ${ticket.category}`,
                detail: `${ticket.reporterName} (${ticket.email})`,
                read: false,
                created: new Date().toISOString()
            });
            localStorage.setItem(notificationKey, JSON.stringify(safeNotifications.slice(0, 50)));

            form.reset();
            const status = form.querySelector('[data-issue-report-status]');
            if (status) status.textContent = 'Report sent to the admin support queue.';
        });
    });
})();