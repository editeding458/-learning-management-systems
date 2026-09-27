document.addEventListener('DOMContentLoaded', () => {
    initializeSidebar();
    setActiveNavigation();
    initializeNotifications();
    initializeSearchAndExport();
    initializeStudentsPage();
    initializeRevenueChart();
    initializeModulePage();
    initializeSupportDialog();
});

const readStorage = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
};

const escapeHTML = (str) => String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const downloadCSV = (rows, filename) => {
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
};

const showToast = (msg) => {
    document.querySelector('.toast-message')?.remove();
    const t = Object.assign(document.createElement('div'), { className: 'toast-message', textContent: msg });
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
};

function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay') || Object.assign(document.createElement('div'), { className: 'sidebar-overlay' });
    if (!document.body.contains(overlay)) document.body.appendChild(overlay);

    const toggle = (show = !sidebar?.classList.contains('active')) => {
        sidebar?.classList.toggle('active', show);
        overlay.classList.toggle('active', show);
    };

    document.getElementById('sidebarToggle')?.addEventListener('click', () => toggle());
    document.getElementById('sidebarClose')?.addEventListener('click', () => toggle(false));
    overlay.addEventListener('click', () => toggle(false));
}

function setActiveNavigation() {
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        if (new URL(link.href, window.location.href).pathname === window.location.pathname) {
            document.querySelector('.sidebar-menu a.active')?.classList.remove('active');
            link.classList.add('active');
        }
    });
}

function initializeNotifications() {
    const btn = document.querySelector('.notification');
    if (!btn) return;

    if (btn.tagName !== 'BUTTON') Object.assign(btn, { tabIndex: 0 }), btn.setAttribute('role', 'button');

    const wrap = Object.assign(document.createElement('div'), { className: 'notification-wrap' });
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);

    const menu = Object.assign(document.createElement('section'), {
        className: 'notification-menu', id: 'notificationMenu', hidden: true,
        innerHTML: '<h3>Recent notifications</h3><p><strong>12 assignments</strong> waiting for review.</p><p><strong>New enrollment:</strong> Rahul Sharma joined.</p><p><strong>Payment:</strong> $89.00 completed.</p>'
    });
    wrap.appendChild(menu);
    btn.setAttribute('aria-controls', menu.id);

    const toggleMenu = (open) => {
        const isOpen = open ?? btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isOpen));
        menu.hidden = isOpen;
    };

    btn.addEventListener('click', () => toggleMenu());
    btn.addEventListener('keydown', e => ['Enter', ' '].includes(e.key) && (e.preventDefault(), toggleMenu()));
    document.addEventListener('click', e => !wrap.contains(e.target) && toggleMenu(true));
}

function initializeSearchAndExport() {
    const searchInput = document.getElementById('enrollmentSearch');
    const table = document.getElementById('enrollmentTable');
    const empty = document.getElementById('enrollmentEmpty');

    searchInput?.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        let visible = 0;
        table?.querySelectorAll('tbody tr').forEach(row => {
            row.hidden = !row.textContent.toLowerCase().includes(query);
            if (!row.hidden) visible++;
        });
        if (empty) empty.hidden = visible > 0;
    });

    document.getElementById('exportEnrollments')?.addEventListener('click', () => {
        if (!table) return;
        const rows = [...table.querySelectorAll('tr')].filter(r => !r.hidden);
        const data = rows.map(r => [...r.cells].map(c => c.innerText.replace(/\s+/g, ' ').trim()));
        downloadCSV(data, 'recent-enrollments.csv');
    });
}

function initializeStudentsPage() {
    const search = document.getElementById('studentSearch'), table = document.getElementById('studentsTable'), empty = document.getElementById('studentsEmpty'), alertBox = document.getElementById('studentAlert');
    if (!table) return;

    let timer;
    const showAlert = msg => {
        alertBox.textContent = msg;
        alertBox.hidden = false;
        clearTimeout(timer);
        timer = setTimeout(() => alertBox.hidden = true, 3000);
    };

    search?.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        const rows = [...table.querySelectorAll('tbody tr')];
        rows.forEach(r => r.hidden = !r.textContent.toLowerCase().includes(q));
        if (empty) empty.hidden = rows.some(r => !r.hidden);
    });

    table.addEventListener('click', e => {
        const btn = e.target.closest('.student-status-toggle');
        if (!btn) return;
        const row = btn.closest('tr');
        const status = row.querySelector('[data-student-status]');
        const isInactive = status.textContent.trim() === 'Active';

        status.textContent = isInactive ? 'Inactive' : 'Active';
        status.className = `status-pill ${isInactive ? 'status-inactive' : 'status-active'}`;
        btn.textContent = isInactive ? 'Activate' : 'Deactivate';
        showAlert(`${row.querySelector('strong').textContent} is now ${status.textContent.toLowerCase()}.`);
    });
}

function initializeRevenueChart() {
    const period = document.getElementById('revenuePeriod'), bars = document.getElementById('revenueBars');
    if (!period || !bars) return;

    const data = {
        month: [['$8.2k', '42%', 'Apr'], ['$10.4k', '53%', 'May'], ['$9.6k', '49%', 'Jun'], ['$12.8k', '65%', 'Jul'], ['$11.7k', '60%', 'Aug'], ['$14.1k', '72%', 'Sep'], ['$17.4k', '89%', 'Oct']],
        year: [['$9.1k', '46%', 'Jan'], ['$10.6k', '54%', 'Feb'], ['$11.2k', '57%', 'Mar'], ['$12.8k', '65%', 'Apr'], ['$13.4k', '68%', 'May'], ['$15.2k', '77%', 'Jun'], ['$17.4k', '89%', 'Jul']]
    };

    period.addEventListener('change', () => {
        bars.innerHTML = data[period.value].map(([amt, h, m], i) => `<div class="chart-column${i === 6 ? ' is-current' : ''}"><span class="bar-value">${amt}</span><span class="chart-bar" style="--bar-height: ${h}"></span><span class="bar-label">${m}</span></div>`).join('');
    });
}

function initializeModulePage() {
    const pageName = window.location.pathname.split('/').pop().replace(/\.html$/i, '');
    const configs = {
        'add-course': {
            title: 'Course catalogue', desc: 'Create and publish courses.', action: 'Save course',
            fields: [{ name: 'title', label: 'Course title', required: true }, { name: 'category', label: 'Category', required: true }, { name: 'instructor', label: 'Instructor', required: true }, { name: 'price', label: 'Price (USD)', type: 'number', required: true }, { name: 'status', label: 'Status', type: 'select', options: ['Draft', 'Published'] }],
            columns: [['title', 'Course'], ['category', 'Category'], ['instructor', 'Instructor'], ['price', 'Price'], ['status', 'Status']],
            rows: [{ title: 'Full-Stack Web Development', category: 'Development', instructor: 'David Kim', price: '$89', status: 'Published' }, { title: 'UI/UX Design Masterclass', category: 'Design', instructor: 'Aisha Patel', price: '$64', status: 'Published' }]
        },
        'add-instructor': {
            title: 'Instructor directory', desc: 'Register instructors and their specialties.', action: 'Add instructor',
            fields: [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'specialty', label: 'Specialty', required: true }],
            columns: [['name', 'Instructor'], ['email', 'Email'], ['specialty', 'Specialty'], ['status', 'Status']],
            rows: [{ name: 'David Kim', email: 'david@example.com', specialty: 'Web development', status: 'Active' }, { name: 'Aisha Patel', email: 'aisha@example.com', specialty: 'Product design', status: 'Active' }]
        },
        announcements: {
            title: 'Broadcast messages', desc: 'Share updates with students and instructors.', action: 'Publish announcement',
            fields: [{ name: 'title', label: 'Title', required: true }, { name: 'message', label: 'Message', type: 'textarea', required: true }, { name: 'audience', label: 'Audience', type: 'select', options: ['All users', 'Students', 'Instructors'] }],
            columns: [['title', 'Announcement'], ['audience', 'Audience'], ['created', 'Created'], ['status', 'Status']],
            rows: [{ title: 'October learning challenge', audience: 'All users', created: '26 Sep 2026', status: 'Scheduled' }, { title: 'New design courses available', audience: 'Students', created: '24 Sep 2026', status: 'Published' }]
        },
        assignments: {
            title: 'Assignment submissions', desc: 'Review student submissions and grading progress.', action: 'Add assignment', rowAction: 'Mark graded', doneStatus: 'Graded',
            fields: [{ name: 'title', label: 'Assignment', required: true }, { name: 'course', label: 'Course', required: true }, { name: 'due', label: 'Due date', type: 'date', required: true }, { name: 'submissions', label: 'Submissions', type: 'number', required: true }],
            columns: [['title', 'Assignment'], ['course', 'Course'], ['due', 'Due date'], ['submissions', 'Submissions'], ['status', 'Status']],
            rows: [{ title: 'Build a portfolio site', course: 'Full-Stack Web Dev', due: '30 Sep 2026', submissions: '12', status: 'Needs review' }, { title: 'Wireframe a mobile app', course: 'UI/UX Design', due: '02 Oct 2026', submissions: '8', status: 'In progress' }]
        },
        backup: {
            title: 'System backups', desc: 'Create a local backup record. No server database is connected.', action: 'Create snapshot', fields: [],
            columns: [['name', 'Snapshot'], ['created', 'Created'], ['size', 'Size'], ['status', 'Status']],
            rows: [{ name: 'platform-backup-2026-09-26', created: '26 Sep 2026, 09:15', size: '2.4 MB', status: 'Complete' }]
        },
        certificates: {
            title: 'Issued certificates', desc: 'Record course completions and certificate references.', action: 'Issue certificate',
            fields: [{ name: 'student', label: 'Student', required: true }, { name: 'course', label: 'Course', required: true }],
            columns: [['student', 'Student'], ['course', 'Course'], ['issued', 'Issued'], ['reference', 'Reference'], ['status', 'Status']],
            rows: [{ student: 'Anika Rao', course: 'Intro to Python', issued: '22 Sep 2026', reference: 'CERT-1042', status: 'Issued' }]
        },
        coupons: {
            title: 'Discount coupons', desc: 'Create and track course offers.', action: 'Create coupon',
            fields: [{ name: 'code', label: 'Coupon code', required: true }, { name: 'discount', label: 'Discount (%)', type: 'number', required: true }, { name: 'limit', label: 'Usage limit', type: 'number', required: true }, { name: 'expires', label: 'Expiry date', type: 'date', required: true }],
            columns: [['code', 'Code'], ['discount', 'Discount'], ['limit', 'Usage limit'], ['expires', 'Expires'], ['status', 'Status']],
            rows: [{ code: 'LEARN20', discount: '20%', limit: '500', expires: '31 Dec 2026', status: 'Active' }, { code: 'WELCOME10', discount: '10%', limit: '1,000', expires: '30 Nov 2026', status: 'Active' }]
        },
        courses: {
            title: 'Course catalogue', desc: 'Review published courses and enrollment totals.',
            columns: [['title', 'Course'], ['category', 'Category'], ['students', 'Students'], ['price', 'Price'], ['status', 'Status']],
            rows: [{ title: 'Full-Stack Web Development', category: 'Development', students: '4,820', price: '$89', status: 'Published' }, { title: 'UI/UX Design Masterclass', category: 'Design', students: '3,640', price: '$64', status: 'Published' }, { title: 'Data Analytics with Python', category: 'Data', students: '2,910', price: '$79', status: 'Published' }]
        },
        enrollments: {
            title: 'Enrollment history', desc: 'Review subscriptions and payment status.',
            columns: [['student', 'Student'], ['course', 'Course'], ['date', 'Enrolled'], ['amount', 'Amount'], ['status', 'Status']],
            rows: [{ student: 'Rahul Sharma', course: 'Full-Stack Web Dev', date: '26 Sep 2026', amount: '$89.00', status: 'Active' }, { student: 'Priya Verma', course: 'UI/UX Design', date: '25 Sep 2026', amount: '$64.00', status: 'Active' }, { student: 'Arjun Mehta', course: 'Data Analytics', date: '24 Sep 2026', amount: '$79.00', status: 'Pending' }]
        },
        export: {
            title: 'Export reports', desc: 'Download sample reports as CSV.', download: true,
            fields: [{ name: 'dataset', label: 'Dataset', type: 'select', options: ['courses', 'enrollments', 'coupons', 'announcements'] }]
        },
        'live-classes': {
            title: 'Upcoming live sessions', desc: 'Schedule instructor-led webinars and workshops.', action: 'Schedule class',
            fields: [{ name: 'title', label: 'Session title', required: true }, { name: 'instructor', label: 'Instructor', required: true }, { name: 'schedule', label: 'Date and time', type: 'datetime-local', required: true }],
            columns: [['title', 'Session'], ['instructor', 'Instructor'], ['schedule', 'Date and time'], ['status', 'Status']],
            rows: [{ title: 'Building accessible interfaces', instructor: 'Aisha Patel', schedule: '28 Sep 2026, 16:00', status: 'Scheduled' }, { title: 'React patterns workshop', instructor: 'David Kim', schedule: '30 Sep 2026, 11:30', status: 'Scheduled' }]
        },
        notifications: {
            title: 'Recent notifications', desc: 'Review system events and mark them as read.', rowAction: 'Mark read', doneStatus: 'Read',
            columns: [['event', 'Notification'], ['detail', 'Details'], ['time', 'Received'], ['status', 'Status']],
            rows: [{ event: 'Assignment review needed', detail: '12 submissions await grading.', time: '24 minutes ago', status: 'Unread' }, { event: 'New enrollment', detail: 'Rahul Sharma joined Full-Stack Web Dev.', time: '1 hour ago', status: 'Unread' }, { event: 'Payment received', detail: '$89.00 payment completed.', time: '2 hours ago', status: 'Read' }]
        },
        profile: {
            title: 'Profile information', desc: 'Update administrator details in this browser.', action: 'Save profile', saveOnly: true,
            fields: [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'role', label: 'Role', required: true }]
        },
        rating: {
            title: 'Course ratings', desc: 'Compare student feedback across courses.',
            columns: [['course', 'Course'], ['rating', 'Average rating'], ['reviews', 'Reviews'], ['trend', 'Trend']],
            rows: [{ course: 'Intro to Python', rating: '4.9 / 5', reviews: '1,204', trend: 'Up 0.2' }, { course: 'UI/UX Design Masterclass', rating: '4.8 / 5', reviews: '986', trend: 'Steady' }, { course: 'Full-Stack Web Development', rating: '4.7 / 5', reviews: '2,340', trend: 'Up 0.1' }]
        },
        revenue: {
            title: 'Recent transactions', desc: 'Review sample platform transactions.',
            columns: [['date', 'Date'], ['student', 'Student'], ['course', 'Course'], ['amount', 'Amount'], ['status', 'Status']],
            rows: [{ date: '26 Sep 2026', student: 'Rahul Sharma', course: 'Full-Stack Web Dev', amount: '$89.00', status: 'Paid' }, { date: '25 Sep 2026', student: 'Priya Verma', course: 'UI/UX Design', amount: '$64.00', status: 'Paid' }, { date: '24 Sep 2026', student: 'Arjun Mehta', course: 'Data Analytics', amount: '$79.00', status: 'Pending' }]
        },
        reviews: {
            title: 'Course feedback', desc: 'Review and resolve student feedback.', rowAction: 'Resolve', doneStatus: 'Resolved',
            columns: [['student', 'Student'], ['course', 'Course'], ['rating', 'Rating'], ['comment', 'Review'], ['status', 'Status']],
            rows: [{ student: 'Priya Verma', course: 'UI/UX Design', rating: '5 / 5', comment: 'Clear lessons and useful projects.', status: 'New' }, { student: 'Arjun Mehta', course: 'Data Analytics', rating: '4 / 5', comment: 'Great pace, more practice would help.', status: 'New' }]
        },
        roles: {
            title: 'Access control', desc: 'Manage demo roles. Enforcement needs a backend.', action: 'Add role',
            fields: [{ name: 'role', label: 'Role name', required: true }, { name: 'description', label: 'Description', required: true }, { name: 'access', label: 'Access level', type: 'select', options: ['Read only', 'Manage courses', 'Full access'] }],
            columns: [['role', 'Role'], ['description', 'Description'], ['access', 'Access'], ['status', 'Status']],
            rows: [{ role: 'Administrator', description: 'Full platform management', access: 'Full access', status: 'Active' }, { role: 'Instructor', description: 'Manage assigned courses', access: 'Manage courses', status: 'Active' }]
        },
        settings: {
            title: 'Global configurations', desc: 'Save preferences in this browser. Payments need a backend.', action: 'Save settings', saveOnly: true,
            fields: [{ name: 'platform', label: 'Platform name', required: true }, { name: 'email', label: 'Support email', type: 'email', required: true }, { name: 'currency', label: 'Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'INR'] }]
        }
    };

    const config = configs[pageName];
    const body = document.querySelector('.dash-body');
    if (!config || !body) return;

    const storageKey = `lms-admin-${pageName}`;
    const getRecords = () => {
        const saved = readStorage(storageKey, []);
        return [...(config.rows || []), ...(Array.isArray(saved) ? saved : [])];
    };
    const makeField = ({ name, label, type = 'text', required, options = [] }) => {
        const attrs = required ? ' required' : '';
        const input = type === 'select'
            ? `<select name="${escapeHTML(name)}"${attrs}>${options.map(option => `<option>${escapeHTML(option)}</option>`).join('')}</select>`
            : type === 'textarea'
                ? `<textarea name="${escapeHTML(name)}"${attrs}></textarea>`
                : `<input name="${escapeHTML(name)}" type="${escapeHTML(type)}"${attrs}${type === 'number' ? ' min="0" step="any"' : ''}>`;
        return `<label class="module-field">${escapeHTML(label)}${input}</label>`;
    };
    const form = config.fields ? `<section class="module-panel"><h2>${escapeHTML(config.action)}</h2><p>Changes are saved in this browser for this demo.</p><form class="module-form" id="moduleForm">${config.fields.map(makeField).join('')}<button class="button button-primary" type="submit">${escapeHTML(config.download ? 'Download CSV' : config.action)}</button></form></section>` : '';
    const table = config.columns ? `<section class="module-panel"><h2>${escapeHTML(config.title)}</h2><div id="moduleTable"></div></section>` : '';
    const note = config.saveOnly ? '<p class="module-note">Saved preferences stay in this browser and do not change platform services.</p>' : '';
    body.innerHTML = `<section class="module-content"><header class="module-summary"><div><p class="eyebrow">ADMIN</p><h1>${escapeHTML(config.title)}</h1><p>${escapeHTML(config.desc)}</p></div></header><div class="module-layout${config.columns ? '' : ' is-single'}">${form}${table}</div>${note}</section>`;

    const renderTable = () => {
        const records = getRecords();
        const headings = config.columns.map(([, label]) => `<th>${escapeHTML(label)}</th>`).join('');
        const actions = config.rowAction ? '<th>Action</th>' : '';
        const rows = records.map((record, index) => {
            const cells = config.columns.map(([key]) => {
                const value = escapeHTML(record[key]);
                if (key !== 'status') return `<td>${value}</td>`;
                const state = /active|published|paid|complete|issued|read|resolved|graded/i.test(value) ? ' is-positive' : /pending|scheduled|progress|draft/i.test(value) ? ' is-pending' : ' is-alert';
                return `<td><span class="module-badge${state}">${value}</span></td>`;
            }).join('');
            const action = config.rowAction ? `<td>${record.status === config.doneStatus ? 'Done' : `<button class="module-row-action" type="button" data-row="${index}">${escapeHTML(config.rowAction)}</button>`}</td>` : '';
            return `<tr>${cells}${action}</tr>`;
        }).join('');
        document.getElementById('moduleTable').innerHTML = `<div class="module-table-wrap"><table class="module-table"><thead><tr>${headings}${actions}</tr></thead><tbody>${rows}</tbody></table></div>`;
    };

    if (config.columns) renderTable();
    if (config.saveOnly) {
        Object.entries(readStorage(storageKey, {})).forEach(([name, value]) => {
            const field = document.getElementById('moduleForm')?.elements.namedItem(name);
            if (field) field.value = value;
        });
    }

    document.getElementById('moduleForm')?.addEventListener('submit', event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget).entries());
        if (config.download) {
            const source = configs[values.dataset];
            const saved = readStorage(`lms-admin-${values.dataset}`, []);
            const records = [...(source?.rows || []), ...(Array.isArray(saved) ? saved : [])];
            if (records.length) downloadCSV([Object.keys(records[0]), ...records.map(record => Object.values(records[0]).map((_, i) => record[Object.keys(records[0])[i]]))], `${values.dataset}-report.csv`);
            else showToast('No records available.');
            return;
        }
        if (config.saveOnly) {
            localStorage.setItem(storageKey, JSON.stringify(values));
            showToast('Changes saved in this browser.');
            return;
        }
        const records = getRecords();
        if (pageName === 'add-course') values.price = `$${values.price}`;
        if (pageName === 'coupons') values.discount = `${values.discount}%`;
        if (pageName === 'live-classes') values.schedule = new Date(values.schedule).toLocaleString();
        if (pageName === 'announcements') Object.assign(values, { created: new Date().toLocaleDateString(), status: 'Published' });
        if (pageName === 'certificates') Object.assign(values, { issued: new Date().toLocaleDateString(), reference: `CERT-${Date.now().toString().slice(-6)}`, status: 'Issued' });
        if (pageName === 'backup') Object.assign(values, { name: `platform-backup-${new Date().toISOString().slice(0, 10)}`, created: new Date().toLocaleString(), size: 'Local snapshot', status: 'Complete' });
        if (['add-instructor', 'roles'].includes(pageName)) values.status = 'Active';
        if (pageName === 'assignments') values.status = 'Needs review';
        records.push(values);
        localStorage.setItem(storageKey, JSON.stringify(records.slice((config.rows || []).length)));
        event.currentTarget.reset();
        renderTable();
        showToast(`${config.action} saved.`);
    });

    body.addEventListener('click', event => {
        const button = event.target.closest('[data-row]');
        if (!button) return;
        const records = getRecords();
        records[Number(button.dataset.row)].status = config.doneStatus;
        localStorage.setItem(storageKey, JSON.stringify(records.slice((config.rows || []).length)));
        renderTable();
        showToast(`Marked ${String(config.doneStatus).toLowerCase()}.`);
    });
}

function initializeSupportDialog() {
    const links = document.querySelectorAll('.sidebar-menu a[href="support.html"]');
    if (!links.length) return;

    const dialog = Object.assign(document.createElement('div'), {
        className: 'support-dialog', hidden: true,
        innerHTML: '<section class="support-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="supportTitle" tabindex="-1"><div class="support-dialog-heading"><div><p class="eyebrow">SUPPORT</p><h2 id="supportTitle">Support tickets</h2></div><button class="support-dialog-close" type="button" aria-label="Close support tickets">&times;</button></div><form class="module-form" id="supportTicketForm"><label class="module-field">Subject<input name="subject" required></label><label class="module-field">Email<input name="email" type="email" required></label><label class="module-field">Details<textarea name="details" required></textarea></label><button class="button button-primary" type="submit">Add ticket</button></form><div class="support-ticket-list" aria-live="polite"></div></section>'
    });
    document.body.appendChild(dialog);

    const panel = dialog.querySelector('.support-dialog-panel');
    const form = dialog.querySelector('#supportTicketForm');
    const list = dialog.querySelector('.support-ticket-list');
    const render = () => {
        const tickets = readStorage('lms-admin-support', []);
        list.replaceChildren();
        if (!Array.isArray(tickets) || !tickets.length) {
            list.textContent = 'No support tickets yet.';
            return;
        }
        tickets.slice().reverse().forEach(ticket => {
            const item = document.createElement('article');
            item.className = 'support-ticket';
            item.textContent = `${ticket.subject} · ${ticket.email} · ${ticket.created}`;
            list.appendChild(item);
        });
    };
    const close = () => { dialog.hidden = true; };

    links.forEach(link => link.addEventListener('click', event => {
        event.preventDefault();
        render();
        dialog.hidden = false;
        panel.focus();
    }));
    dialog.querySelector('.support-dialog-close').addEventListener('click', close);
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !dialog.hidden) close(); });
    form.addEventListener('submit', event => {
        event.preventDefault();
        const tickets = readStorage('lms-admin-support', []);
        tickets.push({ ...Object.fromEntries(new FormData(form)), created: new Date().toLocaleString() });
        localStorage.setItem('lms-admin-support', JSON.stringify(tickets));
        form.reset();
        render();
        showToast('Support ticket saved.');
    });
}