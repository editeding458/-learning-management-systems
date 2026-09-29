document.addEventListener('DOMContentLoaded', () => {
    initializeSession('admin');
    initializeSidebar();
    setActiveNavigation();
    initializeNotifications();
    initializeSearchAndExport();
    initializeStudentsPage();
    initializeRevenueChart();
    initializeAdminOverview();
    initializeProfileNavigation('profile.html');
    initializeModulePage();
});

function initializeSession(requiredRole) {
    const user = readStorage('loggedInUser', null);
    if (!user || user.role !== requiredRole) {
        window.location.href = '../signin.html';
        return;
    }

    document.querySelectorAll('.user-profile span').forEach(name => {
        name.textContent = user.name || 'Admin User';
    });
    document.querySelectorAll('.user-profile img').forEach(image => {
        image.alt = `${user.name || 'Admin'} profile`;
    });
    document.querySelectorAll('.sidebar-menu a[href="../index.html"]').forEach(link => {
        link.addEventListener('click', () => localStorage.removeItem('loggedInUser'));
    });
}

const readStorage = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
};

const escapeHTML = (str) => String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const formatElapsedDuration = (startTime, endTime = Date.now()) => {
    const totalSeconds = Math.max(0, Math.floor((endTime - new Date(startTime).getTime()) / 1000));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

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

const writeStorage = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const addAdminNotification = (text, detail = '') => {
    const notifications = readStorage('lms-notifications', []);
    notifications.unshift({ text, detail, read: false, created: new Date().toISOString() });
    writeStorage('lms-notifications', notifications.slice(0, 50));
};

const notifyStudents = (message, title = 'New update from Tech LMS', audience = 'Students') => {
    const users = readStorage('usersDB', []);
    users.filter(user => user.role === 'student' && user.status !== 'inactive' && user.isActive !== false && (!audience || audience === 'Students' || audience === 'All users' || user.email === audience)).forEach(user => {
        const key = `lms-student-notifications-${user.id || user.email}`;
        const notifications = readStorage(key, []);
        notifications.unshift({ title, message, read: false, created: new Date().toISOString() });
        writeStorage(key, notifications.slice(0, 50));
    });
};

function processScheduledRecords(records, type) {
    const key = type === 'announcement' ? 'lms-admin-announcements' : 'lms-admin-live-classes';
    const now = Date.now();
    let changed = false;
    records.forEach(record => {
        const releaseTime = new Date(type === 'announcement' ? record.publishAt : record.schedule).getTime();
        if (record.status === 'Scheduled' && Number.isFinite(releaseTime) && releaseTime <= now) {
            record.status = 'Published';
            changed = true;
        }
        if (record.status === 'Published' && Number.isFinite(releaseTime) && releaseTime <= now) {
            const storedUsers = readStorage('usersDB', []);
            const recipients = (Array.isArray(storedUsers) ? storedUsers : []).filter(user => user.role === 'student' && user.status !== 'inactive' && user.isActive !== false);
            record.notifiedTo = Array.isArray(record.notifiedTo) ? record.notifiedTo : [];
            recipients.filter(user => !record.notifiedTo.includes(user.email)).forEach(user => {
                notifyStudents(type === 'announcement' ? record.message : `${record.title} is starting now.`, record.title, user.email);
                record.notifiedTo.push(user.email);
                changed = true;
            });
        }
    });
    if (changed) writeStorage(key, records);
    return records;
}

function initializeProfileNavigation(destination) {
    document.querySelectorAll('.user-profile').forEach(profile => {
        profile.setAttribute('role', 'link');
        profile.setAttribute('tabindex', '0');
        profile.setAttribute('aria-label', 'Edit profile');
        profile.title = 'Edit profile';
        const navigate = () => { window.location.href = destination; };
        profile.addEventListener('click', navigate);
        profile.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate();
            }
        });
    });
}

function initializeAdminOverview() {
    const stats = document.querySelectorAll('.stats-row .stat-card .stat-info h3');
    if (!stats.length) return;
    const userRecords = readStorage('usersDB', []);
    const students = (Array.isArray(userRecords) ? userRecords : []).filter(user => user.role === 'student');
    const courseRecords = readStorage('lms-courses', []);
    const courses = Array.isArray(courseRecords) ? courseRecords : [];
    const enrollmentRecords = readStorage('lms-enrollments', []);
    const enrollments = Array.isArray(enrollmentRecords) ? enrollmentRecords : [];
    const paidRevenue = enrollments.filter(item => item.status === 'Paid').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const reviewRecords = readStorage('lms-reviews', []);
    const reviews = Array.isArray(reviewRecords) ? reviewRecords : [];
    const average = reviews.length ? (reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length).toFixed(1) : '0.0';
    [String(students.length), String(courses.filter(course => course.status === 'Published').length), `$${paidRevenue.toFixed(2)}`, `${average} / 5`].forEach((value, index) => {
        if (stats[index]) stats[index].textContent = value;
    });
    const tbody = document.querySelector('#enrollmentTable tbody');
    if (tbody) tbody.innerHTML = enrollments.slice().reverse().slice(0, 8).map(enrollment => `<tr><td><strong>${escapeHTML(enrollment.student || '')}</strong><small>${escapeHTML(enrollment.email || '')}</small></td><td>${escapeHTML(enrollment.course || '')}</td><td>${escapeHTML(enrollment.created ? new Date(enrollment.created).toLocaleDateString() : '')}</td><td>${Number(enrollment.amount || 0) ? `$${Number(enrollment.amount).toFixed(2)}` : 'Free'}</td><td><span class="status-pill ${enrollment.status === 'Paid' || enrollment.status === 'Free' ? 'status-active' : 'status-pending'}">${escapeHTML(enrollment.status)}</span></td></tr>`).join('');
    const empty = document.getElementById('enrollmentEmpty');
    if (empty) empty.hidden = enrollments.length > 0;

    const courseList = document.querySelector('.course-panel .course-list');
    if (courseList) {
        const published = courses.filter(course => course.status === 'Published').slice(0, 4);
        courseList.innerHTML = published.length ? published.map((course, index) => `<a class="course-item" href="courses.html"><span class="course-mark ${['mark-green', 'mark-yellow', 'mark-blue', 'mark-coral'][index]}"><i class="fa-solid fa-book-open" aria-hidden="true"></i></span><span class="course-detail"><strong>${escapeHTML(course.title)}</strong><span>${Number(course.assignedStudentCount || course.assignedStudentEmails?.length || 0)} assigned students</span></span><strong class="course-percent">${Number(course.price) ? `$${Number(course.price).toFixed(2)}` : 'Free'}</strong></a>`).join('') : '<p class="module-empty">No published courses yet.</p>';
    }
    const activityList = document.querySelector('.activity-list');
    const notifications = readStorage('lms-notifications', []);
    if (activityList) activityList.innerHTML = (Array.isArray(notifications) ? notifications : []).slice(0, 4).map(item => `<div class="activity-item"><span class="activity-icon activity-blue"><i class="fa-solid fa-bell" aria-hidden="true"></i></span><div><p><strong>${escapeHTML(item.text || 'Update')}</strong>${item.detail ? `<br>${escapeHTML(item.detail)}` : ''}</p><time>${escapeHTML(item.created ? new Date(item.created).toLocaleString() : '')}</time></div></div>`).join('') || '<p class="module-empty">No activity recorded yet.</p>';
    const chartTotal = document.querySelector('.chart-summary>strong');
    if (chartTotal) chartTotal.textContent = `$${paidRevenue.toFixed(2)}`;
    if (!window.adminOverviewStorageBound) {
        window.adminOverviewStorageBound = true;
        window.addEventListener('storage', event => {
            if (['usersDB', 'lms-courses', 'lms-enrollments', 'lms-reviews', 'lms-notifications'].includes(event.key)) initializeAdminOverview();
        });
    }
}

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
        link.classList.remove('active');
        if (new URL(link.href, window.location.href).pathname === window.location.pathname) {
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

    const badge = btn.querySelector('.badge');
    const menu = Object.assign(document.createElement('section'), {
        className: 'notification-menu', id: 'notificationMenu', hidden: true,
        innerHTML: '<h3>Recent notifications</h3>'
    });
    wrap.appendChild(menu);
    btn.setAttribute('aria-controls', menu.id);

    const renderNotifications = () => {
        const storedNotifications = readStorage('lms-notifications', []);
        const notifications = Array.isArray(storedNotifications) ? storedNotifications : [];
        const unreadCount = notifications.filter(item => !item.read).length;
        if (badge) badge.textContent = String(unreadCount);
        menu.innerHTML = `<h3>Recent notifications</h3>${notifications.length ? notifications.slice(0, 8).map(item => `<p class="${item.read ? 'is-read' : ''}"><strong>${escapeHTML(item.text)}</strong>${item.detail ? `<span>${escapeHTML(item.detail)}</span>` : ''}</p>`).join('') : '<p>No new notifications.</p>'}<div class="notification-actions"><button class="button button-outline notification-read" type="button">Mark all as read</button><button class="button button-outline notification-clear" type="button">Clear all</button></div>`;
    };
    renderNotifications();

    const toggleMenu = (open) => {
        const isOpen = open ?? btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isOpen));
        menu.hidden = isOpen;
    };

    btn.addEventListener('click', () => toggleMenu());
    btn.addEventListener('keydown', e => ['Enter', ' '].includes(e.key) && (e.preventDefault(), toggleMenu()));
    menu.addEventListener('click', event => {
        if (event.target.closest('.notification-clear')) writeStorage('lms-notifications', []);
        else if (event.target.closest('.notification-read')) writeStorage('lms-notifications', readStorage('lms-notifications', []).map(item => ({ ...item, read: true })));
        else return;
        renderNotifications();
        showToast(event.target.closest('.notification-clear') ? 'Notifications cleared.' : 'All notifications marked as read.');
    });
    document.addEventListener('click', e => !wrap.contains(e.target) && toggleMenu(true));
    window.addEventListener('storage', event => event.key === 'lms-notifications' && renderNotifications());
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
    const renderStudents = () => {
        const registeredStudents = readStorage('usersDB', []).filter(user => user.role === 'student');
        table.querySelector('tbody').innerHTML = registeredStudents.map(student => {
            const isActive = student.status !== 'inactive' && student.isActive !== false;
            const attendanceKey = `studentAttendanceLog-${encodeURIComponent(String(student.id || student.email || 'student'))}`;
            const attendance = readStorage(attendanceKey, []);
            const latestAttendance = Array.isArray(attendance) ? attendance.filter(entry => entry?.status && entry?.time).at(-1) : null;
            const attendanceTime = latestAttendance ? new Date(latestAttendance.time).toLocaleString() : 'No check-in yet';
            const liveTime = latestAttendance?.status === 'Checked In' ? formatElapsedDuration(latestAttendance.time) : '--:--:--';
            return `<tr data-student-email="${escapeHTML(student.email || '')}">
            <td><span class="student-cell"><span class="student-avatar" aria-hidden="true">${escapeHTML((student.name || 'Student').slice(0, 2).toUpperCase())}</span><span><strong>${escapeHTML(student.name || 'Student')}</strong><small>${escapeHTML(student.email || '')}</small></span></span></td>
            <td>${escapeHTML(student.enrolledCourses || '0 courses')}</td>
            <td><span class="level-pill">${escapeHTML(student.learningLevel || 'Beginner')}</span></td>
            <td><span class="status-pill ${latestAttendance?.status === 'Checked In' ? 'status-active' : latestAttendance ? 'status-pending' : 'status-inactive'}">${escapeHTML(latestAttendance?.status || 'No record')}</span><small class="student-meta">${escapeHTML(attendanceTime)}</small></td>
            <td><span class="attendance-live-time" data-attendance-start="${latestAttendance?.status === 'Checked In' ? escapeHTML(latestAttendance.time) : ''}">${liveTime}</span></td>
            <td><span class="status-pill ${isActive ? 'status-active' : 'status-inactive'}" data-student-status>${isActive ? 'Active' : 'Inactive'}</span></td>
            <td><button class="student-status-toggle" type="button">${isActive ? 'Deactivate' : 'Activate'}</button></td>
        </tr>`;
        }).join('');
        const count = document.querySelector('.students-count strong');
        if (count) count.textContent = String(registeredStudents.length);
        if (empty) empty.hidden = registeredStudents.length > 0;
    };
    renderStudents();
    window.addEventListener('storage', event => {
        if (event.key === 'usersDB' || event.key?.startsWith('studentAttendanceLog-')) renderStudents();
    });
    window.setInterval(() => {
        table.querySelectorAll('[data-attendance-start]').forEach(timer => {
            timer.textContent = timer.dataset.attendanceStart ? formatElapsedDuration(timer.dataset.attendanceStart) : '--:--:--';
        });
    }, 1000);
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
        const email = row.dataset.studentEmail;
        const users = readStorage('usersDB', []);
        const userIndex = users.findIndex(user => user.role === 'student' && user.email === email);
        if (userIndex === -1) {
            showAlert('Could not find this student account. Refresh and try again.');
            return;
        }

        users[userIndex] = { ...users[userIndex], status: isInactive ? 'inactive' : 'active', isActive: !isInactive };
        writeStorage('usersDB', users);

        status.textContent = isInactive ? 'Inactive' : 'Active';
        status.className = `status-pill ${isInactive ? 'status-inactive' : 'status-active'}`;
        btn.textContent = isInactive ? 'Activate' : 'Deactivate';
        showAlert(`${row.querySelector('strong').textContent} is now ${status.textContent.toLowerCase()}.`);
        addAdminNotification(`Student status updated: ${row.querySelector('strong').textContent} is ${status.textContent}.`);
    });
}

function initializeRevenueChart() {
    const period = document.getElementById('revenuePeriod'), bars = document.getElementById('revenueBars');
    if (!period || !bars) return;
    const render = () => {
        const stored = readStorage('lms-enrollments', []);
        const enrollments = Array.isArray(stored) ? stored : [];
        const monthCount = period.value === 'year' ? 12 : 7;
        const now = new Date();
        const months = Array.from({ length: monthCount }, (_, offset) => new Date(now.getFullYear(), now.getMonth() - monthCount + offset + 1, 1));
        const totals = months.map(month => enrollments.filter(item => {
            if (item.status !== 'Paid') return false;
            const created = new Date(item.paidAt || item.created);
            return created.getFullYear() === month.getFullYear() && created.getMonth() === month.getMonth();
        }).reduce((sum, item) => sum + Number(item.amount || 0), 0));
        const maximum = Math.max(...totals, 1);
        bars.innerHTML = totals.map((amount, index) => {
            const height = `${Math.max(amount ? 8 : 0, Math.round(amount / maximum * 100))}%`;
            const label = months[index].toLocaleDateString(undefined, { month: 'short' });
            return `<div class="chart-column${index === totals.length - 1 ? ' is-current' : ''}"><span class="bar-value">$${amount.toFixed(0)}</span><span class="chart-bar" style="--bar-height: ${height}"></span><span class="bar-label">${label}</span></div>`;
        }).join('');
    };
    period.addEventListener('change', render);
    window.addEventListener('storage', event => event.key === 'lms-enrollments' && render());
    render();
}

function initializeModulePage() {
    const pageName = window.location.pathname.split('/').pop().replace(/\.html$/i, '');
    const configs = {
        'add-course': {
            title: 'Course catalogue', desc: 'Create a course and assign it directly to students before publishing.', action: 'Add course',
            fields: [{ name: 'title', label: 'Course title', required: true }, { name: 'category', label: 'Category', required: true }, { name: 'assignedStudentEmails', label: 'Assign to students', type: 'select', multiple: true }, { name: 'price', label: 'Price (USD)', type: 'number', required: true }, { name: 'image', label: 'Course image', type: 'file', accept: 'image/jpeg,image/png,image/webp', required: true }, { name: 'status', label: 'Visibility', type: 'select', options: ['Draft', 'Published'] }],
            columns: [['title', 'Course'], ['category', 'Category'], ['assignedStudentCount', 'Assigned students'], ['price', 'Price'], ['status', 'Status']],
            rows: []
        },
        announcements: {
            title: 'Broadcast messages', desc: 'Share updates with students.', action: 'Publish announcement',
            fields: [{ name: 'title', label: 'Title', required: true }, { name: 'message', label: 'Message', type: 'textarea', required: true }, { name: 'audience', label: 'Audience', type: 'select', required: true, options: ['All users', 'Students'] }, { name: 'publishAt', label: 'Schedule for (leave empty to publish now)', type: 'datetime-local' }],
            columns: [['title', 'Announcement'], ['audience', 'Audience'], ['created', 'Created'], ['status', 'Status']],
            rows: [{ title: 'October learning challenge', audience: 'All users', created: '26 Sep 2026', status: 'Scheduled' }, { title: 'New design courses available', audience: 'Students', created: '24 Sep 2026', status: 'Published' }]
        },
        assignments: {
            title: 'Assignment submissions', desc: 'Review student submissions and grading progress.', action: 'Add assignment', rowAction: 'Mark graded', doneStatus: 'Graded',
            fields: [{ name: 'title', label: 'Assignment', required: true }, { name: 'course', label: 'Course', type: 'select', required: true, dynamic: 'courses' }, { name: 'studentEmail', label: 'Assign to student', type: 'select', required: true, dynamic: 'students' }, { name: 'due', label: 'Due date', type: 'date', required: true }, { name: 'attachment', label: 'Assignment image', type: 'file', accept: 'image/jpeg,image/png,image/webp' }],
            columns: [['title', 'Assignment'], ['course', 'Course'], ['student', 'Student'], ['due', 'Due date'], ['submissionName', 'Submission'], ['status', 'Status']],
            rowAction: 'Mark complete', doneStatus: 'Completed'
        },
        backup: {
            title: 'System backups', desc: 'Create a local backup record. No server database is connected.', action: 'Create snapshot', fields: [],
            columns: [['name', 'Snapshot'], ['created', 'Created'], ['size', 'Size'], ['status', 'Status']],
            rows: [{ name: 'platform-backup-2026-09-26', created: '26 Sep 2026, 09:15', size: '2.4 MB', status: 'Complete' }]
        },
        certificates: {
            title: 'Issued certificates', desc: 'Record course completions and certificate references.', action: 'Issue certificate',
            fields: [{ name: 'studentEmail', label: 'Student', type: 'select', required: true, dynamic: 'students' }, { name: 'course', label: 'Course', type: 'select', required: true, dynamic: 'courses' }],
            columns: [['student', 'Student'], ['course', 'Course'], ['issued', 'Issued'], ['reference', 'Reference'], ['status', 'Status']],
            rows: [{ student: 'Anika Rao', course: 'Intro to Python', issued: '22 Sep 2026', reference: 'CERT-1042', status: 'Issued' }]
        },
        coupons: {
            title: 'Discount coupons', desc: 'Create and track course offers.', action: 'Create coupon',
            fields: [{ name: 'code', label: 'Coupon code', required: true }, { name: 'discount', label: 'Discount (%)', type: 'number', required: true }, { name: 'limit', label: 'Usage limit', type: 'number', required: true }, { name: 'expires', label: 'Expiry date', type: 'date', required: true }, { name: 'audience', label: 'Available to', type: 'select', required: true, options: ['All students', 'One student'] }, { name: 'studentEmail', label: 'Student', type: 'select', dynamic: 'students' }],
            columns: [['code', 'Code'], ['discount', 'Discount'], ['audience', 'Audience'], ['student', 'Student'], ['expires', 'Expires'], ['status', 'Status']],
            rows: [{ code: 'LEARN20', discount: '20%', limit: '500', expires: '31 Dec 2026', status: 'Active' }, { code: 'WELCOME10', discount: '10%', limit: '1,000', expires: '30 Nov 2026', status: 'Active' }]
        },
        courses: {
            title: 'Course catalogue', desc: 'Review published courses and enrollment totals.',
            columns: [['title', 'Course'], ['category', 'Category'], ['assignedStudentCount', 'Assigned students'], ['price', 'Price'], ['status', 'Status']],
            rows: [{ title: 'Full-Stack Web Development', category: 'Development', students: '4,820', price: '$89', status: 'Published' }, { title: 'UI/UX Design Masterclass', category: 'Design', students: '3,640', price: '$64', status: 'Published' }, { title: 'Data Analytics with Python', category: 'Data', students: '2,910', price: '$79', status: 'Published' }]
        },
        enrollments: {
            title: 'Enrollment history', desc: 'Review subscriptions and payment status.',
            columns: [['student', 'Student'], ['course', 'Course'], ['date', 'Enrolled'], ['amount', 'Amount'], ['status', 'Status']],
            rows: [{ student: 'Rahul Sharma', course: 'Full-Stack Web Dev', date: '26 Sep 2026', amount: '$89.00', status: 'Active' }, { student: 'Priya Verma', course: 'UI/UX Design', date: '25 Sep 2026', amount: '$64.00', status: 'Active' }, { student: 'Arjun Mehta', course: 'Data Analytics', date: '24 Sep 2026', amount: '$79.00', status: 'Pending' }]
        },
        export: {
            title: 'Export reports', desc: 'Download current platform records as CSV.', download: true,
            fields: [{ name: 'dataset', label: 'Dataset', type: 'select', options: ['students', 'courses', 'enrollments', 'coupons', 'announcements', 'assignments', 'live-classes', 'reviews', 'certificates', 'support'] }]
        },
        'live-classes': {
            title: 'Upcoming live sessions', desc: 'Schedule live classes and workshops for assigned students.', action: 'Schedule class',
            fields: [{ name: 'title', label: 'Session title', required: true }, { name: 'course', label: 'Course', type: 'select', dynamic: 'courses' }, { name: 'schedule', label: 'Date and time', type: 'datetime-local', required: true }, { name: 'joinUrl', label: 'Meeting link', type: 'url', required: true }],
            columns: [['title', 'Session'], ['course', 'Course'], ['schedule', 'Date and time'], ['status', 'Status']],
            rows: [{ title: 'Building accessible interfaces', schedule: '28 Sep 2026, 16:00', status: 'Scheduled' }, { title: 'React patterns workshop', schedule: '30 Sep 2026, 11:30', status: 'Scheduled' }]
        },
        notifications: {
            title: 'Recent notifications', desc: 'Review system events and mark them as read.', rowAction: 'Mark read', doneStatus: 'Read',
            columns: [['event', 'Notification'], ['detail', 'Details'], ['time', 'Received'], ['status', 'Status']],
            rows: [{ event: 'Assignment review needed', detail: '12 submissions await grading.', time: '24 minutes ago', status: 'Unread' }, { event: 'New enrollment', detail: 'Rahul Sharma joined Full-Stack Web Dev.', time: '1 hour ago', status: 'Unread' }, { event: 'Payment received', detail: '$89.00 payment completed.', time: '2 hours ago', status: 'Read' }]
        },
        profile: {
            title: 'Profile information', desc: 'Update administrator details in this browser.', action: 'Save profile', saveOnly: true,
                fields: [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'currentPassword', label: 'Current password', type: 'password' }, { name: 'newPassword', label: 'New password', type: 'password' }, { name: 'confirmPassword', label: 'Confirm new password', type: 'password' }]
        },
        rating: {
            title: 'Course ratings', desc: 'Compare student feedback across courses.',
            columns: [['course', 'Course'], ['rating', 'Average rating'], ['reviews', 'Reviews'], ['trend', 'Trend']],
            rows: [{ course: 'Intro to Python', rating: '4.9 / 5', reviews: '1,204', trend: 'Up 0.2' }, { course: 'UI/UX Design Masterclass', rating: '4.8 / 5', reviews: '986', trend: 'Steady' }, { course: 'Full-Stack Web Development', rating: '4.7 / 5', reviews: '2,340', trend: 'Up 0.1' }]
        },
        revenue: {
            title: 'Course payments', desc: 'Review free, pending, and paid course enrollments.', rowAction: 'Mark paid', doneStatus: 'Paid',
            columns: [['created', 'Date'], ['student', 'Student'], ['course', 'Course'], ['amount', 'Amount'], ['status', 'Payment status']],
            rows: [{ date: '26 Sep 2026', student: 'Rahul Sharma', course: 'Full-Stack Web Dev', amount: '$89.00', status: 'Paid' }, { date: '25 Sep 2026', student: 'Priya Verma', course: 'UI/UX Design', amount: '$64.00', status: 'Paid' }, { date: '24 Sep 2026', student: 'Arjun Mehta', course: 'Data Analytics', amount: '$79.00', status: 'Pending' }]
        },
        reviews: {
            title: 'Course feedback', desc: 'Review and resolve student feedback.', rowAction: 'Resolve', doneStatus: 'Resolved',
            columns: [['student', 'Student'], ['course', 'Course'], ['rating', 'Rating'], ['comment', 'Review'], ['status', 'Status']],
            rows: [{ student: 'Priya Verma', course: 'UI/UX Design', rating: '5 / 5', comment: 'Clear lessons and useful projects.', status: 'New' }, { student: 'Arjun Mehta', course: 'Data Analytics', rating: '4 / 5', comment: 'Great pace, more practice would help.', status: 'New' }]
        },
        roles: {
            title: 'Access control', desc: 'Manage admin and student access. Enforcement needs a backend.', action: 'Add role',
            fields: [{ name: 'role', label: 'Role name', required: true }, { name: 'description', label: 'Description', required: true }, { name: 'access', label: 'Access level', type: 'select', options: ['Read only', 'Manage courses', 'Full access'] }],
            columns: [['role', 'Role'], ['description', 'Description'], ['access', 'Access'], ['status', 'Status']],
            rows: [{ role: 'Administrator', description: 'Full platform management', access: 'Full access', status: 'Active' }, { role: 'Student', description: 'Access assigned courses and learning tools', access: 'Read only', status: 'Active' }]
        },
        support: {
            title: 'Support tickets', desc: 'Track and resolve issues reported by students.', action: 'Add ticket', rowAction: 'Mark resolved', doneStatus: 'Resolved',
            fields: [{ name: 'reporterRole', label: 'Reported by', type: 'select', options: ['Student', 'Admin'] }, { name: 'category', label: 'Issue type', type: 'select', options: ['Course access', 'Course content', 'Payment', 'Account or profile', 'Assignment', 'Technical problem', 'Other'] }, { name: 'subject', label: 'Subject', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'details', label: 'Details', type: 'textarea', required: true }],
            columns: [['subject', 'Issue'], ['reporterName', 'Reported by'], ['reporterRole', 'Role'], ['category', 'Type'], ['email', 'Email'], ['details', 'Details'], ['created', 'Created'], ['status', 'Status']],
            rows: []
        },
        settings: {
            title: 'Global configurations', desc: 'Save preferences in this browser. Payments need a backend.', action: 'Save settings', saveOnly: true,
            fields: [{ name: 'platform', label: 'Platform name', required: true }, { name: 'email', label: 'Support email', type: 'email', required: true }, { name: 'currency', label: 'Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'INR'] }]
        }
    };

    const config = configs[pageName];
    const body = document.querySelector('.dash-body');
    if (!config || !body) return;

    const storageKey = pageName === 'reviews' ? 'lms-reviews'
        : pageName === 'enrollments' || pageName === 'revenue' ? 'lms-enrollments'
            : pageName === 'notifications' ? 'lms-notifications'
                : `lms-admin-${pageName}`;
    const getRecords = () => {
        const saved = readStorage(storageKey, []);
        const records = Array.isArray(saved) ? [...saved] : [];
        if (pageName === 'courses') {
            const sharedCourses = readStorage('lms-courses', []);
            return Array.isArray(sharedCourses) ? sharedCourses : [];
        }
        if (pageName === 'assignments') return records.map(record => ({ ...record, student: record.student || record.studentName || '', submissionName: record.submissionName || (record.submissionFile ? 'Submitted' : 'Not submitted') }));
        if (pageName === 'announcements') return processScheduledRecords(records, 'announcement');
        if (pageName === 'live-classes') return processScheduledRecords(records, 'live-class');
        if (pageName === 'enrollments') return records.map(record => ({ ...record, date: record.date || (record.created ? new Date(record.created).toLocaleDateString() : ''), status: record.status || 'Pending' }));
        if (pageName === 'revenue') return records.map(record => ({ ...record, created: record.created ? new Date(record.paidAt || record.created).toLocaleDateString() : '' }));
        if (pageName === 'notifications') return records.map(record => ({ ...record, event: record.text || record.event || 'Update', time: record.created ? new Date(record.created).toLocaleString() : '', status: record.read ? 'Read' : 'Unread' }));
        if (pageName === 'certificates') return records.map(record => ({ ...record, student: record.student || record.studentName || record.studentEmail || '' }));
        return records;
    };
    const accountUsers = readStorage('usersDB', []);
    const activeStudents = (Array.isArray(accountUsers) ? accountUsers : []).filter(user => user.role === 'student' && user.status !== 'inactive' && user.isActive !== false);
    const makeField = ({ name, label, type = 'text', required, options = [], multiple = false, accept = '', dynamic = '' }) => {
        const attrs = required ? ' required' : '';
        const fieldOptions = dynamic === 'students'
            ? activeStudents.map(user => ({ value: user.email, label: `${user.name || 'Student'} (${user.email})` }))
            : dynamic === 'courses'
                ? (Array.isArray(readStorage('lms-courses', [])) ? readStorage('lms-courses', []).filter(course => course.status === 'Published') : []).map(course => ({ value: course.title, label: course.title }))
                : pageName === 'add-course' && name === 'assignedStudentEmails'
                ? activeStudents.map(user => ({ value: user.email, label: `${user.name || 'Student'} (${user.email})` }))
                : options.map(option => ({ value: option, label: option }));
        const input = type === 'select'
            ? `<select name="${escapeHTML(name)}"${attrs}${multiple ? ' multiple size="5"' : ''}>${multiple ? '' : '<option value="">Select an option</option>'}${fieldOptions.map(option => `<option value="${escapeHTML(option.value)}">${escapeHTML(option.label)}</option>`).join('')}</select>`
            : type === 'textarea'
                ? `<textarea name="${escapeHTML(name)}"${attrs}></textarea>`
                : type === 'file'
                    ? `<input name="${escapeHTML(name)}" type="file" accept="${escapeHTML(accept)}"${attrs}>`
                : `<input name="${escapeHTML(name)}" type="${escapeHTML(type)}"${attrs}${type === 'number' ? ' min="0" step="any"' : ''}>`;
        const hint = pageName === 'add-course' && name === 'assignedStudentEmails' ? '<small class="field-hint">Use Ctrl or Command to select more than one student. Only selected students can see a published course.</small>' : type === 'file' ? '<small class="field-hint">JPG, PNG, or WebP, up to 1 MB.</small>' : '';
        return `<label class="module-field${multiple ? ' module-field-wide' : ''}">${escapeHTML(label)}${input}${hint}</label>`;
    };
    const courseImagePreview = pageName === 'add-course' ? '<img class="module-image-preview" id="moduleImagePreview" alt="Course image preview" hidden><p class="module-form-status" id="moduleFormStatus" role="status" aria-live="polite"></p>' : '';
    const form = config.fields ? `<section class="module-panel"><h2>${escapeHTML(config.action)}</h2><p>Courses and images are stored in this browser for this demo.</p><form class="module-form${pageName === 'add-course' ? ' course-admin-form' : ''}" id="moduleForm">${config.fields.map(makeField).join('')}${courseImagePreview}<button class="button button-primary" type="submit">${escapeHTML(config.download ? 'Download CSV' : config.action)}</button></form></section>` : '';
    const supportFilters = pageName === 'support' ? '<div class="support-filters"><label>Reporter<select id="supportReporterFilter"><option value="">All reporters</option></select></label><label>Issue type<select id="supportCategoryFilter"><option value="">All issue types</option></select></label><label>Status<select id="supportStatusFilter"><option value="">All statuses</option><option>Open</option><option>Resolved</option></select></label></div>' : '';
    const table = config.columns ? `<section class="module-panel${pageName === 'support' ? ' support-queue-panel' : ''}"><h2>${escapeHTML(config.title)}</h2><label class="module-search"><span class="sr-only">Search ${escapeHTML(config.title)}</span><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input id="moduleSearch" type="search" placeholder="Search records"></label>${supportFilters}<div id="moduleTable"></div></section>` : '';
    const note = config.saveOnly ? '<p class="module-note">Saved preferences stay in this browser and do not change platform services.</p>' : '';
    const paymentSummary = pageName === 'revenue' ? '<div class="module-payment-stats"><article><span>Paid revenue</span><strong id="paidRevenueTotal">$0.00</strong></article><article><span>Paid</span><strong id="paidPaymentCount">0</strong></article><article><span>Pending</span><strong id="pendingPaymentCount">0</strong></article><article><span>Free</span><strong id="freePaymentCount">0</strong></article></div>' : '';
    body.innerHTML = `<section class="module-content module-page-${escapeHTML(pageName)}"><header class="module-summary"><div><p class="eyebrow">ADMIN</p><h1>${escapeHTML(config.title)}</h1><p>${escapeHTML(config.desc)}</p></div></header>${paymentSummary}<div class="module-layout${config.fields && config.columns ? '' : ' is-single'}">${form}${table}</div>${note}</section>`;

    const renderTable = () => {
        const records = getRecords();
        const reporterFilter = document.getElementById('supportReporterFilter');
        const categoryFilter = document.getElementById('supportCategoryFilter');
        const statusFilter = document.getElementById('supportStatusFilter');
        const query = document.getElementById('moduleSearch')?.value.trim().toLowerCase() || '';
        const populateFilter = (select, values, label) => {
            if (!select) return;
            const selected = select.value;
            select.innerHTML = `<option value="">${label}</option>${values.map(item => {
                const option = typeof item === 'string' ? { value: item, label: item } : item;
                return `<option value="${escapeHTML(option.value)}">${escapeHTML(option.label)}</option>`;
            }).join('')}`;
            if (values.some(item => (typeof item === 'string' ? item : item.value) === selected)) select.value = selected;
        };
        if (pageName === 'support') {
            const reporters = [...new Map(records.filter(record => record.email || record.reporterName).map(record => [record.email || record.reporterName, {
                value: record.email || record.reporterName,
                label: `${record.reporterName || record.email} (${record.reporterRole || 'Admin'})`
            }])).values()];
            populateFilter(reporterFilter, reporters, 'All reporters');
            populateFilter(categoryFilter, [...new Set(records.map(record => record.category).filter(Boolean))], 'All issue types');
        }
        const visibleRecords = records.map((record, index) => ({ record, index })).filter(({ record }) => {
            const matchesSearch = !query || Object.values(record).join(' ').toLowerCase().includes(query);
            if (pageName !== 'support') return matchesSearch;
            return matchesSearch
                && (!reporterFilter?.value || (record.email || record.reporterName) === reporterFilter.value)
                && (!categoryFilter?.value || record.category === categoryFilter.value)
                && (!statusFilter?.value || record.status === statusFilter.value);
        });
        if (pageName === 'revenue') {
            const countStatus = status => records.filter(record => record.status === status).length;
            const paidTotal = records.filter(record => record.status === 'Paid').reduce((sum, record) => sum + Number(record.amount || 0), 0);
            document.getElementById('paidRevenueTotal').textContent = `$${paidTotal.toFixed(2)}`;
            document.getElementById('paidPaymentCount').textContent = String(countStatus('Paid'));
            document.getElementById('pendingPaymentCount').textContent = String(countStatus('Pending'));
            document.getElementById('freePaymentCount').textContent = String(countStatus('Free'));
        }
        const headings = config.columns.map(([, label]) => `<th>${escapeHTML(label)}</th>`).join('');
        const actions = pageName === 'courses' ? '<th>Actions</th>' : config.rowAction ? '<th>Action</th>' : '';
        const rows = visibleRecords.map(({ record, index }) => {
            const cells = config.columns.map(([key]) => {
                const rawValue = key === 'price' && pageName === 'courses'
                    ? `$${Number(String(record[key] ?? '0').replace(/[^\d.]/g, '') || 0).toFixed(2)}`
                    : record[key];
                const value = escapeHTML(rawValue);
                if (key === 'submissionName' && record.submissionData) return `<td><span>${value}</span><img class="module-submission-preview" src="${escapeHTML(record.submissionData)}" alt="Student assignment submission"></td>`;
                if (key === 'amount' && pageName === 'revenue') return `<td>${Number(record.amount || 0) ? `$${Number(record.amount).toFixed(2)}` : 'Free'}</td>`;
                if (key !== 'status') return `<td>${value}</td>`;
                const state = /active|published|paid|complete|issued|read|resolved|graded/i.test(value) ? ' is-positive' : /pending|scheduled|progress|draft/i.test(value) ? ' is-pending' : ' is-alert';
                return `<td><span class="module-badge${state}">${value}</span></td>`;
            }).join('');
            const action = pageName === 'courses'
                ? `<td><div class="course-table-actions"><button class="module-row-action" type="button" data-edit-course="${escapeHTML(record.id)}">Edit</button><button class="module-row-action" type="button" data-course-status="${escapeHTML(record.id)}">${record.status === 'Published' ? 'Set draft' : 'Publish'}</button><button class="module-row-action is-danger" type="button" data-delete-course="${escapeHTML(record.id)}">Delete</button></div></td>`
                : config.rowAction ? `<td>${record.status === config.doneStatus || (pageName === 'revenue' && record.status === 'Free') ? 'Done' : `<button class="module-row-action" type="button" data-row="${index}">${escapeHTML(config.rowAction)}</button>`}</td>` : '';
            return `<tr>${cells}${action}</tr>`;
        }).join('');
        document.getElementById('moduleTable').innerHTML = rows
            ? `<div class="module-table-wrap"><table class="module-table"><thead><tr>${headings}${actions}</tr></thead><tbody>${rows}</tbody></table></div>`
            : '<p class="module-empty">No tickets match these filters.</p>';
    };

    if (config.columns) {
        renderTable();
        document.getElementById('moduleSearch')?.addEventListener('input', renderTable);
        ['supportReporterFilter', 'supportCategoryFilter', 'supportStatusFilter'].forEach(id => document.getElementById(id)?.addEventListener('change', renderTable));
        if (['support', 'announcements', 'assignments', 'certificates', 'coupons', 'live-classes', 'reviews', 'revenue', 'enrollments', 'notifications'].includes(pageName)) {
            window.addEventListener('storage', event => [storageKey, 'lms-courses', 'usersDB'].includes(event.key) && renderTable());
        }
        if (pageName === 'courses') {
            window.addEventListener('lms-courses-updated', renderTable);
            window.addEventListener('storage', event => ['lms-courses', 'lms-admin-add-course', 'lms-admin-courses'].includes(event.key) && renderTable());
        }
        if (pageName === 'announcements' || pageName === 'live-classes') window.setInterval(renderTable, 30000);
    }
    if (config.saveOnly) {
        const savedProfile = pageName === 'profile' ? readStorage('loggedInUser', {}) : readStorage(storageKey, {});
        Object.entries(savedProfile).forEach(([name, value]) => {
            const field = document.getElementById('moduleForm')?.elements.namedItem(name);
            if (field) field.value = value;
        });
    }

    const moduleForm = document.getElementById('moduleForm');
    if (pageName === 'coupons') {
        const audienceField = moduleForm?.elements.namedItem('audience');
        const studentField = moduleForm?.elements.namedItem('studentEmail')?.closest('label');
        const updateCouponAudience = () => { if (studentField) studentField.hidden = audienceField?.value !== 'One student'; };
        audienceField?.addEventListener('change', updateCouponAudience);
        updateCouponAudience();
    }
    const moduleImageInput = moduleForm?.elements.namedItem('image');
    const moduleImagePreview = document.getElementById('moduleImagePreview');
    const moduleFormStatus = document.getElementById('moduleFormStatus');
    moduleImageInput?.addEventListener('change', () => {
        const imageFile = moduleImageInput.files?.[0];
        if (!imageFile) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type) || imageFile.size > 1024 * 1024) {
            moduleImageInput.value = '';
            if (moduleImagePreview) moduleImagePreview.hidden = true;
            if (moduleFormStatus) moduleFormStatus.textContent = 'Choose a JPG, PNG, or WebP image under 1 MB.';
            return;
        }
        if (moduleImagePreview) {
            moduleImagePreview.src = URL.createObjectURL(imageFile);
            moduleImagePreview.hidden = false;
        }
        if (moduleFormStatus) moduleFormStatus.textContent = '';
    });

    moduleForm?.addEventListener('submit', async event => {
        event.preventDefault();
        const formElement = event.currentTarget;
        const formData = new FormData(formElement);
        const values = Object.fromEntries(formData.entries());
        if (pageName === 'add-course') {
            const imageFile = formData.get('image');
            const assignedStudentEmails = formData.getAll('assignedStudentEmails');
            const showFormError = message => {
                if (moduleFormStatus) moduleFormStatus.textContent = message;
                else showToast(message);
            };
            if (values.status === 'Published' && !assignedStudentEmails.length) {
                showFormError('Assign this course to at least one student before publishing.');
                return;
            }
            if (!(imageFile instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type) || imageFile.size > 1024 * 1024) {
                showFormError('Choose a JPG, PNG, or WebP image under 1 MB.');
                return;
            }
            const image = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(imageFile);
            });
            if (!image) {
                showFormError('Could not read this image. Choose it again.');
                return;
            }
            const course = {
                id: globalThis.crypto?.randomUUID?.() || `course-${Date.now()}`,
                title: values.title.trim(),
                category: values.category.trim(),
                assignedStudentEmails,
                assignedStudentCount: assignedStudentEmails.length,
                students: String(assignedStudentEmails.length),
                price: Number(values.price).toFixed(2),
                status: values.status,
                image,
                created: new Date().toISOString()
            };
            const sharedCourses = readStorage('lms-courses', []);
            const nextSharedCourses = [...(Array.isArray(sharedCourses) ? sharedCourses : []), course];
            const savedAdminCourses = readStorage('lms-admin-add-course', []);
            const nextAdminCourses = [...(Array.isArray(savedAdminCourses) ? savedAdminCourses : []), course];
            const users = readStorage('usersDB', []);
            const previousCourses = localStorage.getItem('lms-courses');
            try {
                writeStorage('lms-courses', nextSharedCourses);
                writeStorage('lms-admin-add-course', nextAdminCourses);
                const storedEnrollments = readStorage('lms-enrollments', []);
                const enrollments = Array.isArray(storedEnrollments) ? storedEnrollments : [];
                if (course.status === 'Published') assignedStudentEmails.forEach(email => {
                    const student = users.find(user => user.role === 'student' && user.email === email);
                    if (!student) return;
                    enrollments.push({ id: `enrollment-${course.id}-${student.id || email}`, student: student.name || 'Student', email, course: course.title, courseId: course.id, amount: Number(course.price), status: Number(course.price) === 0 ? 'Free' : 'Pending', created: course.created });
                });
                writeStorage('lms-enrollments', enrollments);
            } catch {
                if (previousCourses === null) localStorage.removeItem('lms-courses');
                else localStorage.setItem('lms-courses', previousCourses);
                showFormError('Browser storage is full. Try a smaller image.');
                return;
            }
            if (values.status === 'Published') {
                assignedStudentEmails.forEach(email => {
                    const student = users.find(user => user.role === 'student' && user.email === email);
                    if (!student) return;
                    const key = `lms-student-notifications-${student.id || student.email}`;
                    const notices = readStorage(key, []);
                    notices.unshift({ title: 'New course assigned', message: `${course.title} is now available.`, read: false, created: new Date().toISOString() });
                    writeStorage(key, notices.slice(0, 50));
                });
            }
            formElement.reset();
            if (moduleImagePreview) moduleImagePreview.hidden = true;
            if (moduleFormStatus) moduleFormStatus.textContent = 'Course saved and assigned.';
            renderTable();
            showToast(values.status === 'Published' ? 'Course published for assigned students.' : 'Course draft saved.');
            return;
        }
        if (config.download) {
            const datasets = {
                students: (readStorage('usersDB', []) || []).filter(user => user.role === 'student'),
                courses: readStorage('lms-courses', []),
                enrollments: readStorage('lms-enrollments', []),
                coupons: readStorage('lms-admin-coupons', []),
                announcements: readStorage('lms-admin-announcements', []),
                assignments: readStorage('lms-admin-assignments', []),
                'live-classes': readStorage('lms-admin-live-classes', []),
                reviews: readStorage('lms-reviews', []),
                certificates: readStorage('lms-admin-certificates', []),
                support: readStorage('lms-admin-support', [])
            };
            const records = Array.isArray(datasets[values.dataset]) ? datasets[values.dataset] : [];
            const columns = Object.keys(records[0] || {});
            if (records.length) downloadCSV([columns, ...records.map(record => columns.map(key => record[key]))], `${values.dataset}-report.csv`);
            else showToast('No records available.');
            return;
        }
        if (config.saveOnly) {
            if (pageName === 'profile') {
                const currentUser = readStorage('loggedInUser', null);
                const users = readStorage('usersDB', []);
                const safeUsers = Array.isArray(users) ? users : [];
                const index = safeUsers.findIndex(user => user.email === currentUser?.email && user.role === 'admin');
                const changingPassword = Boolean(values.currentPassword || values.newPassword || values.confirmPassword);
                if (index < 0) return showToast('Could not find the current admin account.');
                if (changingPassword && (!values.currentPassword || !values.newPassword || !values.confirmPassword)) return showToast('Fill in all password fields to change your password.');
                if (changingPassword && safeUsers[index].password !== values.currentPassword) return showToast('Current password is incorrect.');
                if (changingPassword && values.newPassword.length < 8) return showToast('New password must be at least 8 characters.');
                if (changingPassword && values.newPassword !== values.confirmPassword) return showToast('New passwords do not match.');
                if (safeUsers.some((user, userIndex) => userIndex !== index && String(user.email || '').toLowerCase() === values.email.trim().toLowerCase())) return showToast('That email address is already in use.');
                safeUsers[index] = { ...safeUsers[index], name: values.name.trim(), email: values.email.trim(), ...(changingPassword ? { password: values.newPassword } : {}) };
                writeStorage('usersDB', safeUsers);
                writeStorage('loggedInUser', safeUsers[index]);
                document.querySelectorAll('.user-profile span').forEach(name => name.textContent = values.name.trim());
                ['currentPassword', 'newPassword', 'confirmPassword'].forEach(name => { moduleForm.elements.namedItem(name).value = ''; });
            } else localStorage.setItem(storageKey, JSON.stringify(values));
            showToast('Changes saved in this browser.');
            return;
        }
        const records = getRecords();
        const now = new Date().toISOString();
        if (pageName === 'announcements') {
            const publishAt = values.publishAt ? new Date(values.publishAt).toISOString() : now;
            Object.assign(values, { id: `announcement-${Date.now()}`, created: now, publishAt, status: new Date(publishAt) <= new Date() ? 'Published' : 'Scheduled', notifiedTo: [] });
        }
        if (pageName === 'live-classes') Object.assign(values, { id: `live-${Date.now()}`, schedule: new Date(values.schedule).toISOString(), status: 'Scheduled' });
        if (pageName === 'support') Object.assign(values, { reporterName: 'Admin User', created: new Date().toLocaleString(), status: 'Open' });
        if (pageName === 'certificates') {
            const student = activeStudents.find(user => user.email === values.studentEmail);
            Object.assign(values, { student: student?.name || values.studentEmail, issued: new Date().toLocaleDateString(), reference: `CERT-${Date.now().toString().slice(-6)}`, status: 'Issued' });
        }
        if (pageName === 'coupons') {
            if (Number(values.discount) > 100 || Number(values.discount) <= 0 || Number(values.limit) < 1 || (values.audience === 'One student' && !values.studentEmail)) {
                showToast('Enter a discount from 1% to 100%, a positive usage limit, and a student when targeted.');
                return;
            }
            const student = activeStudents.find(user => user.email === values.studentEmail);
            Object.assign(values, { discount: `${values.discount}%`, student: student?.name || '', status: 'Active', created: now });
            if (values.audience !== 'One student') values.studentEmail = '';
        }
        if (pageName === 'backup') Object.assign(values, { name: `platform-backup-${new Date().toISOString().slice(0, 10)}`, created: new Date().toLocaleString(), size: 'Local snapshot', status: 'Complete' });
        if (pageName === 'roles') values.status = 'Active';
        if (pageName === 'assignments') {
            const student = activeStudents.find(user => user.email === values.studentEmail);
            const attachment = formData.get('attachment');
            values.id = `assignment-${Date.now()}`;
            values.student = student?.name || values.studentEmail;
            values.status = 'Pending';
            values.created = now;
            if (attachment instanceof File && attachment.size) {
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(attachment.type) || attachment.size > 1024 * 1024) {
                    showToast('Choose a JPG, PNG, or WebP image under 1 MB.');
                    return;
                }
                values.attachmentData = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => resolve('');
                    reader.readAsDataURL(attachment);
                });
            }
            delete values.attachment;
        }
        if (pageName === 'certificates') values.id = `certificate-${Date.now()}`;
        if (pageName === 'coupons') values.id = `coupon-${Date.now()}`;
        records.push(values);
        localStorage.setItem(storageKey, JSON.stringify(records));
        if (pageName === 'assignments') notifyStudents(`New assignment: ${values.title}. Due ${values.due}.`, 'Assignment assigned', values.studentEmail);
        if (pageName === 'certificates') notifyStudents(`Your certificate for ${values.course} is ready.`, 'Certificate issued', values.studentEmail);
        if (pageName === 'live-classes') notifyStudents(`${values.title} is scheduled for ${new Date(values.schedule).toLocaleString()}.`, 'Live class scheduled');
        if (pageName !== 'announcements') addAdminNotification(`${config.title}: ${values.title || values.name || values.subject || values.code || 'New record'} added.`);
        formElement.reset();
        renderTable();
        showToast(`${config.action} saved.`);
    });

    body.addEventListener('click', event => {
        const courseStatusButton = event.target.closest('[data-course-status]');
        if (courseStatusButton) {
            const courses = readStorage('lms-courses', []);
            const course = courses.find(item => String(item.id) === courseStatusButton.dataset.courseStatus);
            if (!course) return;
            course.status = course.status === 'Published' ? 'Draft' : 'Published';
            writeStorage('lms-courses', courses);
            writeStorage('lms-admin-add-course', courses);
            if (course.status === 'Published') {
                const users = readStorage('usersDB', []);
                const enrollments = readStorage('lms-enrollments', []);
                const safeEnrollments = Array.isArray(enrollments) ? enrollments : [];
                (Array.isArray(course.assignedStudentEmails) ? course.assignedStudentEmails : []).forEach(email => {
                    const student = users.find(user => user.role === 'student' && user.email === email);
                    if (!student) return;
                    if (!safeEnrollments.some(item => item.courseId === course.id && item.email === email)) safeEnrollments.push({ id: `enrollment-${course.id}-${student.id || email}`, student: student.name || 'Student', email, course: course.title, courseId: course.id, amount: Number(course.price), status: Number(course.price) === 0 ? 'Free' : 'Pending', created: new Date().toISOString() });
                    notifyStudents(`${course.title} is now available.`, 'New course assigned', email);
                });
                writeStorage('lms-enrollments', safeEnrollments);
            }
            window.dispatchEvent(new Event('lms-courses-updated'));
            renderTable();
            showToast(`Course moved to ${course.status.toLowerCase()}.`);
            return;
        }
        const button = event.target.closest('[data-row]');
        if (!button) return;
        const records = readStorage(storageKey, []);
        const record = records[Number(button.dataset.row)];
        if (!record) return;
        record.status = config.doneStatus;
        if (pageName === 'revenue') record.paidAt = new Date().toISOString();
        if (pageName === 'notifications') record.read = true;
        if (pageName === 'reviews') notifyStudents(`Your review for ${record.course} has been resolved.`, 'Review update', record.email);
        if (pageName === 'assignments') notifyStudents(`Your assignment "${record.title}" is complete.`, 'Assignment reviewed', record.studentEmail);
        if (pageName === 'revenue') notifyStudents(`Payment for ${record.course} is confirmed.`, 'Payment confirmed', record.email);
        localStorage.setItem(storageKey, JSON.stringify(records));
        if (pageName === 'notifications') window.dispatchEvent(new StorageEvent('storage', { key: 'lms-notifications' }));
        renderTable();
        initializeAdminOverview();
        showToast(`Marked ${String(config.doneStatus).toLowerCase()}.`);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const esc = value => String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const levelTable = document.getElementById('adminLearningLevelsTable');
    if (levelTable) {
        const renderLevels = () => {
            const users = readStorage('usersDB', []);
            const students = (Array.isArray(users) ? users : []).filter(u => u.role === 'student');
            const tbody = levelTable.querySelector('tbody');
            if (!tbody) return;
            tbody.innerHTML = students.length ? students.map((u,i) => `<tr><td style="padding:12px;">${esc(u.name || 'Student')}</td><td style="padding:12px;">${esc(u.email)}</td><td style="padding:12px;"><select data-level-index="${i}" style="padding:7px;border:1px solid var(--border-color);border-radius:6px;">${['Beginner','Intermediate','Advanced'].map(l=>`<option ${((u.learningLevel||'Beginner')===l)?'selected':''}>${l}</option>`).join('')}</select></td><td style="padding:12px;"><button class="button button-primary" data-save-level="${i}" style="padding:6px 12px;font-size:12px;">Save Level</button></td></tr>`).join('') : '<tr><td colspan="4" style="padding:20px;text-align:center;">No students registered yet.</td></tr>';
            tbody.querySelectorAll('[data-save-level]').forEach(btn => btn.addEventListener('click', () => {
                const usersNow=readStorage('usersDB',[]), studentsNow=usersNow.filter(u=>u.role==='student'), idx=Number(btn.dataset.saveLevel), student=studentsNow[idx], select=tbody.querySelector(`[data-level-index="${idx}"]`);
                if(!student||!select)return;
                const realIndex=usersNow.findIndex(u=>u.email===student.email&&u.role==='student');
                usersNow[realIndex].learningLevel=select.value; localStorage.setItem('usersDB',JSON.stringify(usersNow));
                const key=`lms-student-notifications-${student.id||student.email}`, notes=readStorage(key,[]);
                notes.unshift({title:'Learning level updated',message:`Admin updated your learning level to ${select.value}.`,read:false,created:new Date().toISOString()});
                localStorage.setItem(key,JSON.stringify(notes.slice(0,50))); showToast('Learning level updated.');
            }));
        };
        renderLevels(); window.addEventListener('storage',e=>{if(e.key==='usersDB')renderLevels();});
    }

    const leaveTable = document.getElementById('adminLeaveTable');
    if (leaveTable) {
        const renderLeaves = () => {
            const leaves=readStorage('lms-leaves',[]), tbody=leaveTable.querySelector('tbody'); if(!tbody)return;
            const records=Array.isArray(leaves)?leaves.slice().reverse():[];
            tbody.innerHTML=records.length?records.map((x,i)=>`<tr><td style="padding:12px;"><strong>${esc(x.studentName)}</strong><br><small>${esc(x.studentEmail)}</small></td><td style="padding:12px;">${esc(x.startDate)} to ${esc(x.endDate)}</td><td style="padding:12px;">${esc(x.reason)}</td><td style="padding:12px;min-width:220px;">${esc(x.description)}</td><td style="padding:12px;white-space:nowrap;"><span class="status-pill ${x.status==='Approved'?'status-active':x.status==='Rejected'?'status-inactive':'status-pending'}">${esc(x.status)}</span>${x.status==='Pending'?`<button class="button button-primary" data-leave-action="Approved" data-leave-index="${i}" style="padding:5px 10px;font-size:11px;margin-left:5px;">Approve</button><button class="button button-secondary" data-leave-action="Rejected" data-leave-index="${i}" style="padding:5px 10px;font-size:11px;background:#ffebee;color:#c62828;margin-left:5px;">Reject</button>`:''}</td></tr>`).join(''):'<tr><td colspan="5" style="padding:25px;text-align:center;">No leave requests found.</td></tr>';
            tbody.querySelectorAll('[data-leave-action]').forEach(btn=>btn.addEventListener('click',()=>{
                const all=readStorage('lms-leaves',[]), reversed=Array.isArray(all)?all.slice().reverse():[], record=reversed[Number(btn.dataset.leaveIndex)];
                if(!record)return; const actual=all.findIndex(x=>x.id===record.id); if(actual<0)return;
                all[actual].status=btn.dataset.leaveAction; all[actual].reviewedAt=new Date().toISOString(); all[actual].reviewedBy=readStorage('loggedInUser',null)?.email||'admin';
                localStorage.setItem('lms-leaves',JSON.stringify(all));
                const key=`lms-student-notifications-${record.studentId||record.studentEmail}`, notes=readStorage(key,[]);
                notes.unshift({title:`Leave request ${btn.dataset.leaveAction.toLowerCase()}`,message:`Your leave request from ${record.startDate} to ${record.endDate} was ${btn.dataset.leaveAction.toLowerCase()} by admin.`,read:false,created:new Date().toISOString()});
                localStorage.setItem(key,JSON.stringify(notes.slice(0,50))); renderLeaves(); showToast(`Leave request ${btn.dataset.leaveAction.toLowerCase()}.`);
            }));
        };
        renderLeaves(); window.addEventListener('storage',e=>{if(e.key==='lms-leaves')renderLeaves();});
    }
});
